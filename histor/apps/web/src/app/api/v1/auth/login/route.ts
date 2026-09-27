import { z } from 'zod';
import { loginUser, SESSION_COOKIE, SESSION_DAYS } from '@histor/core/auth/users';
import { LIMITS } from '@histor/core/security/ratelimit';
import { ApiError, assertCsrf, handler, ipKey, json, limit, parseBody } from '@/lib/api';
import { db } from '@/lib/server';

const schema = z.object({ email: z.string().max(320), password: z.string().max(200), totp: z.string().regex(/^\d{6}$/).optional().nullable() });

export const POST = handler(async (req) => {
  assertCsrf(req);
  const b = await parseBody(req, schema);
  await limit(LIMITS.login(ipKey(req)));
  await limit(LIMITS.login(`e:${b.email.toLowerCase()}`));
  const r = await loginUser(db(), b.email, b.password, { userAgent: req.headers.get('user-agent'), ipHash: ipKey(req), totp: b.totp ?? null });
  if (!r.ok) throw new ApiError(r.error === 'locked' ? 429 : 401, r.error);
  const res = json({ ok: true, needsTotp: r.needsTotp, user: { role: r.user.role } });
  res.cookies.set(SESSION_COOKIE, r.token, { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: SESSION_DAYS * 86400 });
  return res;
});
