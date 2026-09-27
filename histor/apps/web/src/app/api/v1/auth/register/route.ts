import { z } from 'zod';
import { registerUser } from '@histor/core/auth/users';
import { isActiveLanguage } from '@histor/core/config/languages';
import { country } from '@histor/core/config/countries';
import { LIMITS } from '@histor/core/security/ratelimit';
import { ApiError, assertCsrf, handler, ipKey, json, limit, parseBody } from '@/lib/api';
import { db } from '@/lib/server';

const schema = z.object({
  email: z.string().max(320),
  password: z.string().max(200),
  name: z.string().max(100).nullable().optional(),
  lang: z.string().max(5),
  country: z.string().max(2).nullable().optional(),
  marketing: z.boolean().optional(),
});

export const POST = handler(async (req) => {
  assertCsrf(req);
  await limit(LIMITS.register(ipKey(req)));
  const b = await parseBody(req, schema);
  const r = await registerUser(db(), {
    email: b.email,
    password: b.password,
    name: b.name ?? null,
    language: isActiveLanguage(b.lang) ? b.lang : 'en',
    countryCode: b.country && country(b.country) ? b.country.toUpperCase() : null,
    marketingConsent: !!b.marketing,
  });
  // «taken» se responde igual que un alta correcta para no revelar qué correos existen,
  // salvo en la forma: el correo de verificación solo llega si la cuenta es nueva.
  if (!r.ok && r.error !== 'taken') throw new ApiError(400, r.error);
  return json({ ok: true }, { status: 201 });
});
