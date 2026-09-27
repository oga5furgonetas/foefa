import { isActiveLanguage } from '@histor/core/config/languages';
import { LIMITS } from '@histor/core/security/ratelimit';
import { searchArticles } from '@histor/core/services/content';
import { ApiError, handler, ipKey, json, limit } from '@/lib/api';
import { db } from '@/lib/server';

export const GET = handler(async (req) => {
  await limit(LIMITS.search(ipKey(req)));
  const p = req.nextUrl.searchParams;
  const lang = p.get('lang') ?? 'en';
  if (!isActiveLanguage(lang)) throw new ApiError(400, 'invalid_lang');
  const q = (p.get('q') ?? '').slice(0, 200);
  const offset = Math.max(0, Math.min(1000, Number(p.get('offset')) || 0));
  const r = await searchArticles(db(), lang, q, { categoryId: p.get('category') ?? undefined, limit: 20, offset });
  return json({ total: r.total, items: r.items });
});
