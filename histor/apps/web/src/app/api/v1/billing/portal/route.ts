import { z } from 'zod';
import { createPortalSession } from '@histor/core/billing/index';
import { env } from '@histor/core/env';
import { href } from '@histor/core/i18n/routes';
import { isActiveLanguage } from '@histor/core/config/languages';
import { ApiError, assertCsrf, handler, json, parseBody, requireUser } from '@/lib/api';
import { db } from '@/lib/server';

/** Portal de cliente de Stripe: cambiar tarjeta, cancelar, descargar facturas. */
export const POST = handler(async (req) => {
  assertCsrf(req);
  const u = await requireUser(req);
  const b = await parseBody(req, z.object({ lang: z.string().max(5) }));
  const lang = isActiveLanguage(b.lang) ? b.lang : 'en';
  const url = await createPortalSession(db(), u.id, `${env().PUBLIC_BASE_URL.replace(/\/$/, '')}${href.page(lang, 'account')}`);
  if (!url) throw new ApiError(503, 'payments_disabled');
  return json({ url });
});
