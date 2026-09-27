/**
 * Recomendación. NO se optimiza solo por clics. La puntuación combina:
 *   relevancia (intereses aprendidos + temas seguidos)   0,35
 *   calidad (confianza de la evidencia)                  0,25
 *   actualidad (decae con las horas)                     0,20
 *   importancia (lo que importa aunque no lo sigas)      0,15
 *   cercanía (tu país/ciudad)                            0,05
 * y se reordena con MMR para dar DIVERSIDAD (no repetir tema ni historia).
 * Además, 1 de cada 5 huecos es de exploración: noticias importantes fuera
 * de tus intereses, para no encerrar al lector en una burbuja.
 * Señales: leer de verdad (scroll/tiempo) pesa más que el clic; guardar y
 * compartir, más; seguir un tema, lo que más. Rebotar resta.
 */
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { articleEntities, articles, entities, interestProfiles, recommendations, userFollows } from '../db/schema';
import { listArticles, type ArticleCard } from '../services/content';

const SIGNAL: Record<string, number> = {
  click: 0.3,
  page_view: 0.2,
  read_progress: 0, // se calcula por profundidad
  dwell: 0, // se calcula por segundos
  save: 2,
  share: 1.5,
  follow: 3,
  alert_open: 0.8,
};

export async function updateInterestProfile(db: Db, key: string, articleId: number, type: string, value: number | null): Promise<void> {
  let w = SIGNAL[type] ?? 0;
  if (type === 'read_progress') w = value == null ? 0 : value >= 0.6 ? 1 : value < 0.1 ? -0.2 : 0.2;
  if (type === 'dwell') w = value == null ? 0 : value >= 30 ? 0.8 : value < 5 ? -0.2 : 0.2;
  if (!w) return;
  const [a] = await db.select({ categoryId: articles.categoryId, countryCode: articles.countryCode, cityId: articles.cityId }).from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!a) return;
  const ents = await db.select({ slug: entities.slug }).from(articleEntities).innerJoin(entities, eq(entities.id, articleEntities.entityId)).where(eq(articleEntities.articleId, articleId)).limit(6);
  const features = featureKeys(a, ents.map((e) => e.slug));
  const [cur] = await db.select().from(interestProfiles).where(eq(interestProfiles.key, key)).limit(1);
  const aff = { ...(cur?.affinities ?? {}) };
  // Olvido gradual: media vida ~30 días.
  const days = cur ? (Date.now() - cur.updatedAt.getTime()) / 86400000 : 0;
  const decay = Math.exp(-days / 43);
  for (const k of Object.keys(aff)) {
    aff[k] *= decay;
    if (Math.abs(aff[k]) < 0.01) delete aff[k];
  }
  for (const [k, fw] of Object.entries(features)) aff[k] = Math.max(-3, Math.min(20, (aff[k] ?? 0) + w * fw));
  // Límite de claves para que el perfil no crezca sin fin.
  const trimmed = Object.fromEntries(Object.entries(aff).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).slice(0, 200));
  await db
    .insert(interestProfiles)
    .values({ key, affinities: trimmed, events: 1, updatedAt: new Date() })
    .onConflictDoUpdate({ target: interestProfiles.key, set: { affinities: trimmed, events: sql`${interestProfiles.events} + 1`, updatedAt: new Date() } });
}

function featureKeys(a: { categoryId: string | null; countryCode: string | null; cityId: number | null }, entitySlugs: string[]): Record<string, number> {
  const f: Record<string, number> = {};
  if (a.categoryId) f[`cat:${a.categoryId}`] = 1;
  if (a.countryCode) f[`country:${a.countryCode}`] = 0.5;
  if (a.cityId) f[`city:${a.cityId}`] = 0.6;
  for (const e of entitySlugs) f[`ent:${e}`] = 0.7;
  return f;
}

export type Recommended = ArticleCard & { score: number; reason: 'interest' | 'followed' | 'important' | 'local' | 'explore' };

