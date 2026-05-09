// ───────────────────────────────────────────
// rateLimit middleware unit tests (focused on the module's exports)
//
// 之前 mutation: 0% / 19 NoCoverage —— 因为 rateLimit.test.ts 是 integration
// (走 vitest.config.ts，跑 .env.test 真打 Supabase)，但 Stryker 跑 unit
// 配置看不到。这层用 micro express app + supertest 做纯 unit，不依赖 DB。
//
// 重叠度：跟 tests/routes/rateLimit.test.ts 有部分行为重叠，但角色不同：
//   - integration 验整个 app 链路（helmet + cors + body parse + limiter + route）
//   - 这层 unit 验 limiter 模块自身的常量 + skip 函数 + 配置
// ───────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';

import {
  GENERATE_RATE_LIMIT,
  STT_RATE_LIMIT,
  generateLimiter,
  sttLimiter,
} from '../../src/middleware/rateLimit.js';

let originalNodeEnv: string | undefined;

beforeEach(() => {
  originalNodeEnv = process.env.NODE_ENV;
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe('rate-limit constants', () => {
  it('GENERATE_RATE_LIMIT is 10 (audited cap for /api/generate)', () => {
    // mutation `60 * 1000` → `60 / 1000` 之类的算术 mutation 不影响这个常量；
    // 但 limit: 10 改成 limit: 0 / Infinity 这种 mutation 会让 spec 挂
    expect(GENERATE_RATE_LIMIT).toBe(10);
  });

  it('STT_RATE_LIMIT is 20 (audited cap for /api/stt)', () => {
    expect(STT_RATE_LIMIT).toBe(20);
  });

  it('STT cap > Generate cap (audio bursts more than text)', () => {
    // 防 STT/Generate 数字被互换的 mutation
    expect(STT_RATE_LIMIT).toBeGreaterThan(GENERATE_RATE_LIMIT);
  });
});

// micro express app: 只挂 generateLimiter，不要其它 middleware / DB
function buildAppWithLimiter(limiter: typeof generateLimiter) {
  const app = express();
  app.set('trust proxy', 'loopback');
  app.get('/limited', limiter, (_req, res) => res.json({ ok: true }));
  return app;
}

describe('skipInTestMode behavior', () => {
  it('NODE_ENV=test → skip 函数返 true → 限速旁路（任意请求数都 200）', async () => {
    process.env.NODE_ENV = 'test';
    const app = buildAppWithLimiter(generateLimiter);
    const ip = `10.0.0.50:${Date.now()}`;
    // 打 cap+5 个请求都不应该 429
    for (let i = 0; i < GENERATE_RATE_LIMIT + 5; i++) {
      const res = await request(app).get('/limited').set('X-Forwarded-For', ip);
      expect(res.status).toBe(200);
    }
  });

  it('NODE_ENV=production → 限速生效，第 cap+1 个请求 429', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildAppWithLimiter(generateLimiter);
    const ip = `10.0.0.51:${Date.now()}`;
    for (let i = 0; i < GENERATE_RATE_LIMIT; i++) {
      const res = await request(app).get('/limited').set('X-Forwarded-For', ip);
      expect(res.status).toBe(200);
    }
    const overflow = await request(app).get('/limited').set('X-Forwarded-For', ip);
    expect(overflow.status).toBe(429);
  });

  it('NODE_ENV=development → 限速生效（不在 test mode）', async () => {
    process.env.NODE_ENV = 'development';
    const app = buildAppWithLimiter(generateLimiter);
    const ip = `10.0.0.52:${Date.now()}`;
    for (let i = 0; i < GENERATE_RATE_LIMIT; i++) {
      await request(app).get('/limited').set('X-Forwarded-For', ip);
    }
    const overflow = await request(app).get('/limited').set('X-Forwarded-For', ip);
    expect(overflow.status).toBe(429);
  });

  it('NODE_ENV undefined → 限速生效（默认非 test 算 prod）', async () => {
    delete process.env.NODE_ENV;
    const app = buildAppWithLimiter(generateLimiter);
    const ip = `10.0.0.53:${Date.now()}`;
    for (let i = 0; i < GENERATE_RATE_LIMIT; i++) {
      await request(app).get('/limited').set('X-Forwarded-For', ip);
    }
    const overflow = await request(app).get('/limited').set('X-Forwarded-For', ip);
    expect(overflow.status).toBe(429);
  });
});

describe('limiter response payload', () => {
  it('429 response body has code=RATE_LIMITED', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildAppWithLimiter(generateLimiter);
    const ip = `10.0.0.60:${Date.now()}`;
    for (let i = 0; i < GENERATE_RATE_LIMIT; i++) {
      await request(app).get('/limited').set('X-Forwarded-For', ip);
    }
    const overflow = await request(app).get('/limited').set('X-Forwarded-For', ip);
    expect(overflow.body.code).toBe('RATE_LIMITED');
    expect(overflow.body.message).toMatch(/Too many requests/);
  });

  it('STT limiter 429 has separate message ("transcription requests")', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildAppWithLimiter(sttLimiter);
    const ip = `10.0.0.70:${Date.now()}`;
    for (let i = 0; i < STT_RATE_LIMIT; i++) {
      await request(app).get('/limited').set('X-Forwarded-For', ip);
    }
    const overflow = await request(app).get('/limited').set('X-Forwarded-For', ip);
    expect(overflow.status).toBe(429);
    expect(overflow.body.message).toMatch(/transcription requests/);
  });
});

describe('draft-7 RateLimit headers (well-behaved client self-throttle)', () => {
  it('successful request includes RateLimit + RateLimit-Policy headers', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildAppWithLimiter(generateLimiter);
    const ip = `10.0.0.80:${Date.now()}`;
    const res = await request(app).get('/limited').set('X-Forwarded-For', ip);
    expect(res.status).toBe(200);
    // draft-7 单 header 含 limit/remaining/reset
    expect(res.headers['ratelimit']).toBeDefined();
    expect(res.headers['ratelimit']).toMatch(new RegExp(`limit=${GENERATE_RATE_LIMIT}`));
    expect(res.headers['ratelimit-policy']).toBeDefined();
  });

  it('does NOT include legacy X-RateLimit-* headers (legacyHeaders=false)', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildAppWithLimiter(generateLimiter);
    const ip = `10.0.0.81:${Date.now()}`;
    const res = await request(app).get('/limited').set('X-Forwarded-For', ip);
    // legacy 名 X-RateLimit-* 不应该出现
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
    expect(res.headers['x-ratelimit-remaining']).toBeUndefined();
  });
});
