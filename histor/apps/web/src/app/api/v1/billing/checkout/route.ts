import { z } from 'zod';
import { createCheckoutSession } from '@histor/core/billing/index';
import { env } from '@histor/core/env';
import { countryFromHeaders } from '@histor/core/geo/detect';
import { href } from '@histor/core/i18n/routes';
import { isActiveLanguage } from '@histor/core/config/languages';
import { ApiError, assertCsrf, handler, json, parseBody, requireUser } from '@/lib/api';
import { db } from '@/lib/server';

/**
 * Crea una sesión de Stripe Checkout. El precio sale del plan del mercado
 * del lector (configurable en el panel); Histor nunca ve ni guarda datos de tarjeta.
 */
export const POST = handler(async (req) => {
  assertCsrf(req);
  const u = await requireUser(req);
  const b = await parseBody(req, z.object({ interval: z.enum(['month', 'year']), lang: z.string().max(5) }));
  const lang = isActiveLanguage(b.lang) ? b.lang : 'en';
  const base = env().PUBLIC_BASE_URL.replace(/\/$/, '');
  const countryCode = req.cookies.get('histor_edition')?.value ?? u.countryCode ?? countryFromHeaders((h) => req.headers.get(h));
  const r = await createCheckoutSession(db(), u, {
    interval: b.interval,
    countryCode,
    lang,
    successUrl: `${base}${href.page(lang, 'account')}?checkout=success`,
    cancelUrl: `${base}${href.page(lang, 'subscribe')}?checkout=canceled`,
  });
  if ('error' in r) throw new ApiError(r.error === 'already_premium' ? 409 : 503, r.error);
  return json({ url: r.url });
});
