import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { closeDb, getDb } from './client';

export const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');

export async function runMigrations(url?: string): Promise<void> {
  await migrate(getDb(url), { migrationsFolder: MIGRATIONS_DIR });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  runMigrations()
    .then(async () => {
      console.log('Migraciones aplicadas.');
      await closeDb();
    })
    .catch(async (err) => {
      console.error('Fallo al migrar:', err);
      await closeDb();
      process.exit(1);
    });
}
