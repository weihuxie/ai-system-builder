// ───────────────────────────────────────────
// Rate limit middleware factory + reset helpers (test isolation)
//
// 之前 limiter 直接 inline 在 app.ts，store 跨进程跨测试共享，导致：
//   - rateLimit.test.ts 自承 flaky："cap 跨测试累计"
//   - chainFailover.test.ts 加新 case 时第 N 个请求被 429 而不是按预期
//     的契约失败
//
// 这层抽出后：
//   - 生产行为完全不变（仍然每 IP 60s 内 generate 10 次 / stt 20 次）
//   - 测试 beforeEach 调 resetRateLimitsForTests() 拿干净 store
//   - 限速 cap 常量也 export 出去，让 spec 可以精确验 limit / limit+1
//
// CLAUDE.md §4.5 F1 + audit Top-1 收尾。
// ───────────────────────────────────────────

import { rateLimit } from 'express-rate-limit';

export const GENERATE_RATE_LIMIT = 10; // per IP per 60s window
export const STT_RATE_LIMIT = 20;

// 限速跳过规则：NODE_ENV='test' 默认旁路，避免 vitest 跨测试串扰把不该
// 测限速的契约挂掉（chainFailover 第 11 个请求被 429 而不是按预期失败）。
// rateLimit.test.ts 需要测限速本身时显式临时改 NODE_ENV='production'。
//
// 生产 (NODE_ENV !== 'test') 时 skip 永远 false，限速正常工作。
const skipInTestMode = () => process.env.NODE_ENV === 'test';

export const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: GENERATE_RATE_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Too many requests. Try again in a minute.' },
  skip: skipInTestMode,
});

export const sttLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: STT_RATE_LIMIT,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Too many transcription requests. Try again in a minute.' },
  skip: skipInTestMode,
});
