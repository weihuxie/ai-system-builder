// In-memory cache for /api/generate responses.
//
// Why: Summit demo flow is dominated by 8 Quick Scenarios × 2 brands × 4 langs
// (lecturer keeps re-clicking the same scenarios across 4 venues). Same input
// hits the LLM cold every time → 2-4s per click. With cache, second-and-after
// click of the same combination returns in <100ms.
//
// Why in-memory and not Redis/Supabase:
//   - Vercel Functions are stateless across cold starts → cache evaporates
//     between deploys / inactive periods. That's actually fine for a demo:
//     stale data risk is low (bound by cold-start frequency), and we'd
//     rather miss-and-recompute than serve a 6h-old answer if the products
//     have changed in the meantime.
//   - Simpler. No new dep. No new env var.
//
// Cache key: SHA-256 of all inputs that would change the answer:
//   - userInput (post-trim)
//   - lang
//   - brand (from global_config)
//   - sorted active product IDs (catalog change → invalidate)
//   - JSON of llm_chain (chain reorder / model change → invalidate)
//   - temperature (different sampling → different output)
//
// Invalidation strategy: bumps an in-memory version counter on any
// products / global_config write. clearGenerateCache() bumps it; on next
// read, all entries are stale because their bakedVersion < current.
// Keeps the data structure simple (no per-entry deletes).
import { createHash } from 'node:crypto';

import type { GenerateResponse, Lang } from '@asb/shared';

interface CacheEntry {
  response: GenerateResponse;
  insertedAt: number;
  /** Version counter at insert time. If < current version, treat as stale. */
  bakedVersion: number;
}

// LRU not strictly needed for 64-entry working set, but cap to prevent
// pathological growth (e.g. lecturer types lots of free-form prompts).
const MAX_ENTRIES = 200;
const TTL_MS = 60 * 60 * 1000; // 1 hour — same scenario in same demo session

let version = 1;
const store = new Map<string, CacheEntry>();

export interface CacheKeyInput {
  userInput: string;
  lang: Lang;
  brand: string;
  activeProductIds: readonly string[];
  llmChain: unknown;
  temperature: number;
}

export function buildCacheKey(input: CacheKeyInput): string {
  const sorted = [...input.activeProductIds].sort();
  const payload = JSON.stringify({
    u: input.userInput.trim(),
    l: input.lang,
    b: input.brand,
    p: sorted,
    c: input.llmChain,
    t: input.temperature,
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

/** Returns the cached response if fresh, undefined otherwise. */
export function readGenerateCache(key: string): GenerateResponse | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.bakedVersion !== version) {
    // Stale due to invalidation event since insert.
    store.delete(key);
    return undefined;
  }
  if (Date.now() - entry.insertedAt > TTL_MS) {
    store.delete(key);
    return undefined;
  }
  // Move-to-end (LRU touch): re-insert at the back of the Map's iteration order.
  store.delete(key);
  store.set(key, entry);
  return entry.response;
}

export function writeGenerateCache(key: string, response: GenerateResponse): void {
  if (store.size >= MAX_ENTRIES) {
    // Evict oldest (Map iteration order = insertion order, which we maintain
    // as LRU via move-to-end on read).
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) store.delete(oldestKey);
  }
  store.set(key, { response, insertedAt: Date.now(), bakedVersion: version });
}

/**
 * Bump the version counter so all existing entries become stale on next read.
 * Called from products / global_config write paths whenever the underlying
 * data the cache depends on could have changed.
 *
 * O(1) — no need to walk the store. Stale entries get cleaned up lazily on
 * read. With MAX_ENTRIES cap, memory bloat is bounded even if invalidation
 * happens often.
 */
export function clearGenerateCache(): void {
  version += 1;
}

/** For tests + debugging only. */
export function _peekGenerateCache(): { size: number; version: number } {
  return { size: store.size, version };
}
