/**
 * Una vuelta completa del pipeline 24/7:
 * FUENTES → DISCOVERY → NORMALIZE → CLUSTER → VERIFY → EDITORIAL → QUALITY → PUBLISH → (MONITOR vía next_check_at)
 * Cada etapa deja su registro en pipeline_runs (para el panel y las métricas).
 */
import { and, eq, gte, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { logger } from '../observability/index';
import type { Db } from '../db/client';
import { aiUsage, analyticsEvents, jobs, pipelineRuns, rawItems } from '../db/schema';
import type { PoliteFetcher } from '../ingest/fetcher';
import { enqueue } from '../jobs/queue';
import { getEditorialSettings } from '../services/settings';
import { clusterItems } from './cluster';
import { enrichStoryItems } from './enrich';
import { ingestDueSources } from './ingest';
import { normalizeNewItems } from './normalize';
import { publishStory } from './publish';
import { verifyDueStories } from './verify';

export async function stage<T extends object>(db: Db, name: string, fn: () => Promise<T>): Promise<T> {
  const [row] = await db.insert(pipelineRuns).values({ stage: name }).returning({ id: pipelineRuns.id });
  const t0 = Date.now();
  try {
    const out = await fn();
    // Cuánto tarda cada fase, en los registros: los ciclos llegaron a durar 20 minutos (30-09-2026).
    logger.info({ stage: name, ms: Date.now() - t0 }, 'fase');
    const counts = Object.fromEntries(Object.entries(out).filter(([, v]) => typeof v === 'number')) as Record<string, number>;
    await db.update(pipelineRuns).set({ finishedAt: new Date(), ok: true, counts }).where(eq(pipelineRuns.id, row.id));
    return out;
  } catch (e) {
    await db.update(pipelineRuns).set({ finishedAt: new Date(), ok: false, error: String((e as Error).stack ?? e).slice(0, 4000) }).where(eq(pipelineRuns.id, row.id));
    throw e;
  }
}

export type TickStats = {
  ingested: number;
  normalized: number;
  clustered: number;
  enriched?: number;
  verified: number;
  published: number;
  updated: number;
  held: number;
  retracted: number;
  /** Llamadas a la IA en este ciclo (correctas / fallidas), tokens gastados y el último error. */
  ai?: { ok: number; failed: number; tokens: number; error?: string };
};

export async function runPipelineOnce(db: Db, opts: { fetcher?: PoliteFetcher; now?: Date; ingest?: boolean; onlyDemo?: boolean; ingestLimit?: number } = {}): Promise<TickStats> {
  const now = opts.now ?? new Date();
  const settings = await getEditorialSettings(db);
  const stats: TickStats = { ingested: 0, normalized: 0, clustered: 0, verified: 0, published: 0, updated: 0, held: 0, retracted: 0 };
  if (opts.ingest !== false) {
    const ing = await stage(db, 'ingest', () => ingestDueSources(db, { fetcher: opts.fetcher, now, onlyDemo: opts.onlyDemo, limit: opts.ingestLimit }));
    stats.ingested = ing.itemsNew + ing.itemsUpdated;
  }
  const norm = await stage(db, 'normalize', () => normalizeNewItems(db));
  stats.normalized = norm.normalized;
  const cl = await stage(db, 'cluster', () => clusterItems(db, settings, { now }));
  stats.clustered = cl.attached + cl.created;
  // Texto completo de las fuentes de las historias candidatas (solo con red real).
  if (opts.ingest !== false && !opts.onlyDemo) {
    const en = await stage(db, 'enrich', () => enrichStoryItems(db, { fetcher: opts.fetcher, now }));
    stats.enriched = en.enriched;
  }
  const verified = await stage(db, 'verify', async () => {
    const list = await verifyDueStories(db, settings, { now });
    return Object.assign(list, { count: list.length });
  });
  stats.verified = verified.length;
  await stage(db, 'publish', async () => {
    let published = 0;
    let updated = 0;
    let held = 0;
    let retracted = 0;
    for (const v of verified) {
      const r = await publishStory(db, v, settings, { now });
      published += r.published.length;
      updated += r.updated.length;
      held += r.held ? 1 : 0;
      retracted += r.retracted ? 1 : 0;
      if (r.published.length || r.updated.length) await enqueue(db, 'distribute:story', { storyId: v.story.id }, { uniqueKey: `distribute:${v.story.id}` });
    }
    Object.assign(stats, { published, updated, held, retracted });
    return { published, updated, held, retracted };
  });
  // Uso de la IA del ciclo, en el registro: la base de producción no se consulta a mano.
  const [ai] = await db
    .select({ ok: sql<number>`count(*) filter (where ${aiUsage.ok})`, failed: sql<number>`count(*) filter (where not ${aiUsage.ok})`, tokens: sql<number>`coalesce(sum(${aiUsage.inputTokens} + ${aiUsage.outputTokens}), 0)` })
    .from(aiUsage)
    .where(gte(aiUsage.ts, now));
  if (ai && Number(ai.ok) + Number(ai.failed) > 0) {
    stats.ai = { ok: Number(ai.ok), failed: Number(ai.failed), tokens: Number(ai.tokens) };
    if (stats.ai.failed) {
      const [last] = await db.select({ error: aiUsage.error }).from(aiUsage).where(and(gte(aiUsage.ts, now), eq(aiUsage.ok, false))).orderBy(sql`${aiUsage.ts} desc`).limit(1);
      if (last?.error) stats.ai.error = last.error.slice(0, 160);
    }
  }
  return stats;
}

/**
 * Mantenimiento diario: poda el texto interno de las fuentes a los 30 días
 * (solo se usó para contrastar), la analítica en bruto a los 13 meses y los
 * trabajos terminados a los 14 días.
 */
export async function maintenance(db: Db, now = new Date()): Promise<{ prunedTexts: number; prunedEvents: number; prunedJobs: number }> {
  const t = await db
    .update(rawItems)
    .set({ contentText: null })
    .where(and(isNotNull(rawItems.contentText), lt(rawItems.fetchedAt, new Date(now.getTime() - 30 * 86400000))))
    .returning({ id: rawItems.id });
  const e = await db.delete(analyticsEvents).where(lt(analyticsEvents.ts, new Date(now.getTime() - 400 * 86400000))).returning({ id: analyticsEvents.id });
  const j = await db
    .delete(jobs)
    .where(and(inArray(jobs.status, ['done', 'failed']), lt(jobs.createdAt, new Date(now.getTime() - 14 * 86400000))))
    .returning({ id: jobs.id });
  return { prunedTexts: t.length, prunedEvents: e.length, prunedJobs: j.length };
}
