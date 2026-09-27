import { anonId } from '@histor/core/analytics/index';
import { isActiveLanguage } from '@histor/core/config/languages';
import { countryFromHeaders } from '@histor/core/geo/detect';
import { recommend } from '@histor/core/reco/index';
import { LIMITS } from '@histor/core/security/ratelimit';
import { ApiError, handler, ipKey, json, limit, sessionUser } from '@/lib/api';
import { db, parseConsent } from '@/lib/server';

/**
 * «Para ti». Solo con consentimiento de personalización (o cuenta con la
 * opción activa). Sin él devuelve una lista vacía: la portada general ya
 * cubre lo importante.
 */
export const GET = handler(async (req) => {
  await limit(LIMITS.api(ipKey(req)));
  const lang = req.nextUrl.searchParams.get('lang') ?? 'en';
  if (!isActiveLanguage(lang)) throw new ApiError(400, 'invalid_lang');
  const n = Math.min(24, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 8));
  const user = await sessionUser(req);
  const consent = parseConsent(req.cookies.get('histor_consent')?.value);
  const allowed = user ? user.personalization : consent.personalization;
  if (!allowed) return json({ items: [], personalized: false });
  const aid = anonId(req.cookies.get('histor_aid')?.value ?? null);
  const profileKey = user ? `u:${user.id}` : aid ? `a:${aid}` : null;
  const items = await recommend(db(), {
    lang,
    profileKey,
    userId: user?.id ?? null,
    countryCode: req.cookies.get('histor_edition')?.value ?? user?.countryCode ?? countryFromHeaders((h) => req.headers.get(h)),
    cityId: user?.cityId ?? null,
    limit: n,
    context: 'for_you',
  });
  return json({
    personalized: true,
    items: items.map((i) => ({ id: i.id, url: i.url, headline: i.headline, summary: i.summary, reason: i.reason, isDeveloping: i.isDeveloping, isDemo: i.isDemo, publishedAt: i.publishedAt, categoryId: i.categoryId })),
  });
});
