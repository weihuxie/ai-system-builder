import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';

import { errorHandler, HttpError } from '../../src/middleware/errors.js';

// F6: errorHandler must not leak server-internal payloads (rawText, stack)
// to clients in production. In dev, full details flow through to ease
// debugging. The discriminator is NODE_ENV.
//
// Examples of what could leak today:
//   - generate.ts: throw new HttpError(502, 'AI_PARSE', '...', { rawText, trace })
//     → rawText is the LLM's verbatim output (could include the user's input
//       reformatted, or hallucinations not safe to surface)
//   - any catch-all 500 with .stack ending up in details
//
// Contract:
//   prod: { code, message } only — details stripped
//   dev:  { code, message, details } — full passthrough

function buildApp() {
  const app = express();
  app.get('/leak-test/:kind', (req, _res, next) => {
    if (req.params.kind === 'ai-parse') {
      next(
        new HttpError(502, 'AI_PARSE', 'Model returned non-JSON', {
          rawText: 'I am secret raw output from the model',
          trace: [{ providerId: 'gemini', model: 'flash', outcome: 'success' }],
        }),
      );
      return;
    }
    if (req.params.kind === 'unknown') {
      next(new Error('boom — internal detail with stack secret'));
      return;
    }
    next();
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler · prod sanitisation', () => {
  const orig = process.env.NODE_ENV;
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
  });
  afterEach(() => {
    process.env.NODE_ENV = orig;
  });

  it('strips details from HttpError responses in production', async () => {
    const res = await request(buildApp()).get('/leak-test/ai-parse');
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('AI_PARSE');
    expect(res.body.message).toBe('Model returned non-JSON');
    // Critical: the rawText / trace must NOT be in the response.
    expect(res.body.details).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('I am secret raw output');
    expect(JSON.stringify(res.body)).not.toContain('trace');
  });

  it('returns generic 500 INTERNAL with no stack on unknown errors', async () => {
    const res = await request(buildApp()).get('/leak-test/unknown');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ code: 'INTERNAL', message: 'Internal server error' });
    // No stack leaked
    expect(JSON.stringify(res.body)).not.toContain('boom');
    expect(JSON.stringify(res.body)).not.toContain('at ');
  });
});

describe('errorHandler · dev passthrough', () => {
  const orig = process.env.NODE_ENV;
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });
  afterEach(() => {
    process.env.NODE_ENV = orig;
  });

  it('preserves details in development', async () => {
    const res = await request(buildApp()).get('/leak-test/ai-parse');
    expect(res.status).toBe(502);
    // Dev: full details for debugging.
    expect(res.body.details).toBeDefined();
    expect(JSON.stringify(res.body)).toContain('I am secret raw output');
  });
});
