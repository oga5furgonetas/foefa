import { defineConfig, devices } from '@playwright/test';

/**
 * E2E contra el servidor de producción (`next start`) y una base de datos
 * propia sembrada con el escenario DEMO. Requiere PostgreSQL (E2E_DATABASE_URL).
 *   npx next build && npx playwright test
 */
const PORT = Number(process.env.E2E_PORT ?? 3200);
export const BASE = `http://localhost:${PORT}`;
export const E2E_DB = process.env.E2E_DATABASE_URL ?? 'postgres://histor:histor@localhost:5432/histor_e2e';

const env = {
  DATABASE_URL: E2E_DB,
  DEMO_MODE: '1',
  PUBLIC_BASE_URL: BASE,
  SESSION_SECRETS: 'e2e-only-secret-not-for-production-0123456789abcdef',
  DATA_ENCRYPTION_KEY: 'e2e-only-key-not-for-production-0123456789abcdef',
  ANALYTICS_SALT: 'e2e-salt',
  ADMIN_EMAIL: 'admin@e2e.test',
  ADMIN_PASSWORD: 'e2e-admin-password-123',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 30_000,
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: BASE, locale: 'es-ES', trace: 'retain-on-failure' },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] }, testMatch: /site\.spec/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    // Sin base de datos (la crea el globalSetup, que corre después de arrancar el servidor).
    url: `${BASE}/manifest.webmanifest`,
    reuseExistingServer: false,
    timeout: 60_000,
    env,
  },
});

export { env as E2E_ENV };
