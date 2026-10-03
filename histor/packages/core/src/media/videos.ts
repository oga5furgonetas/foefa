/**
 * Vídeos de la noticia (Dani, 03-10-2026: «añadir vídeos de la noticia que encontremos»). Se leen
 * los RSS públicos de los canales de YouTube de medios y agencias, y cada vídeo se empareja con la
 * historia que cuenta lo mismo (palabras del titular en común y al menos un nombre propio). En la
 * noticia se inserta con el reproductor oficial de YouTube (youtube-nocookie) y el nombre del canal;
 * no se descarga ni se copia nada.
 */
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { articles, stories, videos } from '../db/schema';
import { logger } from '../observability/index';
import { decodeEntities, fold } from '../text/normalize';

export type VideoChannel = { id: string; name: string; lang: string };

/** Canales comprobados el 03-10-2026 (su RSS devuelve el nombre del canal). */
export const VIDEO_CHANNELS: VideoChannel[] = [
  { id: 'UC7QZIf0dta-XPXsp9Hv4dTw', name: 'RTVE Noticias', lang: 'es' },
  { id: 'UC_Oni82GyYcabEr3rd-eJkg', name: 'Antena 3 Noticias', lang: 'es' },
  { id: 'UCUdOoVWuWmgo1wByzcsyKDQ', name: 'FRANCE 24 Español', lang: 'es' },
  { id: 'UCyoGb3SMlTlB8CLGVH4c8Rw', name: 'Euronews en español', lang: 'es' },
  { id: 'UC_lEiu6917IJz03TnntWUaQ', name: 'CNN en Español', lang: 'es' },
  { id: 'UCUBIrDsIVzRpKsClMlSlTpQ', name: 'BBC News Mundo', lang: 'es' },
  { id: 'UCY8d83kIW6sK4au73qeZZTw', name: 'AFP Español', lang: 'es' },
  { id: 'UCknLrEdhRCp1aegoMqRaCZg', name: 'DW News', lang: 'en' },
  { id: 'UCSrZ3UV4jOidv8ppoVuvW9Q', name: 'Euronews', lang: 'en' },
  { id: 'UChqUTb7kYRX8-EiaN3XFrSQ', name: 'Reuters', lang: 'en' },
  { id: 'UC52X5wxOL_s5yw0dQk7NtgA', name: 'Associated Press', lang: 'en' },
  { id: 'UC5NOEUbkLheQcaaRldYW5GA', name: 'tagesschau', lang: 'de' },
  { id: 'UCO6K_kkdP-lnSCiO3tPx7WA', name: 'franceinfo', lang: 'fr' },
  { id: 'UCz6E3lF72mb6uoJ-mOlNo2A', name: 'Sky TG24', lang: 'it' },
  { id: 'UCIM-wfyv9hg2oEiA81mQc2A', name: 'RTP Notícias', lang: 'pt' },
  { id: 'UCvdwhh_fDyWccR42-rReZLw', name: 'CNN Brasil', lang: 'pt' },
];

/** Boletines enteros, directos y tertulias: no son el vídeo de una noticia. */
const NOT_A_STORY =
  /(\b(live|en vivo|en directo|directo|ao vivo|in diretta|livestream)\b|noticias del \d|telediario|informativo|journal de|tagesschau \d|tg24 \d|news bulletin|newscast|#shorts|\bpodcast\b|entrevista completa|full interview|tertulia|opini[oó]n|debate:)/i;

type FeedEntry = { videoId: string; title: string; description: string; published: Date };

export function parseYoutubeFeed(xml: string): FeedEntry[] {
  const out: FeedEntry[] = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const videoId = e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = e.match(/<title>([^<]*)<\/title>/)?.[1];
    const published = e.match(/<published>([^<]+)<\/published>/)?.[1];
    const description = e.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] ?? '';
    if (!videoId || !title || !published) continue;
    out.push({ videoId, title: decodeEntities(title).trim(), description: decodeEntities(description).slice(0, 1000), published: new Date(published) });
  }
  return out;
}

/** Título sin el rótulo de urgencia ni el nombre del canal o de la agencia detrás de una barra. */
export function cleanVideoTitle(title: string, channel: string): string {
  const ch = fold(channel).toLowerCase();
  const parts = title
    .split(/\s+\|\s+/)
    .map((x) => x.trim())
    .filter((x) => x && !/^(última hora|ultima hora|breaking( news)?|urgente|en bref|eilmeldung)$/i.test(x))
    // Detrás de la primera barra, el canal («RTVE Noticias») o una firma corta («AFP»).
    .filter((x, i) => i === 0 || (fold(x).toLowerCase() !== ch && x.length > 12));
  return (parts.join(' | ') || title).trim();
}

/** Lee los canales y guarda los vídeos de las últimas 48 h que pueden ser de una noticia. */
export async function ingestVideos(db: Db, fetcher: typeof fetch = fetch): Promise<number> {
  const since = Date.now() - 48 * 3600_000;
  let added = 0;
  for (const ch of VIDEO_CHANNELS) {
    try {
      const res = await fetcher(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) continue;
      const entries = parseYoutubeFeed(await res.text()).filter((e) => e.published.getTime() >= since && !NOT_A_STORY.test(e.title));
      for (const e of entries) {
        const r = await db
          .insert(videos)
          .values({ externalId: e.videoId, channelId: ch.id, channelName: ch.name, language: ch.lang, title: cleanVideoTitle(e.title, ch.name), description: e.description, publishedAt: e.published })
          .onConflictDoNothing()
          .returning({ id: videos.id });
        added += r.length;
      }
    } catch (err) {
      logger.warn({ channel: ch.name, err: String((err as Error).message) }, 'canal de vídeo no leído');
    }
  }
  return added;
}

