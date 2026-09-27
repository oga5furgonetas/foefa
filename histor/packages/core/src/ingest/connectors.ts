/**
 * Conectores modulares. Cada fuente declara su `connector` y su `config`
 * (sin secretos: las claves se leen del entorno). Las redes sociales solo
 * se usan con acceso autorizado por sus APIs oficiales, y todo lo que
 * aportan es una PISTA (tipo social_media), nunca evidencia por sí sola.
 */
import { env } from '../env';
import type { PoliteFetcher } from './fetcher';
import { parseFeed, parseUsgsGeoJson, type ParsedItem } from './parsers';

export type ConnectorSource = {
  id: number;
  connector: string;
  feedUrl: string | null;
  homepageUrl: string;
  etag: string | null;
  lastModified: string | null;
  config: Record<string, unknown>;
};

export type ConnectorResult = {
  items: ParsedItem[];
  status: number;
  url: string;
  notModified: boolean;
  etag: string | null;
  lastModified: string | null;
  tdmReserved: boolean;
  bytes: number;
  durationMs: number;
  error: string | null;
};

export async function runConnector(src: ConnectorSource, fetcher: PoliteFetcher): Promise<ConnectorResult> {
  switch (src.connector) {
    case 'rss':
    case 'atom':
    case 'jsonfeed':
    case 'sitemap':
    case 'html':
      return feedLike(src, fetcher);
    case 'geojson':
      return geojson(src, fetcher);
    case 'reddit':
      return reddit(src, fetcher);
    case 'x':
      return xRecent(src, fetcher);
    case 'youtube':
      return youtube(src, fetcher);
    case 'bluesky':
      return bluesky(src, fetcher);
    case 'mastodon':
      return mastodon(src, fetcher);
    default:
      return empty(src.feedUrl ?? src.homepageUrl, `conector desconocido: ${src.connector}`);
  }
}

function empty(url: string, error: string | null, status = 0): ConnectorResult {
  return { items: [], status, url, notModified: false, etag: null, lastModified: null, tdmReserved: false, bytes: 0, durationMs: 0, error };
}

async function feedLike(src: ConnectorSource, fetcher: PoliteFetcher): Promise<ConnectorResult> {
  const url = src.feedUrl ?? src.homepageUrl;
  const r = await fetcher.get(url, { etag: src.etag, lastModified: src.lastModified });
  const base = { status: r.status, url, notModified: r.notModified, etag: r.etag, lastModified: r.lastModified, tdmReserved: r.tdmReserved, bytes: r.bytes, durationMs: r.durationMs };
  if (r.blockedByRobots) return { ...base, items: [], error: 'robots.txt no permite leer esta URL' };
  if (r.notModified) return { ...base, items: [], error: null };
  if (!r.ok) return { ...base, items: [], error: `HTTP ${r.status}` };
  try {
    return { ...base, items: parseFeed(r.body, r.contentType, url), error: null };
  } catch (e) {
    return { ...base, items: [], error: `no se pudo leer el feed: ${(e as Error).message}` };
  }
}

async function geojson(src: ConnectorSource, fetcher: PoliteFetcher): Promise<ConnectorResult> {
  const url = src.feedUrl!;
  const r = await fetcher.get(url, { etag: src.etag, lastModified: src.lastModified, accept: 'application/geo+json, application/json' });
  const base = { status: r.status, url, notModified: r.notModified, etag: r.etag, lastModified: r.lastModified, tdmReserved: false, bytes: r.bytes, durationMs: r.durationMs };
  if (!r.ok || r.notModified) return { ...base, items: [], error: r.ok ? null : `HTTP ${r.status}` };
  const minMag = Number(src.config.minMagnitude ?? 4.5);
  return { ...base, items: parseUsgsGeoJson(r.body, minMag), error: null };
}

/** Reddit: OAuth "application only" (client credentials). config: { subreddit | query } */
async function reddit(src: ConnectorSource, fetcher: PoliteFetcher): Promise<ConnectorResult> {
  const e = env();
  const url = src.config.subreddit ? `https://oauth.reddit.com/r/${src.config.subreddit}/new?limit=50` : `https://oauth.reddit.com/search?q=${encodeURIComponent(String(src.config.query ?? ''))}&sort=new&limit=50`;
  if (!e.REDDIT_CLIENT_ID || !e.REDDIT_CLIENT_SECRET) return empty(url, 'REDDIT_CLIENT_ID/SECRET no configurados');
  const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${e.REDDIT_CLIENT_ID}:${e.REDDIT_CLIENT_SECRET}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!tokenRes.ok) return empty(url, `token de Reddit: HTTP ${tokenRes.status}`, tokenRes.status);
  const token = ((await tokenRes.json()) as { access_token: string }).access_token;
  const r = await fetcher.get(url, { accept: 'application/json', headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) return empty(url, `HTTP ${r.status}`, r.status);
  const data = JSON.parse(r.body) as { data?: { children?: { data: any }[] } };
  const items: ParsedItem[] = (data.data?.children ?? []).map(({ data: p }) => ({
    guid: p.name,
    url: `https://www.reddit.com${p.permalink}`,
    title: String(p.title),
    summary: p.selftext ? String(p.selftext).slice(0, 600) : null,
    contentText: p.selftext ? String(p.selftext).slice(0, 3000) : null,
    author: p.author ? `u/${p.author}` : null,
    publishedAt: new Date(Number(p.created_utc) * 1000),
    imageUrl: null,
    language: null,
    categories: [String(p.subreddit ?? '')],
  }));
  return { ...empty(url, null, r.status), items, bytes: r.bytes, durationMs: r.durationMs };
}

