import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { app } from '../helpers/app.js';
import { resetDb, seedUser, testDb } from '../helpers/db.js';
import { authHeader, mintJwt } from '../helpers/jwt.js';

const GLOBAL_CONFIG_ID = 1;

describe('GET /api/brand (public)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns current brand without auth', async () => {
    // Strict ISO8601 + brand-in-set kills L23 .select('brand, updated_at') →
    // .select('') (loose .toBeTruthy let the mutation through).
    const res = await request(app).get('/api/brand');
    expect(res.status).toBe(200);
    expect(['google', 'aws']).toContain(res.body.brand);
    expect(typeof res.body.updatedAt).toBe('string');
    expect(res.body.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // Note: there's no test for "500 INTERNAL when DB brand is corrupted"
  // because migration 0001 puts a CHECK constraint on global_config.brand
  // restricting it to 'google'|'aws'. The application-level BrandSchema check
  // (brand.ts L30-34) is therefore defense-in-depth dead code on a healthy
  // schema — we cannot exercise it from integration tests without dropping
  // the constraint, which would race with parallel tests sharing the DB.
  // L31 + L31:25 + L33:32 + L33:44 are marked equivalent in source via
  // Stryker disable comments (with this same explanation).

  it('500 INTERNAL when global_config row is missing', async () => {
    // Kills L27 if(error) GET path, L27:41 'INTERNAL' string, L37 catch block.
    // .single() on no rows returns PGRST116 error (not data=null), so this
    // exercises the error branch, not L28 if(!data) — which is dead code by
    // single()'s contract and intentionally left equivalent.
    const db = testDb();
    const { error: delErr } = await db
      .from('global_config')
      .delete()
      .eq('id', GLOBAL_CONFIG_ID);
    if (delErr) throw new Error(`delete global_config: ${delErr.message}`);

    try {
      const res = await request(app).get('/api/brand');
      expect(res.status).toBe(500);
      expect(res.body.code).toBe('INTERNAL');
      // Distinguish L31 throw error.message (supabase PGRST116) from a hypothetical
      // L36 if(!data) fallback throw 'global_config row missing' — the latter is
      // disabled as dead-code, but the assertion still pins L31 against mutation
      // to if(false). Supabase v2 PGRST116 message contains 'rows' or 'JSON object'.
      expect(res.body.message).not.toBe('global_config row missing');
      expect(res.body.message).toMatch(/row|JSON|coercible|results/i);
    } finally {
      await db
        .from('global_config')
        .insert({ id: GLOBAL_CONFIG_ID, brand: 'google' });
    }
  });
});

describe('PUT /api/brand — super_admin only', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('403 when editor tries to change brand', async () => {
    const ed = await seedUser({ email: 'ed-brand@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });

    const res = await request(app)
      .put('/api/brand')
      .set(authHeader(token))
      .send({ brand: 'aws' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('super_admin can flip the brand', async () => {
    const boss = await seedUser({ email: 'boss-brand@example.com', role: 'super_admin' });
    const token = mintJwt({ sub: boss.userId, email: boss.email });

    const res = await request(app)
      .put('/api/brand')
      .set(authHeader(token))
      .send({ brand: 'aws' });
    expect(res.status).toBe(200);
    expect(res.body.brand).toBe('aws');

    const get = await request(app).get('/api/brand');
    expect(get.body.brand).toBe('aws');
  });

  it('400 for invalid brand value (with code=VALIDATION + brand-hint message)', async () => {
    // Mutation kills: L46 'VALIDATION' + L46 'Invalid brand (must be...)' StringLiteral
    const boss = await seedUser({ email: 'boss-bad@example.com', role: 'super_admin' });
    const token = mintJwt({ sub: boss.userId, email: boss.email });

    const res = await request(app)
      .put('/api/brand')
      .set(authHeader(token))
      .send({ brand: 'azure' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
    // message 必须含 google 或 aws 提示（防 L46 字符串 mutation 改成 ""）
    expect(res.body.message).toMatch(/google|aws/i);
  });

  it('PUT empty body returns 400 not 500 (kills L44 OptionalChaining)', async () => {
    // L44 mutation: req.body?.brand → req.body.brand。当 body 是 undefined 时
    // 后者会 TypeError → 500。这条断言 400 杀 mutation。
    const boss = await seedUser({ email: 'boss-empty@example.com', role: 'super_admin' });
    const token = mintJwt({ sub: boss.userId, email: boss.email });

    const res = await request(app)
      .put('/api/brand')
      .set(authHeader(token));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
  });

  it('PUT empty object body returns 400 (no brand field)', async () => {
    const boss = await seedUser({ email: 'boss-empty2@example.com', role: 'super_admin' });
    const token = mintJwt({ sub: boss.userId, email: boss.email });
    const res = await request(app)
      .put('/api/brand')
      .set(authHeader(token))
      .send({});
    expect(res.status).toBe(400);
  });

  it('PUT response body has both brand + updatedAt (kills L54 select StringLiteral)', async () => {
    // L54 mutation: .select('brand, updated_at') → '' 时 Supabase 行为变。
    // 严格断言两个字段都在 + updatedAt 是合法 ISO timestamp。
    const boss = await seedUser({ email: 'boss-fields@example.com', role: 'super_admin' });
    const token = mintJwt({ sub: boss.userId, email: boss.email });

    const res = await request(app)
      .put('/api/brand')
      .set(authHeader(token))
      .send({ brand: 'aws' });
    expect(res.status).toBe(200);
    expect(res.body.brand).toBe('aws');
    expect(typeof res.body.updatedAt).toBe('string');
    expect(res.body.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO8601
  });

  it('PUT 500 INTERNAL when global_config row is missing', async () => {
    // Kills L57 if(error) PUT path + L57:41 'INTERNAL' string. Update on a
    // missing row returns PGRST116 error from .single(); the catch in L37 fires
    // and propagates the HttpError. Restore the row in finally so subsequent
    // tests still find global_config.
    const boss = await seedUser({ email: 'boss-missing@example.com', role: 'super_admin' });
    const token = mintJwt({ sub: boss.userId, email: boss.email });

    const db = testDb();
    const { error: delErr } = await db
      .from('global_config')
      .delete()
      .eq('id', GLOBAL_CONFIG_ID);
    if (delErr) throw new Error(`delete global_config: ${delErr.message}`);

    try {
      const res = await request(app)
        .put('/api/brand')
        .set(authHeader(token))
        .send({ brand: 'aws' });
      expect(res.status).toBe(500);
      expect(res.body.code).toBe('INTERNAL');
    } finally {
      await db
        .from('global_config')
        .insert({ id: GLOBAL_CONFIG_ID, brand: 'google' });
    }
  });
});

describe('GET /api/llm-chain — admin', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('401 without auth', async () => {
    const res = await request(app).get('/api/llm-chain');
    expect(res.status).toBe(401);
  });

  it('editor can read chain', async () => {
    const ed = await seedUser({ email: 'ed-llm@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });

    const res = await request(app).get('/api/llm-chain').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.chain)).toBe(true);
    expect(typeof res.body.temperature).toBe('number');
    expect(res.body.configured).toBeTruthy();
  });
});

describe('PUT /api/llm-chain — super_admin only', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('403 when editor tries to write chain', async () => {
    const ed = await seedUser({ email: 'ed-llmput@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });

    const res = await request(app)
      .put('/api/llm-chain')
      .set(authHeader(token))
      .send({ chain: [{ providerId: 'gemini', model: 'gemini-2.5-pro', enabled: true }] });
    expect(res.status).toBe(403);
  });

  it('super_admin can update chain + temperature', async () => {
    const boss = await seedUser({ email: 'boss-llm@example.com', role: 'super_admin' });
    const token = mintJwt({ sub: boss.userId, email: boss.email });

    const res = await request(app)
      .put('/api/llm-chain')
      .set(authHeader(token))
      .send({
        chain: [
          { providerId: 'kimi', model: 'moonshot-v1-128k', enabled: true },
          { providerId: 'gemini', model: 'gemini-2.5-flash', enabled: false },
        ],
        temperature: 0.3,
      });

    expect(res.status).toBe(200);
    expect(res.body.chain).toHaveLength(2);
    expect(res.body.chain[0].providerId).toBe('kimi');
    expect(res.body.temperature).toBe(0.3);
  });

  it('400 for malformed chain', async () => {
    const boss = await seedUser({ email: 'boss-llm-bad@example.com', role: 'super_admin' });
    const token = mintJwt({ sub: boss.userId, email: boss.email });

    const res = await request(app)
      .put('/api/llm-chain')
      .set(authHeader(token))
      .send({ chain: [{ providerId: 'not-a-provider', model: 'x', enabled: true }] });
    expect(res.status).toBe(400);
  });
});
