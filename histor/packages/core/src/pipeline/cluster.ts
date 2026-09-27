/**
 * CLUSTER + DEDUPLICATE: cada pieza se une a la historia (story cluster)
 * que cuenta el mismo acontecimiento, o abre una nueva. Así no se publican
 * 20 artículos de lo mismo: una historia = un artículo por idioma, que se
 * va actualizando.
 *
 * similitud = 0,5·coseno(términos) + 0,35·entidades compartidas + 0,15·lugar
 * (+ atajo: si es copia casi literal de una pieza de la historia, se une).
 */
import { and, desc, eq, gt, inArray, notInArray, sql } from 'drizzle-orm';
import type { EditorialSettings } from '../config/settings';
import type { Db } from '../db/client';
import { rawItems, stories, storyItems } from '../db/schema';
import { entityKey, findPlaces } from '../text/entities';
import { slugify } from '../text/normalize';
import { cosine, mergeVectors, minhashSimilarity, sharedNumberTerms, termVector, type TermVector } from '../text/similarity';
import { placeKey } from '../verification/claims';
import type { VPlace } from '../verification/types';

const WINDOW_HOURS = 72;

type Candidate = {
  id: number;
  centroid: TermVector;
  entityNames: string[];
  countryCode: string | null;
  lastItemAt: Date;
  placeKeys: Set<string>;
  minhashes: number[][];
  isDemo: boolean;
};

export function storySimilarity(
  item: { vec: TermVector; entities: string[]; places: string[]; minhash: number[] | null; at: Date },
  c: Candidate,
  idf?: (term: string) => number,
): number {
  for (const mh of c.minhashes) if (minhashSimilarity(item.minhash, mh) >= 0.6) return 1;
  const cos = cosine(item.vec, c.centroid, idf);
  const ents = new Set(c.entityNames);
  // Los topónimos solos no hacen que dos hechos sean el mismo: cuentan aparte.
  const placeNames = new Set(item.places.map((p) => p.split(':')[1]));
  const sharedEnts = item.entities.filter((e) => ents.has(e) && !placeNames.has(e.replace(/\s+/g, '-')));
  const entScore = item.entities.length ? sharedEnts.length / Math.min(item.entities.length, Math.max(1, ents.size)) : 0;
  const placeScore = item.places.length ? item.places.filter((p) => c.placeKeys.has(p)).length / item.places.length : 0;
  const hours = Math.abs(item.at.getTime() - c.lastItemAt.getTime()) / 3600000;
  const timeFactor = hours <= 24 ? 1 : hours <= 48 ? 0.85 : 0.7;
  // Cifras compartidas (≥ 2) + mismo lugar: el mismo hecho contado en otro idioma.
  const nums = sharedNumberTerms(item.vec, c.centroid);
  const crossLingual = nums >= 2 && placeScore > 0 ? 0.25 + 0.1 * Math.min(3, nums) : 0;
  // Sin ninguna entidad compartida (más allá del lugar) solo se agrupa con mucho parecido léxico o con ese ancla.
  // Una cifra compartida (≥ 10, no años) en el mismo lugar ayuda, pero solo junto con parecido
  // léxico: «Veintisiete muertos en dos tiroteos en Sudáfrica» / «…dos tiroteos… dejan 27 muertos».
  const numPlace = nums >= 1 && placeScore > 0 ? 0.15 : 0;
  if (!sharedEnts.length && cos < 0.55 && !crossLingual && !numPlace) return Math.min(0.3, cos) * timeFactor;
  return Math.max(0.5 * cos + 0.35 * Math.min(1, entScore) + 0.15 * placeScore + numPlace, crossLingual + 0.15 * placeScore) * timeFactor;
}

/**
 * Vector para comparar con las historias, sin las palabras de los topónimos: «Arábia
 * Saudita» pesaba tanto que unía el cierre de colegios en Riad con las ejecuciones en el
 * país (27-09-2026). El lugar ya cuenta aparte, con su propio peso.
 */
export function comparableVector(text: string, lang?: string, vec: TermVector = termVector(text, lang)): TermVector {
  const placeTerms = new Set(Object.keys(termVector(findPlaces(text).map((p) => p.name).join(' '), lang)));
  return Object.fromEntries(Object.entries(vec).filter(([t]) => !placeTerms.has(t)));
}

/** IDF sobre los centroides candidatos: las palabras que salen en todas las historias pesan poco. */
export function idfFrom(vectors: TermVector[]): (term: string) => number {
  const df = new Map<string, number>();
  for (const v of vectors) for (const t of Object.keys(v)) df.set(t, (df.get(t) ?? 0) + 1);
  const n = vectors.length;
  return (t: string) => Math.log((n + 1) / ((df.get(t) ?? 0) + 1)) + 1;
}

