/**
 * NORMALIZE + CLASSIFY: idioma, lugares, sección, entidades, origen citado,
 * firma MinHash y fecha del acontecimiento de cada pieza nueva.
 */
import { eq, inArray } from 'drizzle-orm';
import { CITIES } from '../config/cities';
import type { Db } from '../db/client';
import { categories, cities, rawItems, regions, sources } from '../db/schema';
import { detectAttribution, stripDateline } from '../text/attribution';
import { extractDates } from '../text/dates';
import { extractEntities, findPlaces, type PlaceMatch } from '../text/entities';
import { detectLanguage } from '../text/langdetect';
import { nonNewsReason, pressReleaseReason } from '../text/nonnews';
import { minhash } from '../text/similarity';
import type { VPlace } from '../verification/types';
import { classify } from './classify';

type GeoIds = { regionIdByCode: Map<string, number>; cityIdByKey: Map<string, number> };
let geoCache: { at: number; ids: GeoIds } | null = null;

export async function geoIds(db: Db): Promise<GeoIds> {
  if (geoCache && Date.now() - geoCache.at < 10 * 60_000) return geoCache.ids;
  const regs = await db.select({ id: regions.id, code: regions.code }).from(regions);
  const cts = await db.select({ id: cities.id, countryCode: cities.countryCode, slugs: cities.slugs }).from(cities);
  const cityIdByKey = new Map<string, number>();
  for (const c of CITIES) {
    const row = cts.find((x) => x.countryCode === c.countryCode && (x.slugs as Record<string, string>).en === c.slugs.en);
    if (row) cityIdByKey.set(c.key, row.id);
  }
  geoCache = { at: Date.now(), ids: { regionIdByCode: new Map(regs.map((r) => [r.code, r.id])), cityIdByKey } };
  return geoCache.ids;
}

/** Cadenas internacionales: lo que cuentan sin citar lugar no es «de su país». */
const INTERNATIONAL_GROUPS = new Set(['deutsche-welle', 'france-medias-monde', 'euronews', 'al-jazeera', 'un-system', 'un-ec-gdacs']);

/**
 * ¿Es una redacción nacional? Solo entonces, si la pieza no cita ningún lugar, se le supone
 * el país de la fuente. El 29-09-2026 el vuelo orbital de SpaceX y una detención en Ámsterdam
 * salían como noticias de «Reino Unido» porque las contaban la BBC y The Independent.
 */
export function domesticDesk(src: { slug: string; ownershipGroup: string | null; categoryHint: string | null; feedUrl: string | null }): boolean {
  if (src.ownershipGroup && INTERNATIONAL_GROUPS.has(src.ownershipGroup)) return false;
  if (src.ownershipGroup === 'bbc') return src.slug === 'bbc-uk';
  if (src.categoryHint === 'world') return false;
  return !/(world|international|internacional|mundo|monde|welt|esteri)/i.test(`${src.slug} ${src.feedUrl ?? ''}`);
}

/** Desambigua topónimos: prioriza el país de la fuente y, si no, la ciudad más poblada. */
export function resolvePlaces(matches: PlaceMatch[], sourceCountry: string | null): VPlace[] {
  const byName = new Map<string, PlaceMatch[]>();
  for (const m of matches) byName.set(m.name.toLowerCase(), [...(byName.get(m.name.toLowerCase()) ?? []), m]);
  const pop = (m: PlaceMatch) => (m.cityKey ? (CITIES.find((c) => c.key === m.cityKey)?.population ?? 0) : 0);
  const out: VPlace[] = [];
  const countriesMentioned = new Set(matches.filter((m) => m.kind === 'country').map((m) => m.countryCode));
  for (const list of byName.values()) {
    let pick = list[0];
    if (list.length > 1) {
      pick =
        list.find((m) => countriesMentioned.has(m.countryCode) && m.kind !== 'country') ??
        list.find((m) => m.countryCode === sourceCountry) ??
        [...list].sort((a, b) => pop(b) - pop(a))[0];
    }
    if (!out.some((p) => p.kind === pick.kind && p.cityKey === pick.cityKey && p.regionCode === pick.regionCode && p.countryCode === pick.countryCode)) out.push(pick);
  }
  return out;
}

/**
 * Votos por país de una pieza: el titular pesa 3, la entradilla 2 y el cuerpo 1 (cada país una
 * vez por parte), y el país de un medio de sección nacional suma 1,5. Antes, cualquier lugar
 * del cuerpo pesaba lo mismo: la renovación de Fernando Alonso con Aston Martin salió como
 * noticia de «Estados Unidos» por una mención al Gran Premio de Austin (01-10-2026).
 */
