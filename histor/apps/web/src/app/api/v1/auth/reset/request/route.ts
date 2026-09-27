import { z } from 'zod';
import { requestPasswordReset } from '@histor/core/auth/users';
import { isActiveLanguage } from '@histor/core/config/languages';
import { LIMITS } from '@histor/core/security/ratelimit';
import { assertCsrf, handler, ipKey, json, limit, parseBody } from '@/lib/api';
import { db } from '@/lib/server';

export const POST = handler(async (req) => {
  assertCsrf(req);
  await limit(LIMITS.reset(ipKey(req)));
  const b = await parseBody(req, z.object({ email: z.string().max(320), lang: z.string().max(5) }));
  await limit(LIMITS.reset(`e:${b.email.toLowerCase()}`));
  await requestPasswordReset(db(), b.email, isActiveLanguage(b.lang) ? b.lang : 'en');
  return json({ ok: true }); // misma respuesta exista o no la cuenta
});
