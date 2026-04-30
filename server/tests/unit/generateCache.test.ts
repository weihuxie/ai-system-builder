import { afterEach, describe, expect, it } from 'vitest';

import {
  _peekGenerateCache,
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
  // Bumps version → all entries stale on next read; effectively a fresh slate.
  clearGenerateCache();
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