export async function recommend(
  db: Db,
  opts: { lang: string; profileKey: string | null; userId?: string | null; countryCode: string | null; cityId?: number | null; limit?: number; context?: string },
): Promise<Recommended[]> {
  const limit = opts.limit ?? 12;
  const candidates = await listArticles(db, { lang: opts.lang, since: new Date(Date.now() - 72 * 3600000), limit: 300 });
  if (!candidates.length) return [];
  const aff: Record<string, number> = {};
  if (opts.profileKey) {
    const [p] = await db.select().from(interestProfiles).where(eq(interestProfiles.key, opts.profileKey)).limit(1);
    Object.assign(aff, p?.affinities ?? {});
  }
  const followed = new Set<string>();
  if (opts.userId) {
    const f = await db.select().from(userFollows).where(eq(userFollows.userId, opts.userId));
    for (const x of f) {
      const k = x.kind === 'category' ? `cat:${x.ref}` : x.kind === 'entity' || x.kind === 'topic' ? `ent:${x.ref}` : `${x.kind}:${x.ref}`;
      followed.add(k);
      aff[k] = (aff[k] ?? 0) + 5;
    }
  }
  const entRows = await db
    .select({ articleId: articleEntities.articleId, slug: entities.slug })
    .from(articleEntities)
    .innerJoin(entities, eq(entities.id, articleEntities.entityId))
    .where(inArray(articleEntities.articleId, candidates.map((c) => c.id)));
  const entsOf = new Map<number, string[]>();
  for (const r of entRows) entsOf.set(r.articleId, [...(entsOf.get(r.articleId) ?? []), r.slug]);

  const maxAff = Math.max(1, ...Object.values(aff).map(Math.abs));
  const scored = candidates.map((c) => {
    const feats = featureKeys(c, entsOf.get(c.id) ?? []);
    let rel = 0;
    let isFollowed = false;
    for (const [k, w] of Object.entries(feats)) {
      rel += (aff[k] ?? 0) * w;
      if (followed.has(k)) isFollowed = true;
    }
    const relevance = Math.max(0, Math.min(1, rel / (maxAff * 1.5)));
    const ageH = (Date.now() - c.publishedAt.getTime()) / 3600000;
    const fresh = Math.exp(-ageH / 18);
    const local = (opts.cityId && c.cityId === opts.cityId ? 1 : 0) || (opts.countryCode && c.countryCode === opts.countryCode ? 0.6 : 0);
    const score = 0.35 * relevance + 0.25 * c.evidenceConfidence + 0.2 * fresh + 0.15 * c.importance + 0.05 * local;
    const reason = (isFollowed ? 'followed' : relevance > 0.2 ? 'interest' : local ? 'local' : 'important') as Recommended['reason'];
    return { ...c, score, reason, relevance, ents: entsOf.get(c.id) ?? [] };
  });

  // MMR: equilibrio entre puntuación y parecido con lo ya elegido.
  const lambda = 0.7;
  const chosen: typeof scored = [];
  const pool = [...scored].sort((a, b) => b.score - a.score);
  const sim = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    a.storyId === b.storyId ? 1 : (a.categoryId && a.categoryId === b.categoryId ? 0.5 : 0) + (a.ents.some((e) => b.ents.includes(e)) ? 0.5 : 0);
  while (chosen.length < limit && pool.length) {
    const slot = chosen.length + 1;
    let pickIdx = 0;
    if (slot % 5 === 0) {
      // Exploración: lo más importante con relevancia baja para este lector.
      const idx = pool.findIndex((p) => p.relevance < 0.1 && p.importance >= 0.3);
      if (idx >= 0) {
        const [p] = pool.splice(idx, 1);
        chosen.push({ ...p, reason: 'explore' });
        continue;
      }
    }
    let best = -Infinity;
    pool.forEach((p, i) => {
      const maxSim = chosen.length ? Math.max(...chosen.map((c) => sim(p, c))) : 0;
      const mmr = lambda * p.score - (1 - lambda) * maxSim;
      if (mmr > best) {
        best = mmr;
        pickIdx = i;
      }
    });
    chosen.push(pool.splice(pickIdx, 1)[0]);
  }
  const out: Recommended[] = chosen.map(({ relevance: _r, ents: _e, ...c }) => c);
  if (opts.profileKey) {
    await db.insert(recommendations).values({ profileKey: opts.profileKey, context: opts.context ?? 'home', articleIds: out.map((o) => o.id), scores: Object.fromEntries(out.map((o) => [o.id, { s: Math.round(o.score * 1000) / 1000, r: o.reason }])) });
  }
  return out;
}

/** Evaluación offline: ¿se leyeron de verdad las recomendaciones servidas? */
export async function recommendationQuality(db: Db, days = 7) {
  const rows = await db.execute(sql`
    WITH served AS (
      SELECT r.profile_key, unnest(r.article_ids) AS article_id, r.created_at FROM recommendations r
      WHERE r.created_at >= now() - (${days} || ' days')::interval
    )
    SELECT count(*)::int AS served,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM analytics_events e WHERE e.article_id = served.article_id AND e.type = 'read_progress' AND e.value >= 0.6
          AND e.ts BETWEEN served.created_at AND served.created_at + interval '1 day'
          AND ('a:' || e.anon_id = served.profile_key OR 'u:' || e.user_id::text = served.profile_key)))::int AS read_through
    FROM served`);
  const r = (rows as unknown as { served: number; read_through: number }[])[0] ?? { served: 0, read_through: 0 };
  return { served: r.served, readThrough: r.read_through, rate: r.served ? r.read_through / r.served : null };
}

export { desc, gte, and };
