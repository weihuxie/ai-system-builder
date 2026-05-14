import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { resetDb, seedUser, testDb } from '../helpers/db.js';
import { authHeader, mintJwt } from '../helpers/jwt.js';

// 跟 chainFailover 同款：vi.mock providers 注入脚本结果，避免真打 LLM
const nextResults: Record<
  string,
  | { ok: true; rawText: string }
  | { ok: false; kind: 'overload' | 'fatal' | 'disabled'; message: string }
> = {};
const callTrace: string[] = [];

vi.mock('../../src/lib/providers.js', () => ({
  providers: {
    gemini: {
      id: 'gemini',
      isConfigured: () => true,
      generate: async () => {
        callTrace.push('gemini');
        return nextResults.gemini ?? { ok: false, kind: 'disabled' as const, message: 'no script' };
      },
    },
    kimi: {
      id: 'kimi',
      isConfigured: () => true,
      generate: async () => {
        callTrace.push('kimi');
        return nextResults.kimi ?? { ok: false, kind: 'disabled' as const, message: 'no script' };
      },
    },
    deepseek: {
      id: 'deepseek',
      isConfigured: () => true,
      generate: async () => {
        callTrace.push('deepseek');
        return nextResults.deepseek ?? { ok: false, kind: 'disabled' as const, message: 'no script' };
      },
    },
  },
}));

const { app } = await import('../helpers/app.js');

const goodPayload = () => ({
  fields: {
    name: '客户关系管理 (CRM)',
    description: '整合客户数据、追踪销售漏斗',
    audience: '销售VP',
  },
});

const validLlmJson = () =>
  JSON.stringify({
    'zh-HK': {
      name: '客戶關係管理 (CRM)',
      description: '整合客戶資料、追蹤銷售漏斗',
      audience: '銷售VP',
    },
    en: {
      name: 'Customer Relationship Management (CRM)',
      description: 'Centralize customer data, track sales pipeline',
      audience: 'VP of Sales',
    },
    ja: {
      name: '顧客関係管理 (CRM)',
      description: '顧客データを統合、セールスパイプラインを追跡',
      audience: '営業VP',
    },
  });

