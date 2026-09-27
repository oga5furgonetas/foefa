import { z } from 'zod';
import { deviceFromUA, recordEvents } from '@histor/core/analytics/index';
import { countryFromHeaders } from '@histor/core/geo/detect';
import { LIMITS } from '@histor/core/security/ratelimit';
import { checkOrigin } from '@histor/core/auth/csrf';
import { ApiError, handler, ipKey, json, limit, sessionUser } from '@/lib/api';
import { db, parseConsent } from '@/lib/server';

const schema = z.object({
  events: z
    .array(
      z.object({
        type: z.string().max(40),
        articleId: z.number().int().positive().optional().nullable(),
        path: z.string().max(300).optional().nullable(),
        value: z.number().finite().optional().nullable(),
        props: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .max(50),
});

/**
 * Eventos de lectura (sendBeacon). No cambia datos del usuario, pero se
 * exige el mismo origen para que otras webs no inflen las métricas.
 */
export const POST = handler(async (req) => {
  if (!checkOrigin(req.headers.get('origin'), req.headers.get('referer'), req.headers.get('host'))) throw new ApiError(403, 'bad_origin');
  await limit(LIMITS.events(ipKey(req)));
  const text = await req.text();
  if (text.length > 32_000) throw new ApiError(413, 'too_large');
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(JSON.parse(text));
  } catch {
    throw new ApiError(400, 'invalid_input');
  }
  const consent = parseConsent(req.cookies.get('histor_consent')?.value);
  const user = await sessionUser(req);
  let referrerHost: string | null = null;
  try {
    const r = req.headers.get('referer');
    referrerHost = r ? new URL(r).host : null;
  } catch {
    /* sin referer */
  }
  const n = await recordEvents(db(), body.events, {
    userId: user?.id ?? null,
    anonCookie: req.cookies.get('histor_aid')?.value ?? null,
    countryCode: countryFromHeaders((h) => req.headers.get(h)),
    language: req.cookies.get('histor_lang')?.value ?? null,
    device: deviceFromUA(req.headers.get('user-agent')),
    referrerHost,
    consentAnalytics: consent.analytics,
    consentPersonalization: consent.personalization || !!user?.personalization,
  });
  return json({ recorded: n });
});