/** X: API v2 búsqueda reciente con token de aplicación autorizado. config: { query } */
async function xRecent(src: ConnectorSource, fetcher: PoliteFetcher): Promise<ConnectorResult> {
  const e = env();
  const url = `https://api.x.com/2/tweets/search/recent?max_results=50&tweet.fields=created_at,lang,author_id&query=${encodeURIComponent(String(src.config.query ?? ''))}`;
  if (!e.X_BEARER_TOKEN) return empty(url, 'X_BEARER_TOKEN no configurado (se necesita acceso autorizado a la API de X)');
  const r = await fetcher.get(url, { accept: 'application/json', headers: { authorization: `Bearer ${e.X_BEARER_TOKEN}` } });
  if (!r.ok) return empty(url, `HTTP ${r.status}`, r.status);
  const data = JSON.parse(r.body) as { data?: any[] };
  const items: ParsedItem[] = (data.data ?? []).map((t) => ({
    guid: t.id,
    url: `https://x.com/i/web/status/${t.id}`,
    title: String(t.text).slice(0, 200),
    summary: String(t.text),
    contentText: String(t.text),
    author: t.author_id ? `x:${t.author_id}` : null,
    publishedAt: t.created_at ? new Date(t.created_at) : null,
    imageUrl: null,
    language: t.lang ?? null,
    categories: [],
  }));
  return { ...empty(url, null, r.status), items };
}

/** YouTube Data API v3: vídeos recientes de un canal. config: { channelId } */
async function youtube(src: ConnectorSource, fetcher: PoliteFetcher): Promise<ConnectorResult> {
  const e = env();
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&order=date&maxResults=25&type=video&channelId=${encodeURIComponent(String(src.config.channelId ?? ''))}`;
  if (!e.YOUTUBE_API_KEY) return empty(url, 'YOUTUBE_API_KEY no configurada');
  const r = await fetcher.get(`${url}&key=${e.YOUTUBE_API_KEY}`, { accept: 'application/json' });
  if (!r.ok) return empty(url, `HTTP ${r.status}`, r.status);
  const data = JSON.parse(r.body) as { items?: any[] };
  const items: ParsedItem[] = (data.items ?? []).map((v) => ({
    guid: v.id?.videoId,
    url: `https://www.youtube.com/watch?v=${v.id?.videoId}`,
    title: String(v.snippet?.title ?? ''),
    summary: String(v.snippet?.description ?? '').slice(0, 600),
    contentText: null,
    author: v.snippet?.channelTitle ?? null,
    publishedAt: v.snippet?.publishedAt ? new Date(v.snippet.publishedAt) : null,
    imageUrl: null,
    language: null,
    categories: [],
  }));
  return { ...empty(url, null, r.status), items };
}

/** Bluesky: publicaciones de una cuenta (API pública de AppView). config: { actor } */
async function bluesky(src: ConnectorSource, fetcher: PoliteFetcher): Promise<ConnectorResult> {
  const actor = String(src.config.actor ?? '');
  const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?limit=50&actor=${encodeURIComponent(actor)}`;
  if (!actor) return empty(url, 'falta config.actor');
  const r = await fetcher.get(url, { accept: 'application/json' });
  if (!r.ok) return empty(url, `HTTP ${r.status}`, r.status);
  const data = JSON.parse(r.body) as { feed?: { post: any }[] };
  const items: ParsedItem[] = (data.feed ?? []).map(({ post }) => {
    const rkey = String(post.uri).split('/').pop();
    return {
      guid: post.uri,
      url: `https://bsky.app/profile/${post.author?.handle}/post/${rkey}`,
      title: String(post.record?.text ?? '').slice(0, 200),
      summary: String(post.record?.text ?? ''),
      contentText: String(post.record?.text ?? ''),
      author: post.author?.handle ?? null,
      publishedAt: post.record?.createdAt ? new Date(post.record.createdAt) : null,
      imageUrl: null,
      language: post.record?.langs?.[0] ?? null,
      categories: [],
    };
  });
  return { ...empty(url, null, r.status), items };
}

/** Mastodon: estados de una cuenta o de una etiqueta (API pública). config: { instance, accountId | tag } */
async function mastodon(src: ConnectorSource, fetcher: PoliteFetcher): Promise<ConnectorResult> {
  const inst = String(src.config.instance ?? '').replace(/\/$/, '');
  const url = src.config.accountId ? `${inst}/api/v1/accounts/${src.config.accountId}/statuses?limit=40&exclude_replies=true` : `${inst}/api/v1/timelines/tag/${encodeURIComponent(String(src.config.tag ?? ''))}?limit=40`;
  if (!inst) return empty(url, 'falta config.instance');
  const r = await fetcher.get(url, { accept: 'application/json' });
  if (!r.ok) return empty(url, `HTTP ${r.status}`, r.status);
  const data = JSON.parse(r.body) as any[];
  const items: ParsedItem[] = data.map((s) => {
    const txt = String(s.content ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return {
      guid: s.uri,
      url: s.url ?? s.uri,
      title: txt.slice(0, 200),
      summary: txt,
      contentText: txt,
      author: s.account?.acct ?? null,
      publishedAt: s.created_at ? new Date(s.created_at) : null,
      imageUrl: null,
      language: s.language ?? null,
      categories: (s.tags ?? []).map((t: any) => t.name),
    };
  });
  return { ...empty(url, null, r.status), items };
}
