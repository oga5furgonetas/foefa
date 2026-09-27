import { z } from 'zod';
import { resetPassword } from '@histor/core/auth/users';
import { LIMITS } from '@histor/core/security/ratelimit';
import { ApiError, assertCsrf, handler, ipKey, json, limit, parseBody } from '@/lib/api';
import { db } from '@/lib/server';

export const POST = handler(async (req) => {
  assertCsrf(req);
  await limit(LIMITS.reset(ipKey(req)));
  const b = await parseBody(req, z.object({ token: z.string().min(20).max(200), password: z.string().max(200) }));
  const r = await resetPassword(db(), b.token, b.password);
  if (r !== 'ok') throw new ApiError(400, r);
  return json({ ok: true });
});
