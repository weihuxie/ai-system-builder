import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { resetDb, seedProduct, testDb } from '../helpers/db.js';
import { clearGenerateCache } from '../../src/lib/generateCache.js';

// F3: LLM chain failover integration test.
//
// Why: chain logic in generate.ts walks providers top→bottom and falls through
// on overload/fatal/disabled. Production-critical path (every Summit demo
// recommendation goes through here) but had ZERO tests. We mock the providers
// module to inject scripted responses, then drive /api/generate and assert
// the trace + outcome.
//
// Approach:
//   - vi.mock('../lib/providers.js', ...) — replace the registry with stubs
//     before generate.ts imports it
//   - Each test sets `nextResults` map keyed by providerId, supertest hits
//     /api/generate, then we assert the response (200 with selected products
//     when ANY provider succeeds; 502 LLM_CALL_FAILED when all fail)
//
// Trade-off: this test runs against a real (test) Supabase but mocked LLMs.
// Lives in routes/ with the integration suite, not unit/, because it boots
// the full Express app.

// IMPORTANT: vi.mock must run before generate.ts is imported. By placing it
// here at module level, Vitest hoists it.
const nextResults: Record<
  string,
  { ok: true; rawText: string } | { ok: false; kind: 'overload' | 'fatal' | 'disabled'; message: string }
> = {};
const callTrace: string[] = [];

vi.mock('../../src/lib/providers.js', () => ({
  providers: {
    gemini: {
      id: 'gemini',
      isConfigured: () => true,
      generate: async (_model: string) => {
        callTrace.push('gemini');
        return nextResults.gemini ?? { ok: false, kind: 'disabled' as const, message: 'no script' };
      },
    },
    kimi: {
      id: 'kimi',
      isConfigured: () => true,
      generate: async (_model: string) => {
        callTrace.push('kimi');
        return nextResults.kimi ?? { ok: false, kind: 'disabled' as const, message: 'no script' };
      },
    },
    deepseek: {
      id: 'deepseek',
      isConfigured: () => true,
      generate: async (_model: string) => {
        callTrace.push('deepseek');
        return nextResults.deepseek ?? { ok: false, kind: 'disabled' as const, message: 'no script' };
      },
    },
  },
}));

// Import the app AFTER vi.mock above so it sees the stubbed providers.
const { app } = await import('../helpers/app.js');

const validRationale = (ids: readonly string[]) =>
  JSON.stringify({
    selectedProducts: ids,
    rationale: Object.fromEntries(ids.map((id) => [id, 'Mock rationale'])),
  });

describe('LLM chain failover · /api/generate', () => {
  beforeEach(async () => {
    await resetDb();
    await seedProduct({ id: 'CRM', ownerId: null });
    await seedProduct({ id: 'CLM', ownerId: null });
    await seedProduct({ id: 'OMS', ownerId: null });

    // resetDb() seeds llm_chain with only ONE provider (gemini); for failover
    // tests we need the full 3-provider chain so generate.ts's loop has
    // somewhere to fall through to. Mirror prod default order.
    const { error: chainErr } = await testDb()
      .from('global_config')
      .update({
        llm_chain: [
          { providerId: 'gemini', model: 'gemini-2.5-flash', enabled: true },
          { providerId: 'kimi', model: 'kimi-k2.6', enabled: true },
          { providerId: 'deepseek', model: 'deepseek-chat', enabled: true },
        ],
      })
      .eq('id', 1);
    if (chainErr) throw new Error(`seed multi-provider chain: ${chainErr.message}`);

    clearGenerateCache(); // prevent cache hits between tests
    callTrace.length = 0;
    Object.keys(nextResults).forEach((k) => delete nextResults[k]);
  });

  afterEach(async () => {
    await resetDb();
  });

  it('first provider success → break, no fallback called', async () => {
    nextResults.gemini = { ok: true, rawText: validRationale(['CRM', 'CLM', 'OMS']) };

    const res = await request(app).post('/api/generate').send({ userInput: 'help', lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body.selectedProducts).toEqual(['CRM', 'CLM', 'OMS']);
    expect(res.body.provider).toBe('gemini');
    expect(callTrace).toEqual(['gemini']); // kimi/deepseek not touched
  });

  it('gemini overload → kimi success', async () => {
    nextResults.gemini = { ok: false, kind: 'overload', message: '503 from gemini' };
    nextResults.kimi = { ok: true, rawText: validRationale(['CRM', 'CLM', 'OMS']) };

    const res = await request(app).post('/api/generate').send({ userInput: 'help', lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('kimi');
    expect(callTrace).toEqual(['gemini', 'kimi']);
  });

  it('gemini overload → kimi fatal → deepseek success', async () => {
    nextResults.gemini = { ok: false, kind: 'overload', message: '503' };
    nextResults.kimi = { ok: false, kind: 'fatal', message: 'auth bad' };
    nextResults.deepseek = { ok: true, rawText: validRationale(['CRM', 'CLM', 'OMS']) };

    const res = await request(app).post('/api/generate').send({ userInput: 'help', lang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('deepseek');
    expect(callTrace).toEqual(['gemini', 'kimi', 'deepseek']);
  });

  it('all three providers fail → 502 LLM_CALL_FAILED with last failure', async () => {
    nextResults.gemini = { ok: false, kind: 'overload', message: 'gemini 503' };
    nextResults.kimi = { ok: false, kind: 'fatal', message: 'kimi auth' };
    nextResults.deepseek = { ok: false, kind: 'overload', message: 'deepseek timeout' };

    const res = await request(app).post('/api/generate').send({ userInput: 'help', lang: 'en' });
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('LLM_CALL_FAILED');
    expect(callTrace).toEqual(['gemini', 'kimi', 'deepseek']);
  });

  it('first provider returns invalid product id → AI_INVALID 502', async () => {
    nextResults.gemini = {
      ok: true,
      rawText: validRationale(['HALLUCINATED', 'CRM', 'CLM']),
    };

    const res = await request(app).post('/api/generate').send({ userInput: 'help', lang: 'en' });
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('AI_INVALID');
    // No fallback for AI_INVALID — once a provider returned a parseable but
    // wrong response, we don't retry the next one. This test pins that
    // behavior so it's intentional and visible.
    expect(callTrace).toEqual(['gemini']);
  });
});
