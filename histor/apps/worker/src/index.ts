/**
 * Worker 24/7 de Histor. Tres bucles independientes:
 *  1. Pipeline: ingesta → normalización → agrupación → verificación →
 *     redacción → controles → publicación → vigilancia (cada PIPELINE_INTERVAL_SEC).
 *  2. Cola de trabajos (Postgres, FOR UPDATE SKIP LOCKED): distribución de
 *     cada historia publicada (alertas, redes), tareas manuales del panel.
 *  3. Periódicos: newsletters, publicación en redes, liberación de trabajos
 *     colgados y mantenimiento diario.
 * Un candado de Postgres garantiza que solo UN worker ejecuta el pipeline a
 * la vez aunque haya varias réplicas. Se detiene limpio con SIGTERM.
 */
import http from 'node:http';
import os from 'node:os';
import { closeDb, getDb, getSql } from '@histor/core/db/client';
import { env, isProduction, productionProblems } from '@histor/core/env';
import { enqueue, releaseStale, work } from '@histor/core/jobs/queue';
import { sendDueNewsletters } from '@histor/core/newsletter/index';
import { dispatchStoryAlerts } from '@histor/core/notify/index';
import { attachStoryImage } from '@histor/core/media/wikimedia';
import { pingIndexNow, storyUrls } from '@histor/core/seo/indexnow';
import { logger, reportError } from '@histor/core/observability/index';
import { maintenance, runPipelineOnce, type TickStats } from '@histor/core/pipeline/run';
import { publishQueuedPosts, queueSocialPosts } from '@histor/core/social/index';
import { sendDueBriefs } from '@histor/core/social/brief';

export const PIPELINE_LOCK = 724_001; // clave del candado consultivo de Postgres
const workerId = `${os.hostname()}:${process.pid}`;
const intervalSec = Math.max(15, Number(process.env.PIPELINE_INTERVAL_SEC) || 60);
const db = getDb();

const state = {
  startedAt: new Date(),
  lastTickAt: null as Date | null,
  lastTick: null as TickStats | null,
  lastError: null as string | null,
  ticks: 0,
  jobsDone: 0,
  jobsFailed: 0,
  stopping: false,
};

let lastLockWarning = 0;

async function withLock<T>(key: number, fn: () => Promise<T>): Promise<T | null> {
  // Candado de sesión: se toma y se suelta en la MISMA conexión reservada del pool.
  const conn = await getSql().reserve();
  try {
    const [row] = await conn`SELECT pg_try_advisory_lock(${key}) AS ok`;
    if (!row?.ok) {
      // Antes se saltaba el ciclo en silencio: 40 minutos sin publicar y sin una línea en los registros.
      if (Date.now() - lastLockWarning > 10 * 60_000) {
        lastLockWarning = Date.now();
        const holders = await conn`SELECT a.pid, a.state, a.backend_start, a.application_name FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid WHERE l.locktype = 'advisory' AND l.objid = ${key} AND l.granted`;
        logger.warn({ key, holders }, 'candado ocupado: se salta el ciclo');
      }
      return null;
    }
    try {
      return await fn();
    } finally {
      await conn`SELECT pg_advisory_unlock(${key})`;
    }
  } finally {
    conn.release();
  }
}

/**
 * Al arrancar, libera los candados del ciclo que retenga la conexión de un worker anterior.
 * Cada despliegue reinicia la máquina de golpe; su conexión a Postgres puede quedar colgada y
 * seguir reteniendo el candado hasta que la base lo note (horas): el worker nuevo se saltaba
 * todos los ciclos sin decir nada (30-09-2026). Solo hay UN worker (fly.toml), así que al
 * arrancar cualquier otro poseedor es un proceso muerto. Si algún día hay varios, revisar esto.
 */
async function releaseOrphanLocks() {
  try {
    const rows = await getSql()`
      SELECT l.pid, a.backend_start FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE l.locktype = 'advisory' AND l.granted AND l.objid IN (${PIPELINE_LOCK}, ${PIPELINE_LOCK + 1}) AND l.pid <> pg_backend_pid()`;
    for (const r of rows) {
      await getSql()`SELECT pg_terminate_backend(${r.pid})`;
      logger.warn({ pid: r.pid, since: r.backend_start }, 'candado de un worker anterior liberado');
    }
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'no se pudo revisar los candados');
  }
}

