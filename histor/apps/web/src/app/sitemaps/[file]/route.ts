import { CATEGORIES } from '@histor/core/config/categories';
import { COUNTRIES } from '@histor/core/config/countries';
import { ACTIVE_LANGUAGES, isActiveLanguage, languageDef } from '@histor/core/config/languages';
import { href, type RouteWord } from '@histor/core/i18n/routes';
import { alternatesForStories, sitemapArticles } from '@histor/core/services/content';
import { absoluteUrl, urlsetXml } from '@histor/core/seo/index';
import { db } from '@/lib/server';

export const dynamic = 'force-dynamic';

const INDEXABLE_PAGES: RouteWord[] = ['howItWorks', 'editorialPolicy', 'corrections', 'sources', 'newsletters', 'subscribe', 'privacy', 'cookies', 'terms', 'subscriptionTerms', 'contact', 'legalNotice'];

function everyLang(build: (l: string) => string) {
  const alternates = Object.fromEntries(ACTIVE_LANGUAGES.map((l) => [languageDef(l).hreflang, absoluteUrl(build(l))]));
  return ACTIVE_LANGUAGES.map((l) => ({ loc: build(l), alternates }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const xml = (body: string) => new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=600' } });
  if (file === 'static.xml') {
    const entries = [
      ...everyLang((l) => href.home(l)),
      ...CATEGORIES.flatMap((c) => everyLang((l) => href.category(l, c.id))),
      ...COUNTRIES.filter((c) => c.edition).flatMap((c) => everyLang((l) => href.country(l, c.code))),
      ...INDEXABLE_PAGES.flatMap((p) => everyLang((l) => href.page(l, p))),
    ];
    return xml(urlsetXml(entries));
  }
  const m = /^articles-([a-z]{2})-(\d{1,4})\.xml$/.exec(file);
  if (!m || !isActiveLanguage(m[1])) return new Response('not found', { status: 404 });
  const rows = await sitemapArticles(db(), m[1], Number(m[2]));
  const alts = await alternatesForStories(db(), [...new Set(rows.map((r) => r.storyId))]);
  const byStory = new Map<number, Record<string, string>>();
  for (const a of alts) {
    const map = byStory.get(a.storyId) ?? {};
    if (a.publishedAt) map[languageDef(a.language).hreflang] = absoluteUrl(href.article(a.language, a.publishedAt, a.slug));
    byStory.set(a.storyId, map);
  }
  return xml(
    urlsetXml(
      rows
        .filter((r) => r.publishedAt)
        .map((r) => {
          const alternates = byStory.get(r.storyId) ?? {};
          return { loc: href.article(r.language, r.publishedAt!, r.slug), lastmod: r.updatedAt, alternates: Object.keys(alternates).length > 1 ? alternates : undefined };
        }),
    ),
  );
}