const STOP = new Set(['sobre', 'segun', 'entre', 'desde', 'hasta', 'durante', 'contra', 'tras', 'cuando', 'donde', 'porque', 'about', 'after', 'before', 'their', 'there', 'which', 'while', 'with', 'nach', 'gegen', 'unter', 'apres', 'avant', 'contre', 'dopo', 'prima', 'contro', 'apos', 'antes', 'noticias', 'news', 'video', 'videos', 'nachrichten', 'notizie', 'noticia']);

/** Raíces (seis letras) de las palabras con peso. */
function stems(s: string): Set<string> {
  return new Set(
    fold(s)
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 5 && !STOP.has(w))
      .map((w) => w.slice(0, 6)),
  );
}

/** Raíces de los nombres propios del título (con mayúscula y no al principio, o siglas). */
function properStems(title: string): Set<string> {
  const words = title.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return new Set(words.filter((w, i) => (i > 0 && /^\p{Lu}/u.test(w)) || /^\p{Lu}{2,}$/u.test(w)).map((w) => fold(w).toLowerCase().slice(0, 6)).filter((w) => w.length >= 3));
}

/** ¿Cuenta el vídeo lo mismo que la historia? Puntuación 0-1, o 0 si no. */
export function videoMatchScore(videoTitle: string, storyHeadlines: string[]): number {
  const v = stems(videoTitle);
  const proper = properStems(videoTitle);
  let best = 0;
  for (const h of storyHeadlines) {
    const s = stems(h);
    if (!v.size || !s.size) continue;
    const shared = [...v].filter((x) => s.has(x));
    // Nombre propio en común: con mayúscula en medio de cualquiera de los dos títulos («Congreso»
    // abre el del vídeo, pero en el titular va en medio).
    const properH = properStems(h);
    if (shared.length < 3 || !shared.some((x) => proper.has(x) || properH.has(x))) continue;
    best = Math.max(best, shared.length / Math.min(v.size, s.size));
  }
  return best >= 0.5 ? Math.round(best * 1000) / 1000 : 0;
}

/** Empareja los vídeos sin historia de las últimas 36 h con las historias publicadas. */
export async function matchVideos(db: Db): Promise<number> {
  const pending = await db
    .select()
    .from(videos)
    .where(and(isNull(videos.storyId), gte(videos.publishedAt, new Date(Date.now() - 36 * 3600_000))));
  if (!pending.length) return 0;
  const recent = await db
    .select({ storyId: articles.storyId, headline: articles.headline, firstSeenAt: stories.firstSeenAt })
    .from(articles)
    .innerJoin(stories, eq(stories.id, articles.storyId))
    .where(and(eq(articles.status, 'published'), eq(articles.isDemo, false), gte(articles.publishedAt, new Date(Date.now() - 48 * 3600_000))));
  const byStory = new Map<number, { heads: string[]; firstSeenAt: Date }>();
  for (const r of recent) {
    const x = byStory.get(r.storyId) ?? { heads: [], firstSeenAt: r.firstSeenAt };
    x.heads.push(r.headline);
    byStory.set(r.storyId, x);
  }
  let matched = 0;
  for (const v of pending) {
    let best: { storyId: number; score: number } | null = null;
    for (const [storyId, s] of byStory) {
      // El vídeo no puede ser de antes de que empezara la historia (con medio día de margen).
      if (v.publishedAt.getTime() < s.firstSeenAt.getTime() - 12 * 3600_000) continue;
      const score = videoMatchScore(v.title, s.heads);
      if (score && (!best || score > best.score)) best = { storyId, score };
    }
    if (!best) continue;
    await db.update(videos).set({ storyId: best.storyId, matchScore: best.score, matchedAt: new Date() }).where(eq(videos.id, v.id));
    matched++;
  }
  return matched;
}

export type StoryVideo = { externalId: string; channelName: string; title: string; language: string; publishedAt: Date };

/** El vídeo de una historia: en el idioma de la noticia si lo hay; si no, el que mejor encaja. */
export async function videoForStory(db: Db, storyId: number, lang: string): Promise<StoryVideo | null> {
  const [v] = await db
    .select({ externalId: videos.externalId, channelName: videos.channelName, title: videos.title, language: videos.language, publishedAt: videos.publishedAt })
    .from(videos)
    .where(eq(videos.storyId, storyId))
    .orderBy(desc(sql`(${videos.language} = ${lang})::int`), desc(videos.matchScore), desc(videos.publishedAt))
    .limit(1);
  return v ?? null;
}

/** Historias con vídeo (para marcarlas en portada). */
export async function storiesWithVideo(db: Db, storyIds: number[]): Promise<Set<number>> {
  if (!storyIds.length) return new Set();
  const rows = await db.selectDistinct({ storyId: videos.storyId }).from(videos).where(inArray(videos.storyId, storyIds));
  return new Set(rows.map((r) => r.storyId!).filter(Boolean));
}
