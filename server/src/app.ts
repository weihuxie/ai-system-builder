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
import { sttRouter } from './routes/stt.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // allow same-origin (no Origin header) and whitelisted
      // In Vercel production the frontend and API share origin, so `origin` is
      // typically undefined for same-origin fetches — pass through.
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
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

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
export default app;
