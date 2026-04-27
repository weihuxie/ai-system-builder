// ───────────────────────────────────────────
// Express app factory — separated from listen() so the same app
// can run under:
//   - Vercel Functions (api/index.ts wraps this)
//   - Local Express server (server/src/index.ts calls app.listen)
//   - Cloud Run container (also via index.ts)
//
// No env-loading (dotenv) happens here. That's the caller's job
// (local index.ts loads .env; Vercel injects env vars automatically).
// ───────────────────────────────────────────

import cors from 'cors';
import express from 'express';

import { adminRouter } from './routes/admin.js';
import { brandRouter } from './routes/brand.js';
import { generateRouter } from './routes/generate.js';
import { geoRouter } from './routes/geo.js';
import { llmRouter } from './routes/llm.js';
import { productsRouter } from './routes/products.js';
import { quickScenariosRouter } from './routes/quickScenarios.js';
import { sttRouter } from './routes/stt.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';

const app = express();

// CORS allowlist: union of
//   - explicit `ALLOWED_ORIGINS` (comma-separated, full URLs)
//   - `APP_URL`              (custom domain, e.g. https://summit.aiverygen.ai)
//   - `VERCEL_URL`           (auto-injected per deployment, e.g. ai-system-builder-xxx.vercel.app)
//   - `VERCEL_BRANCH_URL`    (stable preview URL per branch)
//   - `VERCEL_PROJECT_PRODUCTION_URL` (stable prod alias, e.g. ai-system-builder.vercel.app)
//   - `http://localhost:5173` (vite dev fallback)
// Rationale: Vercel auto-injects `VERCEL_URL` so preview deploys never break
// CORS, and `APP_URL` covers the custom domain so swapping domains only
// requires changing one env var. Drift in `ALLOWED_ORIGINS` was the cause of
// the summit.aiverygen.ai 500 outage on 2026-04-25.
const collectAllowedOrigins = (): string[] => {
  const seen = new Set<string>();
  const add = (raw: string | undefined): void => {
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    // VERCEL_URL etc. come without scheme — prepend https://
    const withScheme = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    seen.add(withScheme.replace(/\/$/, ''));
  };

  for (const v of (process.env.ALLOWED_ORIGINS || '').split(',')) add(v);
  add(process.env.APP_URL);
  add(process.env.VERCEL_URL);
  add(process.env.VERCEL_BRANCH_URL);
  add(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  add('http://localhost:5173');

  return [...seen];
};

const allowedOrigins = collectAllowedOrigins();

app.use(
  cors({
    origin: (origin, cb) => {
      // allow same-origin (no Origin header) and whitelisted
      // In Vercel production the frontend and API share origin, so `origin` is
      // typically undefined for same-origin fetches — pass through.
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      // Also allow any *.vercel.app preview belonging to any project — these
      // are short-lived deploy URLs; explicit listing is impractical.
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed`));
    },
    credentials: false,
  }),
);
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    ts: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    runtime: process.env.VERCEL ? 'vercel' : 'node',
  });
});

app.use('/api/generate', generateRouter);
app.use('/api/stt', sttRouter);
app.use('/api/products', productsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/brand', brandRouter);
app.use('/api/geo', geoRouter);
app.use('/api/llm-chain', llmRouter);
app.use('/api/quick-scenarios', quickScenariosRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
export default app;
