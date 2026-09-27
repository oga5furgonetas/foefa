import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { closeDb, getDb } from './client';

/**
 * Carpeta de migraciones: HISTOR_MIGRATIONS_DIR, o la del paquete (código
 * fuente), o la del monorepo (worker empaquetado en dist/).
 */
function findMigrationsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.HISTOR_MIGRATIONS_DIR,
    path.resolve(here, '../../migrations'),
    path.resolve(here, '../../../packages/core/migrations'),
    path.resolve(process.cwd(), 'packages/core/migrations'),
    path.resolve(process.cwd(), '../../packages/core/migrations'),
  ].filter((x): x is string => !!x);
  return candidates.find((d) => existsSync(path.join(d, 'meta', '_journal.json'))) ?? candidates[0];
}

export const MIGRATIONS_DIR = findMigrationsDir();

export async function runMigrations(url?: string): Promise<void> {
  await migrate(getDb(url), { migrationsFolder: MIGRATIONS_DIR });
}

// Solo al ejecutar este archivo directamente (no cuando va empaquetado dentro de otro).
const isMain = !!process.argv[1] && /db[\\/]migrate\.ts$/.test(process.argv[1]) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
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
