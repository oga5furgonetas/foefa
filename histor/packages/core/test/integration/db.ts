import { sql } from 'drizzle-orm';
import { closeDb, getDb } from '../../src/db/client';
import { runMigrations } from '../../src/db/migrate';
import { seedReference } from '../../src/db/seed';

/** Base de pruebas limpia: esquema recreado, migraciones y datos de referencia. */
export async function freshDb() {
  const url = process.env.DATABASE_URL!;
  if (!/test/.test(url)) throw new Error(`Las pruebas de integración solo corren contra una base *_test (DATABASE_URL=${url})`);
  const db = getDb(url);
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await runMigrations(url);
  await seedReference(db);
  return db;
}

export async function done() {
  await closeDb();
}