export function countryVotes(
  r: { title: string; summary: string | null; contentText: string | null },
  src: { countryCode: string | null; slug: string; ownershipGroup: string | null; categoryHint: string | null; feedUrl: string | null },
): Record<string, number> {
  const votes: Record<string, number> = {};
  const parts: [string | null, number][] = [
    [r.title, 3],
    [r.summary, 2],
    [r.contentText, 1],
  ];
  for (const [text, w] of parts) {
    if (!text) continue;
    const ccs = new Set(resolvePlaces(findPlaces(stripDateline(text)), src.countryCode).map((p) => p.countryCode));
    for (const cc of ccs) votes[cc] = (votes[cc] ?? 0) + w;
  }
  if (src.countryCode && domesticDesk(src)) votes[src.countryCode] = (votes[src.countryCode] ?? 0) + 1.5;
  return votes;
}

export async function normalizeNewItems(db: Db, opts: { limit?: number } = {}): Promise<{ normalized: number; discarded: number }> {
  const rows = await db.select().from(rawItems).where(eq(rawItems.status, 'new')).limit(opts.limit ?? 300);
  if (!rows.length) return { normalized: 0, discarded: 0 };
  const srcRows = await db.select().from(sources).where(inArray(sources.id, [...new Set(rows.map((r) => r.sourceId))]));
  const srcById = new Map(srcRows.map((s) => [s.id, s]));
  const lexicon = (await db.select({ id: categories.id, keywords: categories.keywords }).from(categories)).filter((c) => Object.keys(c.keywords).length);
  const ids = await geoIds(db);
  let normalized = 0;
  let discarded = 0;
  for (const r of rows) {
    const src = srcById.get(r.sourceId);
    // Sin la firma de agencia: «MADRID, 29 (EUROPA PRESS) -» no hace que la noticia sea de Madrid.
    const full = [r.title, r.summary, r.contentText].filter((x): x is string => !!x).map(stripDateline).join('\n');
    if (!src || r.title.trim().length < 8) {
      await db.update(rawItems).set({ status: 'discarded', discardReason: 'sin título útil' }).where(eq(rawItems.id, r.id));
      discarded++;
      continue;
    }
    const notNews = nonNewsReason(r.title, r.url) ?? pressReleaseReason(r.summary) ?? pressReleaseReason(r.contentText);
    if (notNews) {
      await db.update(rawItems).set({ status: 'discarded', discardReason: notNews }).where(eq(rawItems.id, r.id));
      discarded++;
      continue;
    }
    const hint = src.languages.length === 1 ? src.languages[0] : r.language;
    const lang = detectLanguage(full, hint).lang ?? hint ?? null;
    const places = resolvePlaces(findPlaces(full), src.countryCode);
    const countryWeights = countryVotes(r, src);
    const best = [...Object.entries(countryWeights)].sort((a, b) => b[1] - a[1])[0];
    const weighted = best && best[1] >= 2 ? best[0] : null;
    const city = places.find((p) => p.kind === 'city' && (!weighted || p.countryCode === weighted));
    const region = places.find((p) => p.kind === 'region' && (!weighted || p.countryCode === weighted));
    const countryCode = weighted ?? city?.countryCode ?? region?.countryCode ?? places.find((p) => p.kind === 'country')?.countryCode ?? (domesticDesk(src) ? src.countryCode : null);
    const cls = classify(full, lang, { hint: src.categoryHint, lexicon: lexicon.length ? lexicon : undefined });
    const entities = extractEntities(full)
      .slice(0, 15)
      .map((e) => ({ name: e.name, type: e.type }));
    const ref = r.publishedAt ?? r.fetchedAt;
    const claimedDay = extractDates(`${r.title} ${r.summary ?? ''}`, ref).find((d) => d.precision === 'day' && Math.abs(Date.parse(d.iso) - ref.getTime()) < 3 * 86400000);
    const meta = { ...(r.meta ?? {}), places, countryWeights, classification: cls.scores };
    await db
      .update(rawItems)
      .set({
        language: lang,
        countryCode: countryCode ?? null,
        regionId: (city?.regionCode ?? region?.regionCode) ? (ids.regionIdByCode.get((city?.regionCode ?? region?.regionCode)!) ?? null) : null,
        cityId: city?.cityKey ? (ids.cityIdByKey.get(city.cityKey) ?? null) : null,
        categoryId: cls.categoryId,
        entities,
        attributedTo: detectAttribution(`${r.summary ?? ''} ${r.contentText ?? ''}`.trim() || r.title),
        minhash: minhash(full),
        eventDate: claimedDay ? new Date(`${claimedDay.iso}T12:00:00Z`) : ref,
        meta,
        status: 'normalized',
      })
      .where(eq(rawItems.id, r.id));
    normalized++;
  }
  return { normalized, discarded };
}
