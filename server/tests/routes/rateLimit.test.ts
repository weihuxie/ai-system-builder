import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { app } from '../helpers/app.js';
import { GENERATE_RATE_LIMIT, STT_RATE_LIMIT } from '../../src/middleware/rateLimit.js';

// F (audit Top-1): 之前 spec 自承 flaky —— "cap 跨测试累计" 注释直接
// 写在源码里，断言降到 "some 429 出现过"。这版重写：
//   - 限速器默认 `skip: NODE_ENV === 'test'` 旁路（避免跨测试串扰）
//   - 本 spec 临时把 NODE_ENV 切到 'production' 让限速真生效
//   - 断言精确：第 limit 个请求 not 429，第 limit+1 个 429
//   - 每个 it 单独切 NODE_ENV + 用全新 supertest agent（独立 session，
//     默认相同 source IP，但限速 store 在每个 it 之间通过 windowMs=60s
//     fixed window 自然不交叉 —— 实际上还是会交叉因为是同一个 store。
//     所以每条 it 也要 reset。）
//
// 关于 reset：express-rate-limit v8 没在 limiter 上直接暴露 store，但
// 我们通过 supertest IP 跑测试时可以用 `X-Forwarded-For` 给每条 it 用
// 不同 IP 实现 store 分桶 —— store 还在但每条 it 看到的是空桶。

const TEST_IP_GEN = '10.0.0.1';
const TEST_IP_STT = '10.0.0.2';

let originalNodeEnv: string | undefined;

beforeEach(() => {
  // 切到 production 让 skip 函数返 false → 限速真生效
  originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe('rate limit · /api/generate', () => {
  it('exactly limit requests return non-429; the next one returns 429', async () => {
    // 用唯一 IP 隔离 — 即使 store 共享，每个 IP 的桶独立
    const ip = `${TEST_IP_GEN}:${Date.now()}`;

    // 头 limit 个请求：非 429（这里是 400 VALIDATION 因为 body 缺失）
    for (let i = 0; i < GENERATE_RATE_LIMIT; i++) {
      const res = await request(app)
        .post('/api/generate')
        .set('X-Forwarded-For', ip)
        .send({ userInput: '', lang: 'en' });
      expect(res.status, `req ${i + 1} of ${GENERATE_RATE_LIMIT} should NOT be 429`).not.toBe(429);
    }

    // 第 limit+1 个：必 429
    const overflow = await request(app)
      .post('/api/generate')
      .set('X-Forwarded-For', ip)
      .send({ userInput: '', lang: 'en' });
    expect(overflow.status).toBe(429);
    expect(overflow.body.code).toBe('RATE_LIMITED');
  });

  it('429 response includes draft-7 RateLimit header (single combined)', async () => {
    const ip = `${TEST_IP_GEN}:${Date.now()}-headers`;

    // 打满 cap
    for (let i = 0; i < GENERATE_RATE_LIMIT + 1; i++) {
      await request(app)
        .post('/api/generate')
        .set('X-Forwarded-For', ip)
        .send({ userInput: '', lang: 'en' });
    }

    // 再打一个看 429 header
    const res = await request(app)
      .post('/api/generate')
      .set('X-Forwarded-For', ip)
      .send({ userInput: '', lang: 'en' });
    expect(res.status).toBe(429);
    // draft-7 把 limit/remaining/reset 合在单个 `RateLimit` header 里，结构
    // 化字段值。让 well-behaved client 自我节流。
    expect(res.headers['ratelimit']).toBeDefined();
    expect(res.headers['ratelimit']).toMatch(new RegExp(`limit=${GENERATE_RATE_LIMIT}`));
    expect(res.headers['ratelimit']).toMatch(/remaining=0/);
    expect(res.headers['ratelimit-policy']).toBeDefined();
  });

  it('different IPs get separate buckets', async () => {
    const ipA = `${TEST_IP_GEN}:${Date.now()}-A`;
    const ipB = `${TEST_IP_GEN}:${Date.now()}-B`;

    // 用 ipA 打满
    for (let i = 0; i < GENERATE_RATE_LIMIT; i++) {
      await request(app).post('/api/generate').set('X-Forwarded-For', ipA).send({ userInput: '', lang: 'en' });
    }
    const aOver = await request(app)
      .post('/api/generate')
      .set('X-Forwarded-For', ipA)
      .send({ userInput: '', lang: 'en' });
    expect(aOver.status).toBe(429); // ipA 桶满

    // ipB 第一次请求应该不 429（独立桶）
    const bFirst = await request(app)
      .post('/api/generate')
      .set('X-Forwarded-For', ipB)
      .send({ userInput: '', lang: 'en' });
    expect(bFirst.status).not.toBe(429);
  });
});

describe('rate limit · /api/stt', () => {
  it('exactly STT_RATE_LIMIT requests return non-429; the next one returns 429', async () => {
    const ip = `${TEST_IP_STT}:${Date.now()}`;

    for (let i = 0; i < STT_RATE_LIMIT; i++) {
      const res = await request(app).post('/api/stt').set('X-Forwarded-For', ip);
      expect(res.status, `req ${i + 1} should NOT be 429`).not.toBe(429);
    }

    const overflow = await request(app).post('/api/stt').set('X-Forwarded-For', ip);
    expect(overflow.status).toBe(429);
    expect(overflow.body.code).toBe('RATE_LIMITED');
  });
});

describe('rate limit · skip in test mode (regression lock)', () => {
  // 反向锁：NODE_ENV='test' 时不应触发限速。这条让"如果有人不小心
  // 删了 skip 函数 → 整个 vitest 集成套件被 429 掉" 这种 regression
  // 立刻被发现。
  it('does NOT 429 when NODE_ENV=test (default vitest env)', async () => {
    process.env.NODE_ENV = 'test';
    const ip = `10.0.0.99:${Date.now()}`;
    // 打 50 个（远超任何 cap），全都不应该 429
    for (let i = 0; i < 50; i++) {
      const res = await request(app)
        .post('/api/generate')
        .set('X-Forwarded-For', ip)
        .send({ userInput: '', lang: 'en' });
      expect(res.status, `test-mode req ${i} should bypass limiter`).not.toBe(429);
    }
  });
});
