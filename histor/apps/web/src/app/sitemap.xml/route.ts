import { and, count, eq } from 'drizzle-orm';
import { ACTIVE_LANGUAGES } from '@histor/core/config/languages';
import { articles } from '@histor/core/db/schema';
import { sitemapIndexXml } from '@histor/core/seo/index';
import { db } from '@/lib/server';

export const dynamic = 'force-dynamic';
const PAGE = 5000;

/** Índice de sitemaps: páginas fijas + artículos por idioma, en bloques de 5.000. */
export async function GET() {
  const entries: { loc: string; lastmod?: Date }[] = [{ loc: '/sitemaps/static.xml' }];
  for (const lang of ACTIVE_LANGUAGES) {
    const [{ n }] = await db()
      .select({ n: count() })
      .from(articles)
      .where(and(eq(articles.language, lang), eq(articles.status, 'published'), eq(articles.isDemo, false)));
    const pages = Math.max(1, Math.ceil(Number(n) / PAGE));
    for (let i = 0; i < pages; i++) entries.push({ loc: `/sitemaps/articles-${lang}-${i}.xml` });
  }
  return new Response(sitemapIndexXml(entries), { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=600' } });
}
