/**
 * Parsers de formatos de sindicación: RSS 2.0, RSS 1.0 (RDF), Atom,
 * JSON Feed, Google News Sitemap, GeoJSON (USGS) y metadatos HTML
 * (Open Graph / JSON-LD). Solo extraen hechos y metadatos; el texto
 * completo, si el feed lo trae, se usa internamente y nunca se publica.
 */
import { XMLParser } from 'fast-xml-parser';
import { parseFeedDate } from '../text/dates';
import { decodeEntities, htmlToText, truncate } from '../text/normalize';

export type ParsedItem = {
  guid: string | null;
  url: string;
  title: string;
  summary: string | null;
  contentText: string | null;
  author: string | null;
  publishedAt: Date | null;
  imageUrl: string | null;
  language: string | null;
  categories: string[];
  structured?: Record<string, unknown> | null;
};

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataPropName: '#cdata',
  processEntities: true,
  htmlEntities: true,
  trimValues: true,
  isArray: (name) => ['item', 'entry', 'url', 'link', 'category', 'media:content', 'media:thumbnail', 'enclosure'].includes(name),
});

const MAX_TEXT = 6000;

function text(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return text(o['#cdata'] ?? o['#text'] ?? '');
  }
  return '';
}

/**
 * Titular sin la etiqueta de directo del medio («Live:», «En directo:», «Liveticker:»…):
 * es formato de su web, no parte del hecho, y estorba para agrupar y redactar.
 */
function cleanTitle(s: string): string {
  return clean(s).replace(LIVE_PREFIX, '').trim();
}

const LIVE_PREFIX = /^(live(?:blog|ticker| updates?)?|en directo|en vivo|directo|en direct|direct|live-ticker|ticker|diretta|in diretta|ao vivo|minuto a minuto)\s*[:|–—-]\s*/i;

