import { z } from 'zod';
import { isValidEmail } from '@histor/core/auth/users';
import { isActiveLanguage } from '@histor/core/config/languages';
import { subscribeNewsletter } from '@histor/core/newsletter/index';
import { LIMITS } from '@histor/core/security/ratelimit';
import { ApiError, assertCsrf, handler, ipKey, json, limit, parseBody, sessionUser } from '@/lib/api';
import { db } from '@/lib/server';

/** Alta con doble confirmación (se envía un correo; nada se activa sin el clic). */
export const POST = handler(async (req) => {
  assertCsrf(req);
  await limit(LIMITS.newsletter(ipKey(req)));
  const b = await parseBody(req, z.object({ slug: z.string().max(80), email: z.string().max(320), lang: z.string().max(5) }));
  if (!isValidEmail(b.email.trim().toLowerCase())) throw new ApiError(400, 'invalid_email');
  const u = await sessionUser(req);
  const status = await subscribeNewsletter(db(), b.slug, b.email, { lang: isActiveLanguage(b.lang) ? b.lang : 'en', userId: u?.id ?? null });
  if (status === 'not_found') throw new ApiError(404, 'not_found');
  if (status === 'premium_required') throw new ApiError(402, 'premium_required');
  return json({ status });
});