export async function pipelineTick(): Promise<TickStats | null> {
  const e = env();
  // En DEMO no se lee la red: la demo se carga con `demo:seed`. Sin INGEST_ENABLED
  // tampoco (útil para entornos de prueba); la verificación y la vigilancia siguen.
  const ingest = e.INGEST_ENABLED && !e.DEMO_MODE;
  return withLock(PIPELINE_LOCK, async () => {
    const stats = await runPipelineOnce(db, { ingest, onlyDemo: e.DEMO_MODE ? true : false });
    state.ticks++;
    state.lastTickAt = new Date();
    state.lastTick = stats;
    state.lastError = null;
    if (Object.values(stats).some((v) => (typeof v === 'number' ? v > 0 : !!v))) logger.info({ stats }, 'pipeline');
    return stats;
  });
}

export const handlers = {
  'distribute:story': async (p: Record<string, unknown>) => {
    const storyId = Number(p.storyId);
    // Imagen ilustrativa con licencia libre (Wikimedia Commons), si la historia aún no tiene.
    const image = await attachStoryImage(db, storyId).catch((e) => `error: ${(e as Error).message}`);
    const social = await queueSocialPosts(db, storyId);
    const alerts = await dispatchStoryAlerts(db, storyId);
    // Aviso inmediato a los buscadores (IndexNow) de la noticia nueva o actualizada.
    const indexnow = await pingIndexNow(await storyUrls(db, storyId));
    logger.info({ storyId, image, social, alerts, indexnow }, 'distribución');
  },
  'pipeline:tick': async () => {
    await pipelineTick();
  },
  'newsletters:send': async () => {
    const r = await sendDueNewsletters(db);
    logger.info(r, 'newsletters');
  },
};

function loop(name: string, everyMs: number, fn: () => Promise<unknown>) {
  let timer: NodeJS.Timeout | null = null;
  const run = async () => {
    if (state.stopping) return;
    try {
      await fn();
    } catch (err) {
      state.lastError = `${name}: ${(err as Error).message}`;
      logger.error({ err, loop: name }, 'error en bucle');
      await reportError(err, { loop: name });
    }
    if (!state.stopping) timer = setTimeout(run, everyMs);
  };
  timer = setTimeout(run, 500);
  return () => timer && clearTimeout(timer);
}

async function main() {
  if (isProduction()) {
    const problems = productionProblems();
    if (problems.length) logger.warn({ problems }, 'configuración de producción incompleta');
  }
  logger.info({ workerId, intervalSec, demo: env().DEMO_MODE, ingest: env().INGEST_ENABLED }, 'worker arrancado');
  await releaseOrphanLocks();

  const stops = [
    loop('pipeline', intervalSec * 1000, pipelineTick),
    loop('jobs', 2000, async () => {
      const r = await work(db, workerId, handlers, { limit: 5 });
      state.jobsDone += r.done;
      state.jobsFailed += r.failed;
    }),
    loop('periodic', 5 * 60_000, async () => {
      await enqueue(db, 'newsletters:send', {}, { uniqueKey: 'newsletters:send' });
      const posts = await publishQueuedPosts(db);
      // «Las claves del día» a las 8:00 y a las 20:00 en cada canal de Telegram.
      const briefs = await sendDueBriefs(db).catch((e) => {
        logger.warn({ err: String((e as Error).message) }, 'resumen del día fallido');
        return [] as string[];
      });
      if (briefs.length) logger.info({ briefs }, 'resumen del día enviado');
      const released = await releaseStale(db, 15);
      if (posts.posted || posts.failed || released) logger.info({ posts, released }, 'periódico');
    }),
    loop('maintenance', 6 * 3600_000, async () => {
      const r = await withLock(PIPELINE_LOCK + 1, () => maintenance(db));
      if (r) logger.info(r, 'mantenimiento');
    }),
  ];

  // Salud del worker (para el orquestador): 200 si el pipeline ha corrido hace poco.
  const port = Number(process.env.WORKER_HEALTH_PORT) || 8081;
  const server = http
    .createServer((req, res) => {
      const staleMs = state.lastTickAt ? Date.now() - state.lastTickAt.getTime() : Date.now() - state.startedAt.getTime();
      const healthy = staleMs < Math.max(10 * 60_000, intervalSec * 5000);
      res.writeHead(req.url === '/health' ? (healthy ? 200 : 503) : 404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: healthy, workerId, ...state }));
    })
    .listen(port, () => logger.info({ port }, 'salud del worker escuchando'));

  const shutdown = async (sig: string) => {
    if (state.stopping) return;
    state.stopping = true;
    logger.info({ sig }, 'parando worker');
    stops.forEach((s) => s());
    server.close();
    // Da tiempo a que termine el trabajo en curso.
    await new Promise((r) => setTimeout(r, 3000));
    await closeDb();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

if (process.env.HISTOR_WORKER_NO_MAIN !== '1') {
  main().catch(async (err) => {
    logger.fatal({ err }, 'el worker no ha podido arrancar');
    await reportError(err, { phase: 'boot' });
    process.exit(1);
  });
}
