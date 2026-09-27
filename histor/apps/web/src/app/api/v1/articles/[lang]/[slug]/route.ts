import { isActiveLanguage } from '@histor/core/config/languages';
import { href } from '@histor/core/i18n/routes';
import { LIMITS } from '@histor/core/security/ratelimit';
import { getArticleDetail } from '@histor/core/services/content';
import { ApiError, handler, ipKey, json, limit } from '@/lib/api';
import { db } from '@/lib/server';

type Ctx = { params: Promise<{ lang: string; slug: string }> };

/** Artículo completo con su recuadro de verificación, fuentes, versiones y correcciones. */
export const GET = handler<Ctx>(async (req, ctx) => {
  await limit(LIMITS.api(ipKey(req)));
  const { lang, slug } = await ctx.params;
  if (!isActiveLanguage(lang)) throw new ApiError(400, 'invalid_lang');
  const d = await getArticleDetail(db(), lang, slug);
  if (!d) throw new ApiError(404, 'not_found');
  const a = d.article;
  return json(
    {
      article: {
        id: a.id,
        url: href.article(lang, a.publishedAt ?? a.updatedAt, a.slug),
        language: a.language,
        headline: a.headline,
        subheadline: a.subheadline,
        summary: a.summary,
        body: a.body,
        verification: a.verification,
        sources: a.sourcesList,
        timeline: a.timeline,
        status: a.status,
        isDeveloping: a.isDeveloping,
        isBreaking: a.isBreaking,
        isDemo: a.isDemo,
        categoryId: a.categoryId,
        countryCode: a.countryCode,
        evidenceConfidence: a.evidenceConfidence,
        version: a.version,
        publishedAt: a.publishedAt,
        updatedAt: a.updatedAt,
        retractionNote: a.retractionNote,
        writer: a.writer,
      },
      author: d.author ? { slug: d.author.slug, kind: d.author.kind, name: (d.author.names as Record<string, string>)[lang] } : null,
      versions: d.versions,
      corrections: d.corrections.map((c) => ({ kind: c.kind, note: c.note, version: c.version, createdAt: c.createdAt })),
      alternates: d.alternates.map((x) => ({ language: x.language, url: href.article(x.language, x.publishedAt ?? a.updatedAt, x.slug) })),
      entities: d.entities,
    },
    { headers: { 'cache-control': 'public, max-age=30, s-maxage=60' } },
  );
});
