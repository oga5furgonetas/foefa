/**
 * CLUSTER + DEDUPLICATE: cada pieza se une a la historia (story cluster)
 * que cuenta el mismo acontecimiento, o abre una nueva. Así no se publican
 * 20 artículos de lo mismo: una historia = un artículo por idioma, que se
 * va actualizando.
 *
 * similitud = 0,5·coseno(términos) + 0,35·entidades compartidas + 0,15·lugar
 * (+ atajo: si es copia casi literal de una pieza de la historia, se une).
 */
import { and, desc, eq, gt, inArray, lte, notInArray, sql } from 'drizzle-orm';
import type { EditorialSettings } from '../config/settings';
import type { Db } from '../db/client';
import { rawItems, stories, storyItems } from '../db/schema';
import { entityKey, findPlaces } from '../text/entities';
import { slugify } from '../text/normalize';
import { cosine, mergeVectors, minhashSimilarity, numberOverlap, sharedNumberTerms, termVector, type TermVector } from '../text/similarity';
import { placeKey } from '../verification/claims';
import type { VPlace } from '../verification/types';

const WINDOW_HOURS = 72;

/**
 * Las piezas que abrieron la historia: lo que la define. El centroide suma todo lo que la
 * historia va absorbiendo y «deriva»: el 29-09-2026 una historia sobre la ansiedad ante los
 * exámenes acabó con 264 piezas (la Bolsa brasileña, fútbol, el calendario laboral…) porque
 * cualquier pieza con dos cifras y un lugar encajaba en un centroide con cientos de cifras y
 * lugares. Ahora una pieza nueva tiene que parecerse TAMBIÉN a alguna de estas anclas.
 */
export const ANCHORS = 3;

export type Anchor = { vec: TermVector; entities: string[]; places: Set<string>; minhash: number[] | null };

type Candidate = {
  id: number;
  centroid: TermVector;
  entityNames: string[];
  countryCode: string | null;
  lastItemAt: Date;
  placeKeys: Set<string>;
  minhashes: number[][];
  isDemo: boolean;
  anchors: Anchor[];
};

type ItemForFeatures = Pick<typeof rawItems.$inferSelect, 'title' | 'summary' | 'contentText' | 'language' | 'entities' | 'meta' | 'minhash'>;

/** Rasgos de una pieza para compararla con una historia (o para servirle de ancla). */
export function itemFeatures(it: ItemForFeatures): { vec: TermVector; simVec: TermVector; ents: string[]; places: string[]; minhash: number[] | null } {
  // Titular, entradilla y el arranque del texto: ahí está el hecho. El final de los artículos
  // completos es relleno común de cada medio (licencia y firmas de The Conversation, «Seguir
  // leyendo»…) y hacía parecidas piezas que no tienen nada que ver.
  const full = [it.title, it.summary, it.contentText?.slice(0, 1200)].filter(Boolean).join(' ');
  const vec = termVector(full, it.language ?? undefined);
  const simVec = comparableVector(full, it.language ?? undefined, vec);
  // Sin topónimos: compartir «Ucrania» o «Marruecos» no hace que dos hechos sean el mismo
  // (el lugar ya cuenta aparte, con su peso). Visto el 27-09-2026: Lavrov + una alerta de inundación.
  const ents = it.entities.filter((e) => e.type !== 'place' && (e.type !== 'other' || e.name.includes(' '))).map((e) => entityKey(e.name));
  const places = (((it.meta as { places?: VPlace[] })?.places ?? []) as VPlace[]).map(placeKey);
  return { vec, simVec, ents, places, minhash: it.minhash };
}

export function anchorOf(f: ReturnType<typeof itemFeatures>): Anchor {
  return { vec: f.simVec, entities: f.ents, places: new Set(f.places), minhash: f.minhash };
}

/** Parecido de una pieza con la mejor de las anclas de la historia. */
export function anchorSimilarity(
  item: { vec: TermVector; entities: string[]; places: string[]; minhash: number[] | null; at: Date },
  c: Pick<Candidate, 'anchors' | 'lastItemAt' | 'countryCode' | 'id' | 'isDemo'>,
  idf?: (term: string) => number,
): number {
  let best = 0;
  for (const a of c.anchors) {
    const s = storySimilarity(item, { ...c, centroid: a.vec, entityNames: a.entities, placeKeys: a.places, minhashes: a.minhash ? [a.minhash] : [] }, idf);
    if (s > best) best = s;
  }
  return best;
}

