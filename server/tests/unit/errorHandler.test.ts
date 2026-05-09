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

  it('keeps full rawText payload (negative case for prod-strip)', async () => {
    // 反向断言：在 dev 下 rawText 必须出现在 response。Stryker 之前把
    // line 35 的 `process.env.NODE_ENV === 'production'` 改成 `true`
    // (永远 strip) 时，prod 测试仍绿，但这条测试会挂。
    const res = await request(buildApp()).get('/leak-test/ai-parse');
    expect(res.body.details).toMatchObject({
      rawText: 'I am secret raw output from the model',
    });
  });
});

describe('errorHandler · non-Error payloads (defensive logging path)', () => {
  // Stryker line 47 LogicalOperator (`||` → `&&`) 和 OptionalChaining 在
  // 当前 control flow 下是 **等价 mutation**：err 实际从不为 null
  // (Express 把 null next() 当 "continue"，不进 errorHandler)，所以 `?.`
  // 跟 `.` 行为一致。诚实做法是把这归为 "equivalent mutation" 接受 survive
  // ——而不是写测试硬撑。
  //
  // 但 String fallback (line 47 末尾 `?? String(err)`) 在 err.message 缺失
  // 时会触发，这条**可以**测：传一个普通 object（不是 Error 实例、没 message）
  // 走 unknown 分支，断言 res 仍干净。

  it('handles plain string thrown via next()', async () => {
    const app = express();
    app.get('/x', (_req, _res, next) => {
      next('plain string error' as unknown as Error);
    });
    app.use(errorHandler);
    const res = await request(app).get('/x');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL');
    // String 错误内容不能泄露
    expect(JSON.stringify(res.body)).not.toContain('plain string error');
  });

  it('handles object without message/stack via next()', async () => {
    const app = express();
    app.get('/x', (_req, _res, next) => {
      next({ weird: true } as unknown as Error);
    });
    app.use(errorHandler);
    const res = await request(app).get('/x');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ code: 'INTERNAL', message: 'Internal server error' });
  });
});

describe('errorHandler · HttpError without details', () => {
  // 锁住 HttpError 在 details=undefined 时不挂、不偷渡 details key。
  // prod-strip 分支的 short-circuit (line 35 `body.details !== undefined`)
  // 之前被 Stryker 改成 `true` 时仍绿——补这条让两个分支都被验。

  it('returns clean { code, message } when HttpError has no details (prod)', async () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const app = express();
      app.get('/no-details', (_req, _res, next) => {
        next(new HttpError(404, 'NOT_FOUND', 'Resource missing'));
      });
      app.use(errorHandler);
      const res = await request(app).get('/no-details');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ code: 'NOT_FOUND', message: 'Resource missing' });
      expect('details' in res.body).toBe(false);
    } finally {
      process.env.NODE_ENV = orig;
    }
  });

  it('returns clean { code, message } when HttpError has no details (dev)', async () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const app = express();
      app.get('/no-details-dev', (_req, _res, next) => {
        next(new HttpError(404, 'NOT_FOUND', 'Resource missing'));
      });
      app.use(errorHandler);
      const res = await request(app).get('/no-details-dev');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(res.body.message).toBe('Resource missing');
      // dev 里 details=undefined 也不应该出现在 JSON
      expect(JSON.stringify(res.body)).not.toMatch(/"details"/);
    } finally {
      process.env.NODE_ENV = orig;
    }
  });
});

describe('errorHandler · HttpError status code preservation', () => {
  // 锁住非 5xx 状态码也按 HttpError 走（不会被 unknown 路径吞成 500）。
  // 之前测试只验了 502 和 500，403/404 等通用 4xx 没显式测过。
  it('preserves 401 / 403 / 404 / 422 (4xx range)', async () => {
    for (const status of [401, 403, 404, 422] as const) {
      const app = express();
      app.get('/x', (_req, _res, next) => {
        next(new HttpError(status, 'VALIDATION', `status ${status}`));
      });
      app.use(errorHandler);
      const res = await request(app).get('/x');
      expect(res.status).toBe(status);
    }
  });
});