describe('POST /api/admin/translate/product · auth + validation', () => {
  beforeEach(async () => {
    await resetDb();
    // seed 3-provider chain so failover tests can walk through
    await testDb()
      .from('global_config')
      .update({
        llm_chain: [
          { providerId: 'gemini', model: 'gemini-2.5-flash', enabled: true },
          { providerId: 'kimi', model: 'kimi-k2.6', enabled: true },
          { providerId: 'deepseek', model: 'deepseek-chat', enabled: true },
        ],
      })
      .eq('id', 1);
    callTrace.length = 0;
    Object.keys(nextResults).forEach((k) => delete nextResults[k]);
  });

  it('401 without auth', async () => {
    const res = await request(app).post('/api/admin/translate/product').send(goodPayload());
    expect(res.status).toBe(401);
  });

  it('editor can call (adminChain not superAdminChain)', async () => {
    const ed = await seedUser({ email: 'ed-translate@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });
    nextResults.gemini = { ok: true, rawText: validLlmJson() };

    const res = await request(app)
      .post('/api/admin/translate/product')
      .set(authHeader(token))
      .send(goodPayload());
    expect(res.status).toBe(200);
  });

  it('super_admin can call', async () => {
    const boss = await seedUser({ email: 'boss-translate@example.com', role: 'super_admin' });
    const token = mintJwt({ sub: boss.userId, email: boss.email });
    nextResults.gemini = { ok: true, rawText: validLlmJson() };

    const res = await request(app)
      .post('/api/admin/translate/product')
      .set(authHeader(token))
      .send(goodPayload());
    expect(res.status).toBe(200);
  });

  it('400 VALIDATION when fields object is missing', async () => {
    const ed = await seedUser({ email: 'ed-val1@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });
    const res = await request(app)
      .post('/api/admin/translate/product')
      .set(authHeader(token))
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
  });

  it('400 VALIDATION when name is empty (min=1)', async () => {
    const ed = await seedUser({ email: 'ed-val2@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });
    const res = await request(app)
      .post('/api/admin/translate/product')
      .set(authHeader(token))
      .send({ fields: { name: '', description: 'd', audience: 'a' } });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
  });
});

describe('POST /api/admin/translate/product · happy path + chain failover', () => {
  beforeEach(async () => {
    await resetDb();
    await testDb()
      .from('global_config')
      .update({
        llm_chain: [
          { providerId: 'gemini', model: 'gemini-2.5-flash', enabled: true },
          { providerId: 'kimi', model: 'kimi-k2.6', enabled: true },
          { providerId: 'deepseek', model: 'deepseek-chat', enabled: true },
        ],
      })
      .eq('id', 1);
    callTrace.length = 0;
    Object.keys(nextResults).forEach((k) => delete nextResults[k]);
  });

  it('returns translations for all 3 target langs when LLM 完整返 JSON', async () => {
    const ed = await seedUser({ email: 'ed-happy@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });
    nextResults.gemini = { ok: true, rawText: validLlmJson() };

    const res = await request(app)
      .post('/api/admin/translate/product')
      .set(authHeader(token))
      .send(goodPayload());
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.translations).sort()).toEqual(['en', 'ja', 'zh-HK']);
    expect(res.body.translations.en.name).toContain('Customer Relationship Management');
    expect(res.body.translations.en.name).toContain('CRM'); // 缩写保留
    expect(res.body.translations.ja.audience).toBe('営業VP');
    expect(res.body.failed).toEqual([]);
    expect(res.body.provider).toBe('gemini');
    expect(callTrace).toEqual(['gemini']);
  });

  it('chain fallover: gemini overload → kimi success', async () => {
    const ed = await seedUser({ email: 'ed-fail@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });
    nextResults.gemini = { ok: false, kind: 'overload', message: 'gemini 503' };
    nextResults.kimi = { ok: true, rawText: validLlmJson() };

    const res = await request(app)
      .post('/api/admin/translate/product')
      .set(authHeader(token))
      .send(goodPayload());
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('kimi');
    expect(callTrace).toEqual(['gemini', 'kimi']);
  });

  it('partial success (E2): LLM 漏 ja → translations 只有 zh-HK + en，failed=[ja]', async () => {
    const ed = await seedUser({ email: 'ed-partial@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });
    nextResults.gemini = {
      ok: true,
      rawText: JSON.stringify({
        'zh-HK': { name: 'X', description: 'Y', audience: 'Z' },
        en: { name: 'X', description: 'Y', audience: 'Z' },
        // ja missing — partial success
      }),
    };

    const res = await request(app)
      .post('/api/admin/translate/product')
      .set(authHeader(token))
      .send(goodPayload());
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.translations).sort()).toEqual(['en', 'zh-HK']);
    expect(res.body.failed).toEqual(['ja']);
  });

  it('partial success (E2): ja shape malformed (name=number) → drop ja, keep others', async () => {
    const ed = await seedUser({ email: 'ed-shape@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });
    nextResults.gemini = {
      ok: true,
      rawText: JSON.stringify({
        'zh-HK': { name: 'X', description: 'Y', audience: 'Z' },
        en: { name: 'X', description: 'Y', audience: 'Z' },
        ja: { name: 42, description: 'Y', audience: 'Z' }, // name 不是字符串
      }),
    };

    const res = await request(app)
      .post('/api/admin/translate/product')
      .set(authHeader(token))
      .send(goodPayload());
    expect(res.status).toBe(200);
    expect(res.body.failed).toEqual(['ja']);
    expect(res.body.translations.en).toBeDefined();
  });

  it('all 3 providers fail → 502 LLM_CALL_FAILED', async () => {
    const ed = await seedUser({ email: 'ed-allfail@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });
    nextResults.gemini = { ok: false, kind: 'overload', message: 'g 503' };
    nextResults.kimi = { ok: false, kind: 'fatal', message: 'k auth bad' };
    nextResults.deepseek = { ok: false, kind: 'overload', message: 'd timeout' };

    const res = await request(app)
      .post('/api/admin/translate/product')
      .set(authHeader(token))
      .send(goodPayload());
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('LLM_CALL_FAILED');
    expect(callTrace).toEqual(['gemini', 'kimi', 'deepseek']);
  });

  it('LLM 返非 JSON → 502 AI_PARSE', async () => {
    const ed = await seedUser({ email: 'ed-parse@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });
    nextResults.gemini = { ok: true, rawText: 'sorry I cannot help' };

    const res = await request(app)
      .post('/api/admin/translate/product')
      .set(authHeader(token))
      .send(goodPayload());
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('AI_PARSE');
  });

  it('LLM 返 JSON 但没有任何 target lang → 502 AI_INVALID', async () => {
    const ed = await seedUser({ email: 'ed-allmissing@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });
    nextResults.gemini = { ok: true, rawText: JSON.stringify({ unrelated: 'x' }) };

    const res = await request(app)
      .post('/api/admin/translate/product')
      .set(authHeader(token))
      .send(goodPayload());
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('AI_INVALID');
  });
});
