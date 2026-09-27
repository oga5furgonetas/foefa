import { CATEGORY_IDS } from '@histor/core/config/categories';
import { isActiveLanguage } from '@histor/core/config/languages';
import { LIMITS } from '@histor/core/security/ratelimit';
import { listArticles } from '@histor/core/services/content';
import { ApiError, handler, ipKey, json, limit } from '@/lib/api';
import { db } from '@/lib/server';

/** GET /api/v1/articles?lang=es&category=economy&country=ES&breaking=1&order=recent|importance|momentum&limit=20&offset=0 */
export const GET = handler(async (req) => {
  await limit(LIMITS.api(ipKey(req)));
  const p = req.nextUrl.searchParams;
  const lang = p.get('lang') ?? 'en';
  if (!isActiveLanguage(lang)) throw new ApiError(400, 'invalid_lang');
  const category = p.get('category') ?? undefined;
  if (category && !CATEGORY_IDS.includes(category)) throw new ApiError(400, 'invalid_category');
  const order = p.get('order');
  const items = await listArticles(db(), {
    lang,
    categoryId: category,
    countryCode: p.get('country')?.toUpperCase() || undefined,
    breaking: p.get('breaking') === '1',
    orderBy: order === 'importance' || order === 'momentum' ? order : 'recent',
    since: p.get('since') ? new Date(p.get('since')!) : undefined,
    limit: Math.min(50, Math.max(1, Number(p.get('limit')) || 20)),
    offset: Math.max(0, Math.min(5000, Number(p.get('offset')) || 0)),
  });
  return json({ items }, { headers: { 'cache-control': 'public, max-age=30, s-maxage=60' } });
});
