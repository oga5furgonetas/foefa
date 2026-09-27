import { isActiveLanguage } from '@histor/core/config/languages';
import { LIMITS } from '@histor/core/security/ratelimit';
import { getStoryTimeline } from '@histor/core/services/content';
import { ApiError, handler, ipKey, json, limit } from '@/lib/api';
import { db } from '@/lib/server';

type Ctx = { params: Promise<{ slug: string }> };

/** Cronología pública de una historia: qué fuente dijo qué y cuándo. */
export const GET = handler<Ctx>(async (req, ctx) => {
  await limit(LIMITS.api(ipKey(req)));
  const { slug } = await ctx.params;
  const lang = req.nextUrl.searchParams.get('lang') ?? 'en';
  if (!isActiveLanguage(lang)) throw new ApiError(400, 'invalid_lang');
  const t = await getStoryTimeline(db(), slug, lang);
  if (!t) throw new ApiError(404, 'not_found');
  const s = t.story;
  return json({
    story: { slug: s.slug, state: s.state, evidenceConfidence: s.evidenceConfidence, momentum: s.momentum, independentSourceCount: s.independentSourceCount, isDeveloping: s.isDeveloping, firstSeenAt: s.firstSeenAt, publishedAt: s.publishedAt },
    items: t.items,
    versions: t.versions.map((v) => ({ version: v.version, kind: v.kind, changeSummary: v.changeSummary, createdAt: v.createdAt })),
  });
});
