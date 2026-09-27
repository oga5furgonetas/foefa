/**
 * Ayudas para los Route Handlers de /api/v1: respuestas JSON uniformes,
 * CSRF, origen, límite de ritmo y autenticación.
 */
import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z, type ZodTypeAny } from 'zod';
import { checkCsrf, checkOrigin, CSRF_COOKIE, CSRF_HEADER } from '@histor/core/auth/csrf';
import { getSessionUser, SESSION_COOKIE, type SessionUser } from '@histor/core/auth/users';
import { can, type Permission } from '@histor/core/domain';
import { adminIpAllowed, adminRequires2fa } from '@histor/core/env';
import { ipHash } from '@histor/core/security/crypto';
import { rateLimit, type Limit } from '@histor/core/security/ratelimit';
import { reportError } from '@histor/core/observability/index';
import { db } from './server';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function json(data: unknown, init: ResponseInit = {}) {
  return NextResponse.json(data, { ...init, headers: { 'cache-control': 'no-store', ...(init.headers ?? {}) } });
}

export function clientIp(req: NextRequest): string | null {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

/** Peticiones que cambian datos: origen + token CSRF de doble envío. */
export function assertCsrf(req: NextRequest) {
  if (!checkOrigin(req.headers.get('origin'), req.headers.get('referer'), req.headers.get('host'))) throw new ApiError(403, 'bad_origin');
  if (!checkCsrf(req.cookies.get(CSRF_COOKIE)?.value, req.headers.get(CSRF_HEADER))) throw new ApiError(403, 'bad_csrf');
}

export async function limit(l: Limit) {
  const r = await rateLimit(l);
  if (!r.allowed) throw new ApiError(429, 'rate_limited', `retry after ${r.retryAfterSec}s`);
}

export async function sessionUser(req: NextRequest): Promise<SessionUser | null> {
  return getSessionUser(db(), req.cookies.get(SESSION_COOKIE)?.value);
}

export async function requireUser(req: NextRequest): Promise<SessionUser> {
  const u = await sessionUser(req);
  if (!u) throw new ApiError(401, 'unauthorized');
  return u;
}

export async function requirePermission(req: NextRequest, p: Permission): Promise<SessionUser> {
  const u = await requireUser(req);
  if (!can(u.role, p)) throw new ApiError(403, 'forbidden');
  if (!adminIpAllowed(clientIp(req))) throw new ApiError(403, 'ip_not_allowed');
  if (adminRequires2fa() && !u.totpEnabled) throw new ApiError(403, 'mfa_setup_required');
  if (u.totpEnabled && !u.mfaPassed) throw new ApiError(403, 'mfa_required');
  return u;
}

export async function parseBody<T extends ZodTypeAny>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, 'invalid_json');
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw new ApiError(400, 'invalid_input', r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return r.data;
}

/** Envuelve un handler: errores controlados → JSON; el resto se registra y devuelve 500 sin detalles. */
export function handler<C = unknown>(fn: (req: NextRequest, ctx: C) => Promise<Response>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return json({ error: e.code, message: e.message }, { status: e.status });
      await reportError(e, { path: req.nextUrl.pathname });
      return json({ error: 'internal' }, { status: 500 });
    }
  };
}

export function ipKey(req: NextRequest): string {
  return ipHash(clientIp(req)) ?? 'anon';
}