export async function clusterItems(db: Db, settings: EditorialSettings, opts: { limit?: number; now?: Date } = {}): Promise<{ attached: number; created: number }> {
  const now = opts.now ?? new Date();
  const items = await db.select().from(rawItems).where(eq(rawItems.status, 'normalized')).orderBy(rawItems.publishedAt).limit(opts.limit ?? 300);
  if (!items.length) return { attached: 0, created: 0 };

  const since = new Date(now.getTime() - WINDOW_HOURS * 3600000);
  const recent = await db
    .select()
    .from(stories)
    .where(and(gt(stories.lastItemAt, since), notInArray(stories.state, ['BLOCKED'])))
    .orderBy(desc(stories.lastItemAt))
    .limit(800);
  const candidates: Candidate[] = [];
  const storyIds = recent.map((s) => s.id);
  const members = storyIds.length
    ? await db
        .select({ storyId: storyItems.storyId, minhash: rawItems.minhash, meta: rawItems.meta })
        .from(storyItems)
        .innerJoin(rawItems, eq(rawItems.id, storyItems.itemId))
        .where(inArray(storyItems.storyId, storyIds))
    : [];
  for (const s of recent) {
    const mem = members.filter((m) => m.storyId === s.id);
    candidates.push({
      id: s.id,
      centroid: s.centroid,
      entityNames: s.entityNames,
      countryCode: s.countryCode,
      lastItemAt: s.lastItemAt,
      placeKeys: new Set(mem.flatMap((m) => (((m.meta as { places?: VPlace[] })?.places ?? []) as VPlace[]).map(placeKey))),
      minhashes: mem.map((m) => m.minhash).filter((x): x is number[] => !!x),
      isDemo: s.isDemo,
    });
  }

  let attached = 0;
  let created = 0;
  // Piezas actualizadas que ya pertenecían a una historia: se reverifica esa historia.
  const already = await db.select({ itemId: storyItems.itemId, storyId: storyItems.storyId }).from(storyItems).where(inArray(storyItems.itemId, items.map((i) => i.id)));
  const storyOf = new Map(already.map((a) => [a.itemId, a.storyId]));
  for (const it of items) {
    const prevStory = storyOf.get(it.id);
    if (prevStory) {
      await db.update(stories).set({ nextCheckAt: now, updatedAt: now }).where(eq(stories.id, prevStory));
      await db.update(rawItems).set({ status: 'clustered' }).where(eq(rawItems.id, it.id));
      attached++;
      continue;
    }
    const full = [it.title, it.summary, it.contentText].filter(Boolean).join(' ');
    const vec = termVector(full, it.language ?? undefined);
    const simVec = comparableVector(full, it.language ?? undefined, vec);
    // Sin topónimos: compartir «Ucrania» o «Marruecos» no hace que dos hechos sean el mismo
    // (el lugar ya cuenta aparte, con su peso). Visto el 27-09-2026: Lavrov + una alerta de inundación.
    const ents = it.entities.filter((e) => e.type !== 'place' && (e.type !== 'other' || e.name.includes(' '))).map((e) => entityKey(e.name));
    const places = (((it.meta as { places?: VPlace[] })?.places ?? []) as VPlace[]).map(placeKey);
    const at = it.publishedAt ?? it.fetchedAt;
    let best: { c: Candidate; sim: number } | null = null;
    const idf = idfFrom(candidates.map((c) => c.centroid));
    for (const c of candidates) {
      if (c.isDemo !== it.isDemo) continue; // lo DEMO jamás se mezcla con lo real
      const sim = storySimilarity({ vec: simVec, entities: ents, places, minhash: it.minhash, at }, c, idf);
      if (!best || sim > best.sim) best = { c, sim };
    }
    let storyId: number;
    let similarity = 1;
    if (best && best.sim >= settings.clusterThreshold) {
      storyId = best.c.id;
      similarity = best.sim;
      const c = best.c;
      c.centroid = mergeVectors(c.centroid, vec);
      c.entityNames = [...new Set([...c.entityNames, ...ents])].slice(0, 40);
      c.lastItemAt = at > c.lastItemAt ? at : c.lastItemAt;
      for (const p of places) c.placeKeys.add(p);
      if (it.minhash) c.minhashes.push(it.minhash);
      await db
        .update(stories)
        .set({
          centroid: c.centroid,
          entityNames: c.entityNames,
          lastItemAt: c.lastItemAt,
          itemCount: sql`${stories.itemCount} + 1`,
          languages: sql`(SELECT array_agg(DISTINCT x) FROM unnest(array_append(${stories.languages}, ${it.language ?? 'und'}::text)) AS x)`,
          nextCheckAt: now,
          updatedAt: now,
        })
        .where(eq(stories.id, storyId));
      attached++;
    } else {
      const base = slugify(it.title, 70) || 'historia';
      const rows = await db
        .insert(stories)
        .values({
          slug: `${base}-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
          state: 'DISCOVERED',
          headlineHint: it.title,
          categoryId: it.categoryId,
          countryCode: it.countryCode,
          regionId: it.regionId,
          cityId: it.cityId,
          firstSeenAt: at < now ? at : now,
          lastItemAt: at,
          centroid: vec,
          entityNames: ents.slice(0, 40),
          itemCount: 1,
          languages: [it.language ?? 'und'],
          isDemo: it.isDemo,
          nextCheckAt: now,
        })
        .returning({ id: stories.id });
      storyId = rows[0].id;
      candidates.push({ id: storyId, centroid: vec, entityNames: ents, countryCode: it.countryCode, lastItemAt: at, placeKeys: new Set(places), minhashes: it.minhash ? [it.minhash] : [], isDemo: it.isDemo });
      created++;
    }
    await db.insert(storyItems).values({ storyId, itemId: it.id, similarity, independenceKey: `source:${it.sourceId}` }).onConflictDoNothing();
    await db.update(rawItems).set({ status: 'clustered' }).where(eq(rawItems.id, it.id));
  }
  return { attached, created };
}
