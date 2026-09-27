/**
 * Cola de trabajos sobre PostgreSQL. Varios workers pueden competir sin
 * pisarse gracias a FOR UPDATE SKIP LOCKED. Reintentos con espera
 * exponencial; trabajos únicos por `uniqueKey` mientras estén activos.
 * Elegida frente a Redis/BullMQ para empezar con UNA sola pieza de
 * infraestructura (Postgres); se cambia por BullMQ si el volumen lo pide.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { jobs } from '../db/schema';

export type JobRow = typeof jobs.$inferSelect;

export async function enqueue(
  db: Db,
  name: string,
  payload: Record<string, unknown> = {},
  opts: { queue?: string; runAt?: Date; uniqueKey?: string; maxAttempts?: number } = {},
): Promise<number | null> {
  const rows = await db
    .insert(jobs)
    .values({
      name,
      payload,
      queue: opts.queue ?? 'default',
      runAt: opts.runAt ?? new Date(),
      uniqueKey: opts.uniqueKey ?? null,
      maxAttempts: opts.maxAttempts ?? 5,
    })
    .onConflictDoNothing({ target: jobs.uniqueKey, where: sql`status in ('queued','running')` })
    .returning({ id: jobs.id });
  return rows[0]?.id ?? null;
}

/** Reserva hasta `limit` trabajos listos. */
export async function claim(db: Db, workerId: string, opts: { queue?: string; limit?: number } = {}): Promise<JobRow[]> {
  const res = await db.execute(sql`
    UPDATE jobs SET status = 'running', locked_at = now(), locked_by = ${workerId}, attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM jobs
      WHERE queue = ${opts.queue ?? 'default'} AND status = 'queued' AND run_at <= now()
      ORDER BY run_at, id
      LIMIT ${opts.limit ?? 5}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, queue, name, payload, run_at AS "runAt", attempts, max_attempts AS "maxAttempts", status,
              locked_at AS "lockedAt", locked_by AS "lockedBy", last_error AS "lastError", unique_key AS "uniqueKey",
              created_at AS "createdAt", finished_at AS "finishedAt"`);
  return res as unknown as JobRow[];
}

export async function complete(db: Db, id: number): Promise<void> {
  await db.execute(sql`UPDATE jobs SET status = 'done', finished_at = now(), locked_at = NULL WHERE id = ${id}`);
}

export async function fail(db: Db, job: Pick<JobRow, 'id' | 'attempts' | 'maxAttempts'>, error: string): Promise<void> {
  const final = job.attempts >= job.maxAttempts;
  const delaySec = Math.min(3600, 30 * 2 ** Math.max(0, job.attempts - 1));
  await db.execute(sql`
    UPDATE jobs SET
      status = ${final ? 'failed' : 'queued'},
      last_error = ${error.slice(0, 2000)},
      locked_at = NULL,
      run_at = now() + (${delaySec} || ' seconds')::interval,
      finished_at = ${final ? sql`now()` : sql`NULL`}
    WHERE id = ${job.id}`);
}

/** Libera trabajos colgados (worker caído) tras `staleMinutes`. */
export async function releaseStale(db: Db, staleMinutes = 15): Promise<number> {
  const res = await db.execute(sql`
    UPDATE jobs SET status = 'queued', locked_at = NULL, locked_by = NULL
    WHERE status = 'running' AND locked_at < now() - (${staleMinutes} || ' minutes')::interval
    RETURNING id`);
  return (res as unknown as unknown[]).length;
}

export type JobHandler = (payload: Record<string, unknown>, job: JobRow) => Promise<void>;

/** Procesa un lote de trabajos con los manejadores indicados. */
export async function work(db: Db, workerId: string, handlers: Record<string, JobHandler>, opts: { queue?: string; limit?: number } = {}): Promise<{ done: number; failed: number }> {
  const batch = await claim(db, workerId, opts);
  let done = 0;
  let failed = 0;
  for (const job of batch) {
    const h = handlers[job.name];
    try {
      if (!h) throw new Error(`sin manejador para ${job.name}`);
      await h(job.payload, job);
      await complete(db, job.id);
      done++;
    } catch (e) {
      await fail(db, job, e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e));
      failed++;
    }
  }
  return { done, failed };
}
