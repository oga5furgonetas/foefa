/**
 * Observabilidad: logs JSON (pino) sin secretos, métricas en formato
 * Prometheus y envío opcional de errores a Sentry (SENTRY_DSN) sin SDK.
 */
import { sql } from 'drizzle-orm';
import pino from 'pino';
import type { Db } from '../db/client';
import { env } from '../env';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: process.env.HISTOR_SERVICE ?? 'histor' },
  redact: {
    paths: ['*.password', '*.passwordHash', '*.token', '*.secret', '*.authorization', 'req.headers.cookie', 'req.headers.authorization', '*.apiKey', '*.totpSecret'],
    censor: '[oculto]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/** Métricas en texto Prometheus (para /api/metrics, protegido con METRICS_TOKEN). */
export async function prometheusMetrics(db: Db): Promise<string> {
  const q = async <T>(query: ReturnType<typeof sql>) => (await db.execute(query)) as unknown as T[];
  const lines: string[] = [];
  const gauge = (name: string, help: string, rows: { labels?: Record<string, string>; value: number }[]) => {
    lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} gauge`);
    for (const r of rows) {
      const l = r.labels ? `{${Object.entries(r.labels).map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`).join(',')}}` : '';
      lines.push(`${name}${l} ${Number.isFinite(r.value) ? r.value : 0}`);
    }
  };
  const [items] = await q<{ c: number }>(sql`SELECT count(*)::int c FROM raw_items WHERE fetched_at >= now() - interval '1 hour'`);
  gauge('histor_items_discovered_last_hour', 'Piezas ingeridas en la última hora', [{ value: items?.c ?? 0 }]);
  const states = await q<{ state: string; c: number }>(sql`SELECT state, count(*)::int c FROM stories WHERE first_seen_at >= now() - interval '24 hours' GROUP BY state`);
  gauge('histor_stories_24h', 'Historias descubiertas en 24 h por estado', states.map((s) => ({ labels: { state: s.state }, value: s.c })));
  const [pub] = await q<{ c: number }>(sql`SELECT count(*)::int c FROM articles WHERE published_at >= now() - interval '24 hours' AND status = 'published'`);
  gauge('histor_articles_published_24h', 'Artículos publicados en 24 h', [{ value: pub?.c ?? 0 }]);
  const stages = await q<{ stage: string; avg: number; errors: number }>(sql`
    SELECT stage, avg(extract(epoch from (finished_at - started_at)))::float avg, count(*) FILTER (WHERE ok = false)::int errors
    FROM pipeline_runs WHERE started_at >= now() - interval '1 hour' GROUP BY stage`);
  gauge('histor_pipeline_stage_seconds', 'Duración media de cada etapa (1 h)', stages.map((s) => ({ labels: { stage: s.stage }, value: Math.round((s.avg ?? 0) * 1000) / 1000 })));
  gauge('histor_pipeline_errors_1h', 'Errores por etapa (1 h)', stages.map((s) => ({ labels: { stage: s.stage }, value: s.errors })));
  const [src] = await q<{ failing: number; blocked: number; active: number }>(sql`SELECT count(*) FILTER (WHERE status='failing')::int failing, count(*) FILTER (WHERE status='blocked')::int blocked, count(*) FILTER (WHERE status='active')::int active FROM sources WHERE is_demo = false`);
  gauge('histor_sources', 'Fuentes por estado', [
    { labels: { status: 'active' }, value: src?.active ?? 0 },
    { labels: { status: 'failing' }, value: src?.failing ?? 0 },
    { labels: { status: 'blocked' }, value: src?.blocked ?? 0 },
  ]);
  const [ai] = await q<{ usd: number }>(sql`SELECT coalesce(sum(cost_usd),0)::float usd FROM ai_usage WHERE ts >= date_trunc('month', now())`);
  gauge('histor_ai_cost_usd_month', 'Coste de IA en el mes', [{ value: ai?.usd ?? 0 }]);
  const [jobs] = await q<{ queued: number; failed: number }>(sql`SELECT count(*) FILTER (WHERE status='queued')::int queued, count(*) FILTER (WHERE status='failed' AND finished_at >= now() - interval '24 hours')::int failed FROM jobs`);
  gauge('histor_jobs', 'Trabajos en cola y fallidos (24 h)', [
    { labels: { status: 'queued' }, value: jobs?.queued ?? 0 },
    { labels: { status: 'failed_24h' }, value: jobs?.failed ?? 0 },
  ]);
  const [tasks] = await q<{ c: number }>(sql`SELECT count(*)::int c FROM review_tasks WHERE status IN ('open','in_progress')`);
  gauge('histor_review_tasks_open', 'Tareas de revisión abiertas', [{ value: tasks?.c ?? 0 }]);
  const [lastRun] = await q<{ age: number }>(sql`SELECT extract(epoch from (now() - max(finished_at)))::float age FROM pipeline_runs WHERE ok = true`);
  gauge('histor_pipeline_last_success_age_seconds', 'Segundos desde la última etapa correcta', [{ value: Math.round(lastRun?.age ?? -1) }]);
  const mem = process.memoryUsage();
  gauge('histor_process_rss_bytes', 'Memoria residente', [{ value: mem.rss }]);
  return `${lines.join('\n')}\n`;
}

/** Envío mínimo de una excepción a Sentry (protocolo "store") si hay DSN. */
export async function reportError(err: unknown, context: Record<string, unknown> = {}): Promise<void> {
  logger.error({ err, ...context }, 'error');
  const dsn = env().SENTRY_DSN;
  if (!dsn) return;
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, '');
    const key = u.username;
    const e = err instanceof Error ? err : new Error(String(err));
    await fetch(`${u.protocol}//${u.host}/api/${projectId}/store/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${key}, sentry_client=histor/0.1` },
      body: JSON.stringify({
        platform: 'node',
        level: 'error',
        environment: env().NODE_ENV,
        exception: { values: [{ type: e.name, value: e.message, stacktrace: { frames: (e.stack ?? '').split('\n').slice(1, 30).map((l) => ({ function: l.trim() })) } }] },
        extra: context,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* nunca fallar por culpa del reporte */
  }
}
