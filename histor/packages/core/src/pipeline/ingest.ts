/**
 * INGEST: lee las fuentes que tocan, guarda piezas nuevas (o actualizadas)
 * y deja rastro en fetch_log. Espera exponencial ante fallos; tras 5
 * fallos seguidos la fuente pasa a "failing" y se abre una tarea.
 */
import { and, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { fetchLog, rawItems, sources } from '../db/schema';
import { PoliteFetcher } from '../ingest/fetcher';
import { runConnector } from '../ingest/connectors';
import { canonicalUrl, isHttpUrl } from '../ingest/url';
import { openReviewTask } from '../services/audit';
import { contentHash } from '../text/similarity';

export type IngestStats = { sources: number; itemsSeen: number; itemsNew: number; itemsUpdated: number; errors: number };

export async function ingestDueSources(
  db: Db,
  opts: { fetcher?: PoliteFetcher; limit?: number; now?: Date; onlyDemo?: boolean; sourceIds?: number[] } = {},
): Promise<IngestStats> {
  const now = opts.now ?? new Date();
  const fetcher = opts.fetcher ?? new PoliteFetcher();
  const due = await db
    .select()
    .from(sources)
    .where(
      and(
        inArray(sources.status, ['active', 'failing']),
        opts.sourceIds?.length ? inArray(sources.id, opts.sourceIds) : or(isNull(sources.nextFetchAt), lte(sources.nextFetchAt, now)),
        opts.onlyDemo === undefined ? undefined : eq(sources.isDemo, opts.onlyDemo),
      ),
    )
    .orderBy(sql`${sources.nextFetchAt} NULLS FIRST`)
    .limit(opts.limit ?? 20);

  const stats: IngestStats = { sources: due.length, itemsSeen: 0, itemsNew: 0, itemsUpdated: 0, errors: 0 };
  for (const src of due) {
    let result;
    try {
      result = await runConnector(
        { id: src.id, connector: src.connector, feedUrl: src.feedUrl, homepageUrl: src.homepageUrl, etag: src.etag, lastModified: src.lastModified, config: src.config },
        fetcher,
      );
    } catch (e) {
      result = { items: [], status: 0, url: src.feedUrl ?? src.homepageUrl, notModified: false, etag: null, lastModified: null, tdmReserved: false, bytes: 0, durationMs: 0, error: (e as Error).message };
    }
    let newCount = 0;
    for (const it of result.items) {
      if (!isHttpUrl(it.url) || !it.title?.trim()) continue;
      stats.itemsSeen++;
      const canon = canonicalUrl(it.url);
      const keepText = !result.tdmReserved;
      const hash = contentHash(`${it.title} ${it.summary ?? ''} ${keepText ? (it.contentText ?? '') : ''}`);
      const rows = await db
        .insert(rawItems)
        .values({
          sourceId: src.id,
          guid: it.guid,
          url: it.url,
          canonicalUrl: canon,
          title: it.title.slice(0, 500),
          summary: it.summary,
          contentText: keepText ? it.contentText : null,
          contentHash: hash,
          language: it.language,
          author: it.author,
          publishedAt: it.publishedAt,
          imageUrl: it.imageUrl,
          isDemo: src.isDemo,
          tdmReserved: result.tdmReserved,
          meta: { categories: it.categories, structured: it.structured ?? null },
        })
        .onConflictDoUpdate({
          target: [rawItems.sourceId, rawItems.canonicalUrl],
          // Si la pieza cambió (corrección, actualización), se reprocesa.
          set: {
            title: it.title.slice(0, 500),
            summary: it.summary,
            contentText: keepText ? it.contentText : null,
            contentHash: hash,
            status: 'new',
            meta: { categories: it.categories, structured: it.structured ?? null },
          },
          setWhere: sql`${rawItems.contentHash} <> ${hash}`,
        })
        .returning({ id: rawItems.id, inserted: sql<boolean>`(xmax = 0)` });
      if (rows.length) {
        if (rows[0].inserted) {
          newCount++;
          stats.itemsNew++;
        } else stats.itemsUpdated++;
      }
    }
    const failed = !!result.error && !result.notModified;
    if (failed) stats.errors++;
    const failures = failed ? src.consecutiveFailures + 1 : 0;
    const backoffMin = failed ? Math.min(24 * 60, src.fetchIntervalMinutes * 2 ** Math.min(failures, 6)) : src.fetchIntervalMinutes;
    await db.insert(fetchLog).values({
      sourceId: src.id,
      url: result.url,
      statusCode: result.status || null,
      durationMs: result.durationMs,
      bytes: result.bytes,
      itemsSeen: result.items.length,
      itemsNew: newCount,
      error: result.error,
    });
    await db
      .update(sources)
      .set({
        lastFetchedAt: now,
        lastSuccessAt: failed ? src.lastSuccessAt : now,
        nextFetchAt: new Date(now.getTime() + backoffMin * 60_000),
        consecutiveFailures: failures,
        status: failures >= 5 ? 'failing' : src.status === 'failing' && !failed ? 'active' : src.status,
        etag: result.etag ?? src.etag,
        lastModified: result.lastModified ?? src.lastModified,
        tdmReserved: result.tdmReserved,
        robotsAllowed: result.error?.includes('robots') ? false : src.robotsAllowed ?? true,
        updatedAt: now,
      })
      .where(eq(sources.id, src.id));
    if (failures === 5) {
      await openReviewTask(db, {
        kind: 'source_failing',
        title: `La fuente «${src.name}» falla desde hace 5 lecturas: ${result.error}`,
        sourceId: src.id,
        priority: 40,
        dedupeKey: `source_failing:${src.id}`,
      });
    }
  }
  return stats;
}
