import { defineConfig, devices } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.test from repo root so Playwright's webServer and test specs share
// the same test-project Supabase credentials. dotenv isn't a dep here — parse
// manually to avoid adding one just for config loading.
const envPath = path.resolve(__dirname, '..', '.env.test');
const prodEnvPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// Prod-guard: abort if .env.test's SUPABASE_URL matches the prod .env.
if (fs.existsSync(prodEnvPath) && process.env.SUPABASE_URL) {
  for (const line of fs.readFileSync(prodEnvPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*SUPABASE_URL\s*=\s*(.*)$/);
    if (m) {
      const prodUrl = m[1].replace(/^["']|["']$/g, '').trim();
      if (prodUrl && prodUrl === process.env.SUPABASE_URL) {
        throw new Error(
          'Playwright: .env.test SUPABASE_URL matches .env — refusing to run E2E against production.',
        );
      }
    }
  }
}

const BASE_URL = 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'npm --workspace server run dev',
      port: 8080,
      cwd: path.resolve(__dirname, '..'),
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        PORT: '8080',
        SUPABASE_URL: process.env.SUPABASE_URL || '',
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
        SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || '',
        ALLOWED_ORIGINS: BASE_URL,
      },
      stdout: 'ignore',
      stderr: 'pipe',
      timeout: 30_000,
    },
    {
      command: 'npm --workspace client run dev',
      port: 5173,
      cwd: path.resolve(__dirname, '..'),
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
        VITE_API_BASE: '/api',
      },
      stdout: 'ignore',
      stderr: 'pipe',
      timeout: 30_000,
    },
  ],
});
