// Loaded by vitest before any test file. Reads .env.test from repo root and
// fails fast if the test Supabase URL matches prod (guard against wiping
// production data with truncate helpers).

import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const envPath = path.join(repoRoot, '.env.test');
const prodEnvPath = path.join(repoRoot, '.env');

if (!fs.existsSync(envPath)) {
  throw new Error(
    `.env.test not found at ${envPath} — copy .env.test.example and fill from your TEST Supabase project.`,
  );
}

for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_JWT_SECRET'] as const;
for (const key of required) {
  if (!process.env[key]) throw new Error(`.env.test missing ${key}`);
}

// Hard guard: if .env exists and its SUPABASE_URL matches .env.test's, abort.
if (fs.existsSync(prodEnvPath)) {
  const prodLines = fs.readFileSync(prodEnvPath, 'utf8').split('\n');
  for (const line of prodLines) {
    const m = line.match(/^\s*SUPABASE_URL\s*=\s*(.*)$/);
    if (m) {
      const prodUrl = m[1].replace(/^["']|["']$/g, '').trim();
      if (prodUrl && prodUrl === process.env.SUPABASE_URL) {
        throw new Error(
          'SUPABASE_URL in .env.test matches .env — refusing to run tests against production.',
        );
      }
    }
  }
}
