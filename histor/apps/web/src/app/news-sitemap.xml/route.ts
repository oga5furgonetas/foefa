import { href } from '@histor/core/i18n/routes';
import { newsSitemapArticles } from '@histor/core/services/content';
import { newsSitemapXml } from '@histor/core/seo/index';
import { db } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** Sitemap de Google News (últimas 48 h, solo contenido real). */
export async function GET() {
  const rows = await newsSitemapArticles(db());
  const body = newsSitemapXml(rows.filter((r) => r.publishedAt).map((r) => ({ loc: href.article(r.language, r.publishedAt!, r.slug), language: r.language, title: r.headline, publishedAt: r.publishedAt! })));
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
