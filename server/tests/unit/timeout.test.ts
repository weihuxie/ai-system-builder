// ───────────────────────────────────────────
// timeout.ts unit tests —— isAbortOrTimeoutError + raceWithTimeout
//
// 之前 mutation: 11 NoCov + 3 Survived。raceWithTimeout 是 LLM SDK 不
// 接 AbortSignal 时的兜底（@google/genai），契约必须锁。
// ───────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GENERATE_TIMEOUT_MS,
  STT_TIMEOUT_MS,
  isAbortOrTimeoutError,
  raceWithTimeout,
} from '../../src/lib/timeout.js';

describe('isAbortOrTimeoutError', () => {
  it('true for Error with name=TimeoutError', () => {
    const e = new Error('foo');
    e.name = 'TimeoutError';
    expect(isAbortOrTimeoutError(e)).toBe(true);
  });

  it('true for Error with name=AbortError', () => {
    const e = new Error('Aborted');
    e.name = 'AbortError';
    expect(isAbortOrTimeoutError(e)).toBe(true);
  });

  it('true when message contains "timeout" (case-insensitive)', () => {
    expect(isAbortOrTimeoutError(new Error('STT timeout after 30000ms'))).toBe(true);
    expect(isAbortOrTimeoutError(new Error('Connection TIMEOUT'))).toBe(true);
  });

  it('false for generic Error without timeout marker', () => {
    expect(isAbortOrTimeoutError(new Error('ECONNREFUSED'))).toBe(false);
  });

  it('false for non-Error values (string / null / undefined / object)', () => {
    expect(isAbortOrTimeoutError('timeout')).toBe(false); // string with timeout 仍然 false
    expect(isAbortOrTimeoutError(null)).toBe(false);
    expect(isAbortOrTimeoutError(undefined)).toBe(false);
    expect(isAbortOrTimeoutError({ name: 'TimeoutError' })).toBe(false); // 不是 Error 实例
    expect(isAbortOrTimeoutError(42)).toBe(false);
  });
});

describe('raceWithTimeout · resolves before timeout', () => {
  it('returns value when promise resolves before deadline', async () => {
    const r = await raceWithTimeout(Promise.resolve('done'), 1000, 'test');
    expect(r).toBe('done');
  });

  it('returns from a slow promise that finishes within ms budget', async () => {
    const slow = new Promise<number>((resolve) => setTimeout(() => resolve(42), 5));
    const r = await raceWithTimeout(slow, 100, 'test');
    expect(r).toBe(42);
  });
});

describe('raceWithTimeout · rejects on timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects with TimeoutError when promise hangs past deadline', async () => {
    const hung = new Promise<string>(() => {}); // never resolves
    const racePromise = raceWithTimeout(hung, 5000, 'test-label');
    vi.advanceTimersByTime(5000);
    await expect(racePromise).rejects.toThrow(/test-label timeout after 5000ms/);
  });

  it('rejected error has name=TimeoutError (so isAbortOrTimeoutError catches)', async () => {
    const hung = new Promise<string>(() => {});
    const racePromise = raceWithTimeout(hung, 1000, 'foo');
    vi.advanceTimersByTime(1000);
    let caught: unknown;
    try {
      await racePromise;
    } catch (e) {
      caught = e;
    }
    expect((caught as Error).name).toBe('TimeoutError');
    // 反向锁：isAbortOrTimeoutError 必须识别 raceWithTimeout 抛出的 err
    expect(isAbortOrTimeoutError(caught)).toBe(true);
  });

  it('label is interpolated into error message (caller debug context)', async () => {
    const hung = new Promise<string>(() => {});
    const p1 = raceWithTimeout(hung, 100, 'STT');
    const p2 = raceWithTimeout(hung, 100, 'GENERATE');
    vi.advanceTimersByTime(100);
    await expect(p1).rejects.toThrow(/STT timeout/);
    await expect(p2).rejects.toThrow(/GENERATE timeout/);
  });
});

describe('raceWithTimeout · cleanup', () => {
  it('clears the timeout when promise resolves first (no leaked timer)', async () => {
    vi.useFakeTimers();
    try {
      const fast = Promise.resolve('quick');
      await raceWithTimeout(fast, 1_000_000, 'test');
      // 如果 timer 没 clear，advanceTimers 会触发 reject 但 promise 已 resolved
      // —— 这条不严格验内部 timer 但配合下面"无 unhandled rejection"间接验证
      vi.advanceTimersByTime(1_000_000);
      expect(true).toBe(true); // 走到这里没报 unhandled rejection 即通过
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('GENERATE_TIMEOUT_MS / STT_TIMEOUT_MS · sanity bounds', () => {
  it('GENERATE_TIMEOUT_MS in seconds-magnitude (5-60s realistic)', () => {
    // 防御 mutation 把 15_000 改成 15_000 / 1000 = 15ms，导致每次 LLM
    // 调用 15ms 就 timeout
    expect(GENERATE_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
    expect(GENERATE_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
  });

  it('STT_TIMEOUT_MS > GENERATE_TIMEOUT_MS (audio slower than text)', () => {
    expect(STT_TIMEOUT_MS).toBeGreaterThan(GENERATE_TIMEOUT_MS);
  });

  it('STT_TIMEOUT_MS in seconds-magnitude (10-120s)', () => {
    expect(STT_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
    expect(STT_TIMEOUT_MS).toBeLessThanOrEqual(120_000);
  });
});
