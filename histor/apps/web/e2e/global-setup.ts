import { execSync } from 'node:child_process';
import path from 'node:path';
import { E2E_DB, E2E_ENV } from '../playwright.config';

/** Base de datos nueva para cada ejecución: migraciones, referencia, DEMO (fases 1 y 2) y admin. */
export default async function globalSetup() {
  const admin = E2E_DB.replace(/\/[^/]+$/, '/postgres');
  const name = E2E_DB.split('/').pop()!;
  if (!/_e2e$/.test(name)) throw new Error('La base de E2E debe terminar en _e2e (se borra en cada ejecución).');
  // Opciones antes de la conexión y esta con -d: el psql de Windows no reordena
  // argumentos e ignoraba los -c puestos tras la URL (la base no se recreaba).
  execSync(`psql -q -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${name} WITH (FORCE)" -c "CREATE DATABASE ${name}" -d "${admin}"`, { stdio: 'inherit' });
  const cli = (args: string) =>
    execSync(`npx tsx src/cli.ts ${args}`, { cwd: path.resolve(__dirname, '../../worker'), stdio: 'inherit', env: { ...process.env, ...E2E_ENV, NODE_ENV: 'development' } });
  cli('demo:seed');
  cli('demo:seed --phase=2');
  cli('create-admin');
}