function clean(s: string): string {
  // Cada párrafo acaba en frase: «…governments</p><p>Two giant…» no puede quedar «governments Two giant».
  const lines = decodeEntities(htmlToText(s))
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return lines.map((l, i) => (i < lines.length - 1 && !/[.!?…:;»"”)]$/.test(l) ? `${l}.` : l)).join(' ');
}

export function detectFormat(body: string, contentType: string | null): 'rss' | 'atom' | 'rdf' | 'jsonfeed' | 'geojson' | 'sitemap' | 'html' | 'unknown' {
  const head = body.slice(0, 2000).trimStart();
  if (head.startsWith('{')) {
    if (/"version"\s*:\s*"https:\/\/jsonfeed\.org/.test(head)) return 'jsonfeed';
    if (/"type"\s*:\s*"FeatureCollection"/.test(body.slice(0, 5000))) return 'geojson';
    return 'unknown';
  }
  if (/<rss[\s>]/i.test(head)) return 'rss';
  if (/<feed[\s>]/i.test(head)) return 'atom';
  if (/<rdf:RDF/i.test(head)) return 'rdf';
  if (/<urlset/i.test(head)) return 'sitemap';
  if (/<html/i.test(head) || contentType?.includes('text/html')) return 'html';
  return 'unknown';
}

export function parseFeed(body: string, contentType: string | null = null, baseUrl?: string): ParsedItem[] {
  const fmt = detectFormat(body, contentType);
  switch (fmt) {
    case 'rss':
    case 'rdf':
      return parseRss(body);
    case 'atom':
      return parseAtom(body, baseUrl);
    case 'jsonfeed':
      return parseJsonFeed(body);
    case 'geojson':
      return parseUsgsGeoJson(body);
    case 'sitemap':
      return parseNewsSitemap(body);
    case 'html':
      return baseUrl ? [parseHtmlMeta(body, baseUrl)].filter((x): x is ParsedItem => !!x) : [];
    default:
      return [];
  }
}

export function parseRss(body: string): ParsedItem[] {
  const doc = xml.parse(body) as Record<string, any>;
  const channel = doc.rss?.channel ?? doc['rdf:RDF']?.channel ?? {};
  const items: any[] = doc.rss?.channel?.item ?? doc['rdf:RDF']?.item ?? [];
  const lang = text(channel.language).slice(0, 2).toLowerCase() || null;
  return items
    .map((it): ParsedItem | null => {
      const link = text(it.link) || text(it.guid);
      const title = cleanTitle(text(it.title));
      if (!link || !title) return null;
      const content = text(it['content:encoded']);
      const desc = text(it.description);
      const media = it['media:content']?.[0]?.['@_url'] ?? it['media:thumbnail']?.[0]?.['@_url'] ?? it.enclosure?.find((e: any) => String(e['@_type'] ?? '').startsWith('image'))?.['@_url'];
      return {
        guid: text(it.guid) || null,
        url: link.trim(),
        title,
        summary: desc ? truncate(clean(desc), 600) : null,
        contentText: content ? truncate(clean(content), MAX_TEXT) : null,
        author: clean(text(it['dc:creator'] ?? it.author)) || null,
        publishedAt: parseFeedDate(text(it.pubDate ?? it['dc:date'])),
        imageUrl: media ?? null,
        language: lang,
        categories: (it.category ?? []).map((c: unknown) => clean(text(c))).filter(Boolean),
      };
    })
    .filter((x): x is ParsedItem => !!x);
}

export function parseAtom(body: string, baseUrl?: string): ParsedItem[] {
  const doc = xml.parse(body) as Record<string, any>;
  const feed = doc.feed ?? {};
  const lang = String(feed['@_xml:lang'] ?? '').slice(0, 2).toLowerCase() || null;
  return (feed.entry ?? [])
    .map((e: any): ParsedItem | null => {
      const links: any[] = e.link ?? [];
      const alt = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0];
      let href = alt?.['@_href'] ?? '';
      if (href && baseUrl && !/^https?:/.test(href)) href = new URL(href, baseUrl).toString();
      const title = cleanTitle(text(e.title));
      if (!href || !title) return null;
      const content = text(e.content);
      return {
        guid: text(e.id) || null,
        url: href,
        title,
        summary: text(e.summary) ? truncate(clean(text(e.summary)), 600) : null,
        contentText: content ? truncate(clean(content), MAX_TEXT) : null,
        author: clean(text(e.author?.name)) || null,
        publishedAt: parseFeedDate(text(e.published) || text(e.updated)),
        imageUrl: links.find((l) => l['@_rel'] === 'enclosure' && String(l['@_type'] ?? '').startsWith('image'))?.['@_href'] ?? null,
        language: lang,
        categories: (e.category ?? []).map((c: any) => String(c['@_term'] ?? '')).filter(Boolean),
      };
    })
    .filter((x: ParsedItem | null): x is ParsedItem => !!x);
}

export function parseJsonFeed(body: string): ParsedItem[] {
  const doc = JSON.parse(body) as { language?: string; items?: any[] };
  return (doc.items ?? [])
    .map((it): ParsedItem | null => {
      const url = it.url ?? it.external_url;
      const title = it.title ? cleanTitle(String(it.title)) : '';
      if (!url || !title) return null;
      const content = it.content_text ?? (it.content_html ? htmlToText(it.content_html) : '');
      return {
        guid: it.id != null ? String(it.id) : null,
        url,
        title,
        summary: it.summary ? truncate(clean(it.summary), 600) : null,
        contentText: content ? truncate(clean(content), MAX_TEXT) : null,
        author: it.authors?.[0]?.name ?? it.author?.name ?? null,
        publishedAt: parseFeedDate(it.date_published ?? it.date_modified),
        imageUrl: it.image ?? it.banner_image ?? null,
        language: (it.language ?? doc.language ?? '').slice(0, 2) || null,
        categories: it.tags ?? [],
      };
    })
    .filter((x): x is ParsedItem => !!x);
}

/** USGS GeoJSON (earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php). */
export function parseUsgsGeoJson(body: string, minMagnitude = 4.5): ParsedItem[] {
  const doc = JSON.parse(body) as { features?: any[] };
  return (doc.features ?? [])
    .filter((f) => f?.properties?.type === 'earthquake' && Number(f.properties.mag) >= minMagnitude)
    .map((f): ParsedItem => {
      const p = f.properties;
      const [lon, lat, depth] = f.geometry?.coordinates ?? [];
      const time = new Date(Number(p.time));
      const title = String(p.title ?? `M ${p.mag} - ${p.place}`);
      const summary = `A magnitude ${Number(p.mag).toFixed(1)} earthquake was recorded ${p.place ? `${p.place}` : ''} at ${time.toISOString().replace('T', ' ').slice(0, 16)} UTC at a depth of ${Number(depth).toFixed(1)} km, according to the USGS.`;
      return {
        guid: String(f.id),
        url: String(p.url ?? `https://earthquake.usgs.gov/earthquakes/eventpage/${f.id}`),
        title,
        summary,
        contentText: summary,
        author: 'USGS',
        publishedAt: new Date(Number(p.updated ?? p.time)),
        imageUrl: null,
        language: 'en',
        categories: ['earthquake'],
        structured: {
          type: 'earthquake',
          magnitude: Number(p.mag),
          place: p.place ?? null,
          time: time.toISOString(),
          depthKm: depth == null ? null : Number(depth),
          lat,
          lon,
          tsunami: Number(p.tsunami) === 1,
          alert: p.alert ?? null,
          significance: p.sig ?? null,
        },
      };
    });
}

/** Google News sitemap: <url><loc/><news:news><news:title/><news:publication_date/></news:news></url> */
export function parseNewsSitemap(body: string): ParsedItem[] {
  const doc = xml.parse(body) as Record<string, any>;
  return (doc.urlset?.url ?? [])
    .map((u: any): ParsedItem | null => {
      const news = u['news:news'];
      const title = clean(text(news?.['news:title']));
      const loc = text(u.loc);
      if (!loc || !title) return null;
      return {
        guid: loc,
        url: loc,
        title,
        summary: null,
        contentText: null,
        author: null,
        publishedAt: parseFeedDate(text(news?.['news:publication_date']) || text(u.lastmod)),
        imageUrl: null,
        language: text(news?.['news:publication']?.['news:language']).slice(0, 2) || null,
        categories: [],
      };
    })
    .filter((x: ParsedItem | null): x is ParsedItem => !!x);
}

/** Metadatos de una página (comunicados de prensa): Open Graph + JSON-LD. Sin copiar el cuerpo. */
export function parseHtmlMeta(html: string, url: string): ParsedItem | null {
  const meta = (name: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, 'i');
    const m = html.match(re);
    return m ? decodeEntities(m[1] ?? m[2] ?? '').trim() : '';
  };
  let ld: Record<string, any> | null = null;
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(m[1]);
      const list = Array.isArray(parsed) ? parsed : parsed['@graph'] ?? [parsed];
      ld = list.find((x: any) => /Article|NewsArticle|PressRelease|Report/.test(String(x['@type']))) ?? ld;
    } catch {
      /* JSON-LD roto: se ignora */
    }
  }
  const title = String(ld?.headline ?? meta('og:title') ?? '').trim() || (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '').trim();
  if (!title) return null;
  const desc = String(ld?.description ?? meta('og:description') ?? meta('description') ?? '');
  const lang = (html.match(/<html[^>]+lang=["']([a-zA-Z-]+)["']/i)?.[1] ?? '').slice(0, 2).toLowerCase() || null;
  return {
    guid: url,
    url: meta('og:url') || url,
    title: cleanTitle(title),
    summary: desc ? truncate(clean(desc), 600) : null,
    contentText: null,
    author: typeof ld?.author === 'object' ? (ld.author.name ?? null) : (meta('author') || null),
    publishedAt: parseFeedDate(ld?.datePublished ?? meta('article:published_time')),
    imageUrl: meta('og:image') || null,
    language: lang,
    categories: [],
  };
}