export function storySimilarity(
  item: { vec: TermVector; entities: string[]; places: string[]; minhash: number[] | null; at: Date },
  c: Omit<Candidate, 'anchors'>,
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
  // Y que sean buena parte de sus cifras, no 2 de 40 por casualidad en dos artículos largos.
  const numShare = numberOverlap(item.vec, c.centroid);
  // Y al menos una cifra que identifique algo (≥ 100 o con decimales): «24 horas» o «30 casos»
  // coinciden por casualidad (el dólar en Colombia se tragaba así noticias de fútbol, 29-09-2026).
  const telling = Object.keys(item.vec).filter((k) => k.startsWith('#') && c.centroid[k] && (Number(k.slice(1)) >= 100 || !Number.isInteger(Number(k.slice(1))))).length;
  const crossLingual = nums >= 2 && telling >= 1 && numShare >= 0.4 && placeScore > 0 ? 0.25 + 0.1 * Math.min(3, nums) : 0;
  // Sin ninguna entidad compartida (más allá del lugar) solo se agrupa con mucho parecido léxico o con ese ancla.
  // Una cifra compartida (≥ 10, no años) en el mismo lugar ayuda, pero solo junto con parecido
  // léxico: «Veintisiete muertos en dos tiroteos en Sudáfrica» / «…dos tiroteos… dejan 27 muertos».
  const numPlace = nums >= 1 && numShare >= 0.25 && placeScore > 0 && (cos >= 0.2 || sharedEnts.length > 0) ? 0.15 : 0;
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
  const anchorsByStory = await loadAnchors(db, storyIds);
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
      anchors: anchorsByStory.get(s.id) ?? [],
    });
  }

  let attached = 0;
  let created = 0;
  // Piezas actualizadas que ya pertenecían a una historia: se reverifica esa historia.
  const already = await db.select({ itemId: storyItems.itemId, storyId: storyItems.storyId }).from(storyItems).where(inArray(storyItems.itemId, items.map((i) => i.id)));
  const storyOf = new Map(already.map((a) => [a.itemId, a.storyId]));
  // El IDF, una vez por ciclo (se recalculaba por cada pieza sobre 800 historias: el agrupador
  // llegó a tardar 4 minutos en producción, 30-09-2026). Las historias nuevas del propio ciclo
  // no cambian gran cosa el peso de cada palabra.
  const idf = idfFrom(candidates.map((c) => c.centroid));
  for (const it of items) {
    const prevStory = storyOf.get(it.id);
    if (prevStory) {
      await db.update(stories).set({ nextCheckAt: now, updatedAt: now }).where(eq(stories.id, prevStory));
      await db.update(rawItems).set({ status: 'clustered' }).where(eq(rawItems.id, it.id));
      attached++;
      continue;
    }
    const feats = itemFeatures(it);
    const { vec, simVec, ents, places } = feats;
    const at = it.publishedAt ?? it.fetchedAt;
    let best: { c: Candidate; sim: number } | null = null;
    for (const c of candidates) {
      if (c.isDemo !== it.isDemo) continue; // lo DEMO jamás se mezcla con lo real
      const probe = { vec: simVec, entities: ents, places, minhash: it.minhash, at };
      let sim = storySimilarity(probe, c, idf);
      // Solo si ya encaja con el conjunto se mira el origen (más barato): tiene que encajar con los dos.
      if (sim >= settings.clusterThreshold && c.anchors.length) sim = Math.min(sim, anchorSimilarity(probe, c, idf));
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
      if (c.anchors.length < ANCHORS) c.anchors.push(anchorOf(feats));
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
      candidates.push({ id: storyId, centroid: vec, entityNames: ents, countryCode: it.countryCode, lastItemAt: at, placeKeys: new Set(places), minhashes: it.minhash ? [it.minhash] : [], isDemo: it.isDemo, anchors: [anchorOf(feats)] });
      created++;
    }
    await db.insert(storyItems).values({ storyId, itemId: it.id, similarity, independenceKey: `source:${it.sourceId}` }).onConflictDoNothing();
    await db.update(rawItems).set({ status: 'clustered' }).where(eq(rawItems.id, it.id));
  }
  return { attached, created };
}

/** Las ANCHORS primeras piezas (por orden de llegada) de cada historia, como anclas. */
export async function loadAnchors(db: Db, storyIds: number[]): Promise<Map<number, Anchor[]>> {
  const out = new Map<number, Anchor[]>();
  if (!storyIds.length) return out;
  const ranked = db
    .select({
      storyId: storyItems.storyId,
      itemId: storyItems.itemId,
      rn: sql<number>`row_number() over (partition by ${storyItems.storyId} order by ${storyItems.joinedAt}, ${storyItems.itemId})`.as('rn'),
    })
    .from(storyItems)
    .where(inArray(storyItems.storyId, storyIds))
    .as('ranked');
  const rows = await db
    .select({ storyId: ranked.storyId, rn: ranked.rn, title: rawItems.title, summary: rawItems.summary, contentText: rawItems.contentText, language: rawItems.language, entities: rawItems.entities, meta: rawItems.meta, minhash: rawItems.minhash })
    .from(ranked)
    .innerJoin(rawItems, eq(rawItems.id, ranked.itemId))
    .where(lte(ranked.rn, ANCHORS))
    .orderBy(ranked.storyId, ranked.rn);
  for (const r of rows) {
    const list = out.get(r.storyId) ?? [];
    list.push(anchorOf(itemFeatures(r)));
    out.set(r.storyId, list);
  }
  return out;
}

