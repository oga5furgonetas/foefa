import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

type Handle = { db: Db; sql: postgres.Sql };
const g = globalThis as unknown as { __historDb?: Map<string, Handle> };

/**
 * Una conexión por URL y proceso (en desarrollo Next recarga módulos: se
 * guarda en globalThis para no abrir un pool nuevo en cada recarga).
 */
export function getDb(url: string = env().DATABASE_URL): Db {
  return handle(url).db;
}

export function getSql(url: string = env().DATABASE_URL): postgres.Sql {
  return handle(url).sql;
}

function handle(url: string): Handle {
  g.__historDb ??= new Map();
  let h = g.__historDb.get(url);
  if (!h) {
    const sql = postgres(url, {
      max: env().DATABASE_POOL_MAX,
      idle_timeout: 30,
      connect_timeout: 10,
      onnotice: () => {},
    });
    h = { sql, db: drizzle(sql, { schema }) };
    g.__historDb.set(url, h);
  }
  return h;
}

export async function closeDb(url?: string): Promise<void> {
  const map = g.__historDb;
  if (!map) return;
  for (const [key, h] of map) {
    if (!url || key === url) {
      await h.sql.end({ timeout: 5 });
      map.delete(key);
    }
  }
}

export { schema };
