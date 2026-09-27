/**
 * NORMALIZE + CLASSIFY: idioma, lugares, sección, entidades, origen citado,
 * firma MinHash y fecha del acontecimiento de cada pieza nueva.
 */
import { eq, inArray } from 'drizzle-orm';
import { CITIES } from '../config/cities';
import type { Db } from '../db/client';
import { categories, cities, rawItems, regions, sources } from '../db/schema';
import { detectAttribution } from '../text/attribution';
import { extractDates } from '../text/dates';
import { extractEntities, findPlaces, type PlaceMatch } from '../text/entities';
import { detectLanguage } from '../text/langdetect';
import { nonNewsReason } from '../text/nonnews';
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
    const full = [r.title, r.summary, r.contentText].filter(Boolean).join('\n');
    if (!src || r.title.trim().length < 8) {
      await db.update(rawItems).set({ status: 'discarded', discardReason: 'sin título útil' }).where(eq(rawItems.id, r.id));
      discarded++;
      continue;
    }
    const notNews = nonNewsReason(r.title, r.url);
    if (notNews) {
      await db.update(rawItems).set({ status: 'discarded', discardReason: notNews }).where(eq(rawItems.id, r.id));
      discarded++;
      continue;
    }
    const hint = src.languages.length === 1 ? src.languages[0] : r.language;
    const lang = detectLanguage(full, hint).lang ?? hint ?? null;
    const places = resolvePlaces(findPlaces(full), src.countryCode);
    const city = places.find((p) => p.kind === 'city');
    const region = places.find((p) => p.kind === 'region');
    const countryCode = city?.countryCode ?? region?.countryCode ?? places.find((p) => p.kind === 'country')?.countryCode ?? src.countryCode;
    const cls = classify(full, lang, { hint: src.categoryHint, lexicon: lexicon.length ? lexicon : undefined });
    const entities = extractEntities(full)
      .slice(0, 15)
      .map((e) => ({ name: e.name, type: e.type }));
    const ref = r.publishedAt ?? r.fetchedAt;
    const claimedDay = extractDates(`${r.title} ${r.summary ?? ''}`, ref).find((d) => d.precision === 'day' && Math.abs(Date.parse(d.iso) - ref.getTime()) < 3 * 86400000);
    const meta = { ...(r.meta ?? {}), places, classification: cls.scores };
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
