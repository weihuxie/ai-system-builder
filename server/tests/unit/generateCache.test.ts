import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  _peekGenerateCache,
  _resetGenerateCacheForTests,
  buildCacheKey,
  clearGenerateCache,
  readGenerateCache,
  writeGenerateCache,
} from '../../src/lib/generateCache.js';

import type { GenerateResponse } from '@asb/shared';

const fixtureResponse = (id: string): GenerateResponse => ({
  selectedProducts: [id, 'B', 'C'],
  rationale: { [id]: 'r1', B: 'r2', C: 'r3' },
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  latencyMs: 1234,
});

const baseInput = {
  userInput: 'we need CRM',
  lang: 'en' as const,
  brand: 'google',
  activeProductIds: ['A', 'B', 'C'] as const,
  llmChain: [{ providerId: 'gemini', model: 'gemini-2.5-flash', enabled: true }],
  temperature: 0.7,
};

afterEach(() => {
  // 物理清 Map + 重置 version。之前用 clearGenerateCache（仅 bump version）
  // 让某些 size-delta 测试因 store 残留 entries 串味（比如 bulk-eviction 测
  // 试填到 200 后下一个 size+1 断言失败）。
  _resetGenerateCacheForTests();
});

describe('buildCacheKey', () => {
  it('same input → same key (deterministic)', () => {
    const a = buildCacheKey(baseInput);
    const b = buildCacheKey(baseInput);
    expect(a).toBe(b);
  });

  it('product order should not change key (sorted internally)', () => {
    const a = buildCacheKey(baseInput);
    const b = buildCacheKey({ ...baseInput, activeProductIds: ['C', 'A', 'B'] });
    expect(a).toBe(b);
  });

  it('different userInput → different key', () => {
    const a = buildCacheKey(baseInput);
    const b = buildCacheKey({ ...baseInput, userInput: 'we need OMS' });
    expect(a).not.toBe(b);
  });

  it('different lang → different key', () => {
    const a = buildCacheKey(baseInput);
    const b = buildCacheKey({ ...baseInput, lang: 'ja' });
    expect(a).not.toBe(b);
  });

  it('different brand → different key (rationale tone changes)', () => {
    const a = buildCacheKey(baseInput);
    const b = buildCacheKey({ ...baseInput, brand: 'aws' });
    expect(a).not.toBe(b);
  });

  it('different temperature → different key (sampling differs)', () => {
    const a = buildCacheKey(baseInput);
    const b = buildCacheKey({ ...baseInput, temperature: 1.0 });
    expect(a).not.toBe(b);
  });

  it('different chain → different key (model swap changes output)', () => {
    const a = buildCacheKey(baseInput);
    const b = buildCacheKey({
      ...baseInput,
      llmChain: [{ providerId: 'kimi', model: 'kimi-k2.6', enabled: true }],
    });
    expect(a).not.toBe(b);
  });

  it('returns 32-char hex string (sha256 truncated)', () => {
    const key = buildCacheKey(baseInput);
    expect(key).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe('readGenerateCache / writeGenerateCache', () => {
  it('returns undefined for missing key', () => {
    expect(readGenerateCache('does-not-exist')).toBeUndefined();
  });

  it('returns same response written', () => {
    const key = buildCacheKey(baseInput);
    writeGenerateCache(key, fixtureResponse('A'));
    expect(readGenerateCache(key)).toEqual(fixtureResponse('A'));
  });

  it('two distinct inputs cache independently', () => {
    const k1 = buildCacheKey(baseInput);
    const k2 = buildCacheKey({ ...baseInput, userInput: 'different' });
    writeGenerateCache(k1, fixtureResponse('A'));
    writeGenerateCache(k2, fixtureResponse('X'));
    expect(readGenerateCache(k1)?.selectedProducts[0]).toBe('A');
    expect(readGenerateCache(k2)?.selectedProducts[0]).toBe('X');
  });
});

describe('clearGenerateCache (invalidation)', () => {
  it('all subsequent reads of pre-existing keys return undefined', () => {
    const k1 = buildCacheKey(baseInput);
    const k2 = buildCacheKey({ ...baseInput, userInput: 'different' });
    writeGenerateCache(k1, fixtureResponse('A'));
    writeGenerateCache(k2, fixtureResponse('X'));
    expect(readGenerateCache(k1)).toBeDefined();

    clearGenerateCache();

    expect(readGenerateCache(k1)).toBeUndefined();
    expect(readGenerateCache(k2)).toBeUndefined();
  });

  it('writes after clear are still readable', () => {
    const key = buildCacheKey(baseInput);
    writeGenerateCache(key, fixtureResponse('A'));
    clearGenerateCache();
    expect(readGenerateCache(key)).toBeUndefined();

    writeGenerateCache(key, fixtureResponse('Z'));
    expect(readGenerateCache(key)?.selectedProducts[0]).toBe('Z');
  });
});

// ───────────────────────────────────────────
// Mutation-killing additions (Stryker baseline 2026-05 had 8 surviving mutants
// in this module: TTL arithmetic / size eviction boundary / sort no-op /
// userInput trim no-op). Tests below pin each contract.
// ───────────────────────────────────────────

describe('buildCacheKey · trim behavior (mutation kill: line 59 MethodExpression)', () => {
  it('normalizes leading/trailing whitespace in userInput', () => {
    // 之前如果把 `input.userInput.trim()` 改成 `input.userInput`（去掉
    // .trim()），现有测试都用 already-trimmed 字符串，不会挂。
    const a = buildCacheKey({ ...baseInput, userInput: 'we need CRM' });
    const b = buildCacheKey({ ...baseInput, userInput: '  we need CRM  ' });
    expect(a).toBe(b);
  });

  it('does NOT normalize internal whitespace', () => {
    // sanity: trim 只去首尾，中间空格不能合并
    const a = buildCacheKey({ ...baseInput, userInput: 'we  need  CRM' });
    const b = buildCacheKey({ ...baseInput, userInput: 'we need CRM' });
    expect(a).not.toBe(b);
  });
});

describe('buildCacheKey · sort actually uses input (mutation kill: line 57 ArrayDeclaration → [])', () => {
  it('different product sets produce different keys', () => {
    // 之前如果把 `[...input.activeProductIds].sort()` 改成 `[]`，
    // sorted 永远空，所有产品集合的 key 都一样 → cache 串味（CRM 的答案
    // 给 ERP 用户）。
    const a = buildCacheKey({ ...baseInput, activeProductIds: ['A', 'B', 'C'] });
    const b = buildCacheKey({ ...baseInput, activeProductIds: ['X', 'Y', 'Z'] });
    expect(a).not.toBe(b);
  });

  it('subset of products produces different key', () => {
    const a = buildCacheKey({ ...baseInput, activeProductIds: ['A', 'B', 'C'] });
    const b = buildCacheKey({ ...baseInput, activeProductIds: ['A', 'B'] });
    expect(a).not.toBe(b);
  });
});

describe('readGenerateCache · TTL boundary (mutation kill: line 42 arithmetic + line 78 EqualityOperator)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('entry remains valid at exactly TTL - 1ms (boundary just inside)', () => {
    const start = Date.now();
    vi.setSystemTime(start);
    const key = buildCacheKey(baseInput);
    writeGenerateCache(key, fixtureResponse('A'));

    // Advance to TTL - 1ms (just inside)
    vi.setSystemTime(start + 60 * 60 * 1000 - 1);
    expect(readGenerateCache(key)).toBeDefined();
  });

  it('entry remains valid at exactly TTL ms (`>` not `>=`)', () => {
    // 之前 mutation 把 `>` 改成 `>=`，正好在 TTL_MS 时进入 stale 分支，
    // 这条测试会挂。源码用 `>` 意味着"超过 TTL 才 stale"，等于不算。
    const start = Date.now();
    vi.setSystemTime(start);
    const key = buildCacheKey(baseInput);
    writeGenerateCache(key, fixtureResponse('A'));

    vi.setSystemTime(start + 60 * 60 * 1000); // exactly TTL elapsed
    expect(readGenerateCache(key)).toBeDefined();
  });

  it('entry expires at TTL + 1ms', () => {
    const start = Date.now();
    vi.setSystemTime(start);
    const key = buildCacheKey(baseInput);
    writeGenerateCache(key, fixtureResponse('A'));

    vi.setSystemTime(start + 60 * 60 * 1000 + 1);
    expect(readGenerateCache(key)).toBeUndefined();
  });

  it('TTL is in the magnitude of hours, not seconds (kills `60*60*1000` → `60*60/1000` mutation)', () => {
    // Stryker 把 `60 * 60 * 1000` 改成 `60 * 60 / 1000` 时 TTL = 3.6 (ms)，
    // 任何 5 分钟前写的 entry 都会过期。这条用 5 分钟边界把这种 mutation 杀掉。
    const start = Date.now();
    vi.setSystemTime(start);
    const key = buildCacheKey(baseInput);
    writeGenerateCache(key, fixtureResponse('A'));

    vi.setSystemTime(start + 5 * 60 * 1000); // 5 分钟后还在 TTL 内
    expect(readGenerateCache(key)).toBeDefined();
  });
});

describe('writeGenerateCache · LRU eviction boundary (mutation kill: line 89)', () => {
  it('does NOT evict before reaching MAX_ENTRIES', () => {
    // Bump version 拿干净 store
    clearGenerateCache();
    const sizeBefore = _peekGenerateCache().size;

    // 写 3 个 distinct entries —— 远小于 MAX_ENTRIES=200
    for (let i = 0; i < 3; i++) {
      const k = buildCacheKey({ ...baseInput, userInput: `evict-test-${i}` });
      writeGenerateCache(k, fixtureResponse(`p${i}`));
    }

    // 这 3 个 key 应该都在 (size + 3)
    const sizeAfter = _peekGenerateCache().size;
    expect(sizeAfter).toBe(sizeBefore + 3);
  });

  it('evicts oldest when at MAX_ENTRIES (size cap honored)', () => {
    // 这个测试通过 _peekGenerateCache 看 size，验证 size 不会无限增长。
    // 写 250 个独立 entries (超过 MAX_ENTRIES=200)，size 必须 ≤ 200。
    clearGenerateCache();

    for (let i = 0; i < 250; i++) {
      const k = buildCacheKey({ ...baseInput, userInput: `bulk-${i}` });
      writeGenerateCache(k, fixtureResponse(`p${i}`));
    }

    const { size } = _peekGenerateCache();
    expect(size).toBeLessThanOrEqual(200);
    // 而且必须真的 evict 过（不是 0），否则说明完全没写进去
    expect(size).toBeGreaterThan(0);
  });
});

describe('_peekGenerateCache (test/debug helper)', () => {
  it('reports current size + version', () => {
    // afterEach calls clearGenerateCache (bumps version, marks all stale) but
    // does NOT physically empty the Map. Stale entries get GC'd lazily on read.
    // For predictable size deltas in this test we use a key unique to this run.
    const before = _peekGenerateCache();
    const uniqueInput = { ...baseInput, userInput: `peek-test-${Math.random()}` };
    const k = buildCacheKey(uniqueInput);
    writeGenerateCache(k, fixtureResponse('A'));
    const after = _peekGenerateCache();
    expect(after.size).toBe(before.size + 1);
    expect(after.version).toBe(before.version);

    clearGenerateCache();
    const cleared = _peekGenerateCache();
    expect(cleared.version).toBe(before.version + 1);
  });
});
