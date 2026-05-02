import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { app } from '../helpers/app.js';

// Rate-limit smoke. Per audit F1, /api/generate and /api/stt had no limiter
// and were trivially abusable. This spec asserts the limiter is mounted by
// hitting the endpoint past the configured cap and looking for a 429.
//
// We use /api/generate with VALIDATION-error-shaped bodies (empty payload)
// so the requests fail FAST without spinning up any LLM call. The limiter
// runs BEFORE the handler, so VALIDATION 400s still count toward the bucket.
//
// Why VALIDATION not auth: /api/generate is intentionally unauthenticated
// (anon visitors can submit). The limit is the only line of defense.

describe('rate limit · /api/generate', () => {
  it('returns 429 once the per-IP cap is exceeded', async () => {
    const limit = 10;
    let last429: number | undefined;

    // Walk a few requests past the cap. Express adapter on supertest reuses a
    // connection per .post() so they share the same IP for the limiter.
    for (let i = 0; i < limit + 3; i++) {
      const res = await request(app)
        .post('/api/generate')
        .send({ userInput: '', lang: 'en' }); // intentional VALIDATION 400

      if (res.status === 429) {
        last429 = i;
        break;
      }
    }

    expect(last429, 'expected at least one 429 within cap+3 requests').not.toBeUndefined();
    // Cap is shared across the process; if other tests ran first the cap may
    // already be near-exhausted. We only require *some* 429 appeared.
    expect(last429!).toBeGreaterThanOrEqual(0);
    expect(last429!).toBeLessThanOrEqual(limit + 2);
  });
});

describe('rate limit · /api/stt', () => {
  it('returns 429 once the per-IP cap is exceeded', async () => {
    const limit = 20; // STT cap configured separately
    let last429: number | undefined;

    for (let i = 0; i < limit + 3; i++) {
      // Empty multipart → VALIDATION 400, but limiter still counts.
      const res = await request(app).post('/api/stt');

      if (res.status === 429) {
        last429 = i;
        break;
      }
    }

    expect(last429).not.toBeUndefined();
    expect(last429!).toBeLessThanOrEqual(limit + 2);
  });
});