/**
 * Limpieza de las historias que derivaron antes de las anclas: cada pieza se compara con la
 * que abrió la historia (y con las primeras que encajan con ella); las que no se parecen se
 * sueltan y vuelven a la cola para agruparse donde toca. Con `dryRun`, solo mide.
 */
export async function pruneDriftedItems(db: Db, storyId: number, settings: EditorialSettings, opts: { dryRun?: boolean } = {}): Promise<{ kept: number; dropped: { id: number; title: string; sim: number }[] }> {
  const rows = await db
    .select({ itemId: storyItems.itemId, r: rawItems })
    .from(storyItems)
    .innerJoin(rawItems, eq(rawItems.id, storyItems.itemId))
    .where(eq(storyItems.storyId, storyId))
    .orderBy(storyItems.joinedAt, storyItems.itemId);
  if (rows.length < 2) return { kept: rows.length, dropped: [] };
  const feats = rows.map((x) => ({ id: x.itemId, title: x.r.title, lang: x.r.language, at: x.r.publishedAt ?? x.r.fetchedAt, f: itemFeatures(x.r) }));
  const lastItemAt = new Date(Math.max(...feats.map((x) => x.at.getTime())));
  const anchors: Anchor[] = [anchorOf(feats[0].f)];
  const cand = { id: storyId, isDemo: false, countryCode: null, lastItemAt, anchors };
  const keep = [feats[0]];
  const pending: { x: (typeof feats)[number]; sim: number }[] = [];
  const probeOf = (x: (typeof feats)[number]) => ({ vec: x.f.simVec, entities: x.f.ents, places: x.f.places, minhash: x.f.minhash, at: lastItemAt });
  for (const x of feats.slice(1)) {
    // Sin penalizar el tiempo: aquí solo importa si cuentan lo mismo.
    const sim = anchorSimilarity(probeOf(x), cand);
    // Margen: sin el IDF del conjunto las puntuaciones bajan un poco; mejor quedarse corto que partir una historia buena.
    if (sim >= settings.clusterThreshold * 0.85) {
      keep.push(x);
      if (anchors.length < ANCHORS && sim >= settings.clusterThreshold) anchors.push(anchorOf(x.f));
    } else pending.push({ x, sim });
  }
  // Segunda pasada: se queda también lo que encaja de verdad (umbral estricto) con algo que ya se
  // quedó. «Lindsay Clancy's lawyer questions…» se parecía poco a la primera pieza del juicio,
  // pero mucho a otras del mismo juicio.
  // Solo contra las que encajaron CLARAMENTE con el origen y sin encadenar (A→B→C acababa
  // readmitiendo 236 de 264 piezas sin relación).
  const dropped: { id: number; title: string; sim: number }[] = [];
  const strong = { ...cand, anchors: keep.filter((k, i) => i === 0 || anchorSimilarity(probeOf(k), cand) >= settings.clusterThreshold).map((k) => anchorOf(k.f)) };
  for (const { x, sim } of pending) {
    if (anchorSimilarity(probeOf(x), strong) >= settings.clusterThreshold) keep.push(x);
    else dropped.push({ id: x.id, title: x.title, sim: Math.round(sim * 100) / 100 });
  }
  if (!dropped.length || opts.dryRun) return { kept: keep.length, dropped };
  const ids = dropped.map((d) => d.id);
  await db.delete(storyItems).where(and(eq(storyItems.storyId, storyId), inArray(storyItems.itemId, ids)));
  await db.update(rawItems).set({ status: 'normalized' }).where(inArray(rawItems.id, ids));
  let centroid: TermVector = {};
  for (const k of keep) centroid = mergeVectors(centroid, k.f.vec);
  await db
    .update(stories)
    .set({
      centroid,
      entityNames: [...new Set(keep.flatMap((k) => k.f.ents))].slice(0, 40),
      itemCount: keep.length,
      languages: [...new Set(keep.map((k) => k.lang ?? 'und'))],
      lastItemAt: new Date(Math.max(...keep.map((k) => k.at.getTime()))),
    })
    .where(eq(stories.id, storyId));
  return { kept: keep.length, dropped };
}
