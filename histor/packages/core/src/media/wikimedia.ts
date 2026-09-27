/**
 * Imagen ilustrativa con licencia libre desde Wikimedia Commons.
 *
 * Solo LUGARES (la ciudad, región o país de la noticia): nunca fotos de personas,
 * que podrían sugerir que alguien sale en una noticia en la que no está. Se toma la
 * imagen principal del artículo de Wikipedia del lugar (suele ser una vista de la
 * ciudad o un monumento) y solo se acepta si está en Commons con licencia libre
 * (CC0, dominio público, CC BY o CC BY-SA; nunca NC ni ND ni «uso legítimo»), en
 * formato de foto (nada de banderas o mapas SVG) y con tamaño suficiente.
 * Se rotula como «ilustrativa», con autor y licencia.
 */
import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import { articles, media, stories } from '../db/schema';
import { userAgent } from '../ingest/fetcher';
import { extractEntities } from '../text/entities';

export type FoundImage = {
  title: string;
  url: string;
  width: number;
  height: number;
  license: string;
  licenseUrl: string | null;
  author: string | null;
  attribution: string;
  sourceUrl: string;
};

type Fetch = typeof fetch;
const FREE_LICENSE = /^(cc0|public domain|pd\b|cc[ -]by(-sa)?[ -]\d)/i;
const NOT_FREE = /\b(nc|nd)\b|non-?commercial|no ?derivs|fair use/i;
const BITMAP = /^image\/(jpeg|png|webp)$/;

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
}

async function getJson(fetchImpl: Fetch, url: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetchImpl(url, { headers: { 'user-agent': userAgent(), accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, any>;
  } catch {
    return null;
  }
}

/** Imagen libre del primer candidato que sea un LUGAR con foto principal válida en Commons. */
export async function findPlaceImage(names: string[], opts: { fetchImpl?: Fetch; wikis?: string[]; minWidth?: number } = {}): Promise<FoundImage | null> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const wikis = opts.wikis ?? ['en'];
  const minWidth = opts.minWidth ?? 640;
  const tried = new Set<string>();
  for (const name of names) {
    for (const wiki of wikis) {
      const key = `${wiki}:${name.toLowerCase()}`;
      if (tried.has(key)) continue;
      tried.add(key);
      const q = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', redirects: '1', prop: 'pageimages|coordinates|pageprops', piprop: 'name', ppprop: 'disambiguation', titles: name });
      const wp = await getJson(fetchImpl, `https://${wiki}.wikipedia.org/w/api.php?${q}`);
      const page = wp?.query?.pages?.[0];
      // Solo lugares (con coordenadas), sin páginas de desambiguación y con imagen principal.
      if (!page || page.missing || !page.pageimage || !page.coordinates?.length || page.pageprops?.disambiguation !== undefined) continue;
      const c = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1200', titles: `File:${page.pageimage}` });
      const cm = await getJson(fetchImpl, `https://commons.wikimedia.org/w/api.php?${c}`);
      const file = cm?.query?.pages?.[0];
      const info = file?.imageinfo?.[0];
      // Si no está en Commons (imagen local «de uso legítimo»), no vale.
      if (!file || file.missing || !info) continue;
      const meta = (info.extmetadata ?? {}) as Record<string, { value?: string }>;
      const license = stripHtml(meta.LicenseShortName?.value ?? '');
      if (!FREE_LICENSE.test(license) || NOT_FREE.test(license) || meta.NonFree?.value === 'true') continue;
      if (!BITMAP.test(info.mime ?? '') || (info.width ?? 0) < minWidth) continue;
      const author = stripHtml(meta.Artist?.value ?? '') || null;
      const title = String(page.title);
      return {
        title,
        url: info.thumburl ?? info.url,
        width: info.thumbwidth ?? info.width,
        height: info.thumbheight ?? info.height,
        license,
        licenseUrl: meta.LicenseUrl?.value ?? null,
        author,
        attribution: `${author ? `${author} / ` : ''}Wikimedia Commons`,
        sourceUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(page.pageimage)}`,
      };
    }
  }
  return null;
}

/**
 * Pone imagen ilustrativa a una historia publicada que no tenga ninguna.
 * Nunca a lo DEMO. Los candidatos son los lugares que nombran sus titulares y resúmenes.
 */
export async function attachStoryImage(db: Db, storyId: number, opts: { fetchImpl?: Fetch } = {}): Promise<'attached' | 'exists' | 'none' | 'skipped'> {
  const [story] = await db.select().from(stories).where(eq(stories.id, storyId)).limit(1);
  if (!story || story.isDemo) return 'skipped';
  const arts = await db.select().from(articles).where(and(eq(articles.storyId, storyId), eq(articles.status, 'published')));
  if (!arts.length) return 'skipped';
  if (arts.some((a) => a.imageId)) return 'exists';
  // Primero el artículo en inglés (la Wikipedia más completa), luego el resto.
  const ordered = [...arts].sort((a, b) => (a.language === 'en' ? -1 : b.language === 'en' ? 1 : 0));
  const names: string[] = [];
  for (const a of ordered) {
    for (const e of extractEntities(`${a.headline}. ${a.summary ?? ''}`, a.language)) {
      if (e.type === 'place' || (e.type === 'other' && /^\p{Lu}/u.test(e.name))) names.push(e.name);
    }
  }
  const wikis = [...new Set(['en', ...ordered.map((a) => a.language)])];
  const found = await findPlaceImage([...new Set(names)].slice(0, 6), { fetchImpl: opts.fetchImpl, wikis });
  if (!found) return 'none';
  const caption = Object.fromEntries(arts.map((a) => [a.language, found.title]));
  const [m] = await db
    .insert(media)
    .values({
      kind: 'image',
      url: found.url,
      width: found.width,
      height: found.height,
      license: found.license,
      licenseUrl: found.licenseUrl,
      attribution: found.attribution,
      author: found.author,
      sourceUrl: found.sourceUrl,
      provider: 'wikimedia',
      isIllustrative: true,
      caption,
      alt: caption,
    })
    .returning({ id: media.id });
  await db.update(articles).set({ imageId: m.id }).where(and(eq(articles.storyId, storyId), isNull(articles.imageId)));
  return 'attached';
}
