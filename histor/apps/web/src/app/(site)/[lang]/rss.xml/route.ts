import { isActiveLanguage } from '@histor/core/config/languages';
import { dict } from '@histor/core/i18n/dictionaries';
import { href } from '@histor/core/i18n/routes';
import { listArticles } from '@histor/core/services/content';
import { rssXml } from '@histor/core/seo/index';
import { db } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ lang: string }> }) {
  const { lang } = await ctx.params;
  if (!isActiveLanguage(lang)) return new Response('not found', { status: 404 });
  const d = dict(lang);
  const items = await listArticles(db(), { lang, limit: 50 });
  const body = rssXml({
    lang,
    title: `Histor — ${d.tagline}`,
    link: href.home(lang),
    description: d.footer.about,
    items: items.map((a) => ({ title: a.isDemo ? `[DEMO] ${a.headline}` : a.headline, link: a.url, description: a.summary, publishedAt: a.publishedAt, guid: `histor-${a.id}-v${a.version}` })),
  });
  return new Response(body, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
