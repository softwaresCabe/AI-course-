import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // `server-only` throws outside React Server Components; tests import server modules directly.
    alias: { 'server-only': fileURLToPath(new URL('./tests/empty.ts', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // DB-backed suites share one database; run files serially.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
