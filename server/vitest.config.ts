import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@asb/shared': resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Sequential — all tests hit the same test DB and truncate in setup.
    fileParallelism: false,
    pool: 'forks',
    forks: { singleFork: true },
    setupFiles: ['tests/helpers/setup.ts'],
  },
});
