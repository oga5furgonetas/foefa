import { z } from 'zod';
import { passMfa, SESSION_COOKIE } from '@histor/core/auth/users';
import { LIMITS } from '@histor/core/security/ratelimit';
import { ApiError, assertCsrf, handler, json, limit, parseBody, requireUser } from '@/lib/api';
import { db } from '@/lib/server';

/** Segundo factor para una sesión ya abierta (obligatorio para el panel si el usuario tiene 2FA). */
export const POST = handler(async (req) => {
  assertCsrf(req);
  const u = await requireUser(req);
  await limit(LIMITS.login(`mfa:${u.id}`));
  const { code } = await parseBody(req, z.object({ code: z.string().regex(/^\d{6}$/) }));
  const ok = await passMfa(db(), req.cookies.get(SESSION_COOKIE)!.value, u.id, code);
  if (!ok) throw new ApiError(401, 'totp');
  return json({ ok: true });
});
