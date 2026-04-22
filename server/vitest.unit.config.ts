// Offline unit-test config — no Supabase, no network, no .env.test required.
// Use for prompt snapshots, schema tests, pure helper tests.
// Run: npm --workspace server run test:unit
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
    include: ['tests/unit/**/*.test.ts'],
    globals: false,
    // No setupFiles — these tests don't need DB or env.
  },
});
