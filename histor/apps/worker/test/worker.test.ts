/**
 * El worker: una sola vuelta del pipeline a la vez aunque haya varias
 * réplicas (candado de Postgres) y la distribución de historias publicadas.
 */
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const URL = process.env.WORKER_TEST_DATABASE_URL ?? 'postgres://histor:histor@localhost:5432/histor_worker_test';
process.env.DATABASE_URL = URL;
process.env.DEMO_MODE = '1';
process.env.HISTOR_WORKER_NO_MAIN = '1';
process.env.SESSION_SECRETS ??= 'worker-test-secret-0123456789abcdef0123456789';
process.env.DATA_ENCRYPTION_KEY ??= 'worker-test-key-0123456789abcdef0123456789ab';

type Worker = typeof import('../src/index');
let w: Worker;
let core: {
  sql: typeof import('drizzle-orm').sql;
  getDb: typeof import('@histor/core/db/client').getDb;
  getSql: typeof import('@histor/core/db/client').getSql;
  closeDb: typeof import('@histor/core/db/client').closeDb;
};

beforeAll(async () => {
  const name = URL.split('/').pop()!;
  if (!/_test$/.test(name)) throw new Error('La base del test del worker debe terminar en _test');
  const admin = postgres(URL.replace(/\/[^/]+$/, '/postgres'), { onnotice: () => {} });
  const exists = await admin`SELECT 1 FROM pg_database WHERE datname = ${name}`;
  if (!exists.length) await admin.unsafe(`CREATE DATABASE ${name}`);
  await admin.end();

  const { sql } = await import('drizzle-orm');
  const client = await import('@histor/core/db/client');
  core = { sql, getDb: client.getDb, getSql: client.getSql, closeDb: client.closeDb };
  const db = client.getDb();
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await (await import('@histor/core/db/migrate')).runMigrations(URL);
  await (await import('@histor/core/db/seed')).seedReference(db);
  await (await import('@histor/core/demo/seed')).seedDemo(db);
  w = await import('../src/index');
}, 120_000);

afterAll(async () => {
  await core?.closeDb();
});

describe('worker', () => {
  it('si otra réplica tiene el candado, no ejecuta el pipeline; al soltarlo, sí', async () => {
    const other = await core.getSql().reserve();
    await other`SELECT pg_advisory_lock(${w.PIPELINE_LOCK})`;
    expect(await w.pipelineTick()).toBeNull();
    await other`SELECT pg_advisory_unlock(${w.PIPELINE_LOCK})`;
    other.release();
    const stats = await w.pipelineTick();
    expect(stats).not.toBeNull();
    expect(stats).toHaveProperty('verified');
  });

  it('distribuye una historia publicada: redes (DEMO nunca se publica en redes) y alertas', async () => {
    const db = core.getDb();
    const rows = (await db.execute(core.sql`SELECT story_id FROM articles WHERE status = 'published' LIMIT 1`)) as unknown as { story_id: number }[];
    expect(rows.length).toBe(1);
    await w.handlers['distribute:story']({ storyId: Number(rows[0].story_id) });
    const posts = (await db.execute(core.sql`SELECT status FROM social_posts`)) as unknown as { status: string }[];
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every((p) => p.status === 'skipped')).toBe(true);
  });
});
