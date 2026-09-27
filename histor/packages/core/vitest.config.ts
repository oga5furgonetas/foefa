import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 60000,
    // Los tests de integración comparten una base de datos: en serie.
    fileParallelism: false,
    setupFiles: ['test/setup.ts'],
  },
});
