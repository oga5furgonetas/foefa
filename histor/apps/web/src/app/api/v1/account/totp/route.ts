import { z } from 'zod';
import { generateTotpSecret, otpauthUri } from '@histor/core/auth/totp';
import { enableTotp, passMfa, SESSION_COOKIE } from '@histor/core/auth/users';
import { LIMITS } from '@histor/core/security/ratelimit';
import { ApiError, assertCsrf, handler, json, limit, parseBody, requireUser } from '@/lib/api';
import { db } from '@/lib/server';

/** Paso 1: genera un secreto (no se guarda hasta confirmar un código válido). */
export const POST = handler(async (req) => {
  assertCsrf(req);
  const u = await requireUser(req);
  const secret = generateTotpSecret();
  return json({ secret, uri: otpauthUri(secret, u.email) });
});

/** Paso 2: confirma con un código y activa el 2FA. */
export const PUT = handler(async (req) => {
  assertCsrf(req);
  const u = await requireUser(req);
  await limit(LIMITS.login(`totp:${u.id}`));
  const b = await parseBody(req, z.object({ secret: z.string().regex(/^[A-Z2-7]{16,64}$/), code: z.string().regex(/^\d{6}$/) }));
  if (!(await enableTotp(db(), u.id, b.secret, b.code))) throw new ApiError(400, 'totp');
  // La sesión actual acaba de demostrar el segundo factor.
  await passMfa(db(), req.cookies.get(SESSION_COOKIE)!.value, u.id, b.code);
  return json({ ok: true });
});
