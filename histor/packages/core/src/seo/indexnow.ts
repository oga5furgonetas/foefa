/**
 * IndexNow: avisa al momento a Bing (y con él a Yahoo, DuckDuckGo, Yandex, Seznam, Naver…)
 * de cada noticia publicada o actualizada, en vez de esperar a que la rastreen. Gratis y sin
 * cuenta: basta con una clave (`INDEXNOW_KEY`) servida en /indexnow-key.txt.
 * Google no usa IndexNow: para él están los sitemaps y el sitemap de noticias.
 */
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { articles } from '../db/schema';
import { env } from '../env';
import { href } from '../i18n/routes';
import { absoluteUrl } from './index';

export async function pingIndexNow(urls: string[], opts: { fetchImpl?: typeof fetch } = {}): Promise<'sent' | 'skipped' | `error ${number}` | 'error'> {
  const key = env().INDEXNOW_KEY;
  const base = env().PUBLIC_BASE_URL;
  if (!key || !urls.length || /localhost|127\.0\.0\.1/.test(base) || env().DEMO_MODE) return 'skipped';
  const host = new URL(base).host;
  try {
    const res = await (opts.fetchImpl ?? fetch)('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: absoluteUrl('/indexnow-key.txt'), urlList: urls.slice(0, 10_000) }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok || res.status === 202 ? 'sent' : `error ${res.status}`;
  } catch {
    return 'error';
  }
}

/** URLs públicas (todos los idiomas) de una historia publicada. */
export async function storyUrls(db: Db, storyId: number): Promise<string[]> {
  const rows = await db
    .select({ language: articles.language, slug: articles.slug, publishedAt: articles.publishedAt, isDemo: articles.isDemo })
    .from(articles)
    .where(and(eq(articles.storyId, storyId), eq(articles.status, 'published')));
  return rows.filter((r) => !r.isDemo && r.publishedAt).map((r) => absoluteUrl(href.article(r.language, r.publishedAt!, r.slug)));
}
