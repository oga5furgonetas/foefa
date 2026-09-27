/**
 * demo:seed / demo:purge. El contenido DEMO se genera pasando los feeds
 * ficticios por el pipeline REAL (ingesta, verificación, redacción,
 * controles y publicación): así la demo enseña exactamente lo que hará el
 * sistema con fuentes reales.
 */
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { rawItems, sources, stories } from '../db/schema';
import { upsertSource } from '../db/seed';
import { PoliteFetcher } from '../ingest/fetcher';
import { runPipelineOnce, type TickStats } from '../pipeline/run';
import { DEMO_SOURCES, demoFetch } from './scenario';

export async function seedDemo(db: Db, opts: { now?: Date; phase?: 1 | 2 } = {}): Promise<TickStats> {
  const now = opts.now ?? new Date();
  const ids: number[] = [];
  for (const s of DEMO_SOURCES) {
    const { items: _items, format: _format, ...seed } = s;
    ids.push(await upsertSource(db, seed, true));
  }
  // Forzar lectura inmediata de las fuentes DEMO.
  await db.update(sources).set({ nextFetchAt: null, etag: null, lastModified: null }).where(eq(sources.isDemo, true));
  const fetcher = new PoliteFetcher({ fetchImpl: demoFetch(() => now, () => opts.phase ?? 1), allowPrivateHosts: true, minHostIntervalMs: 0 });
  return runPipelineOnce(db, { fetcher, now, onlyDemo: true, ingestLimit: 200 });
}

export async function purgeDemo(db: Db): Promise<{ stories: number; items: number; sources: number }> {
  const s = await db.delete(stories).where(eq(stories.isDemo, true)).returning({ id: stories.id });
  const i = await db.delete(rawItems).where(eq(rawItems.isDemo, true)).returning({ id: rawItems.id });
  const src = await db.delete(sources).where(eq(sources.isDemo, true)).returning({ id: sources.id });
  await db.execute(sql`DELETE FROM entities e WHERE NOT EXISTS (SELECT 1 FROM article_entities ae WHERE ae.entity_id = e.id) AND NOT EXISTS (SELECT 1 FROM story_entities se WHERE se.entity_id = e.id) AND NOT EXISTS (SELECT 1 FROM topics t WHERE t.entity_id = e.id)`);
  return { stories: s.length, items: i.length, sources: src.length };
}
