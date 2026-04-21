import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { app } from '../helpers/app.js';
import { resetDb, seedUser } from '../helpers/db.js';
import { authHeader, mintJwt } from '../helpers/jwt.js';

describe('GET /api/brand (public)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns current brand without auth', async () => {
    const res = await request(app).get('/api/brand');
    expect(res.status).toBe(200);
    expect(['google', 'aws']).toContain(res.body.brand);
    expect(res.body.updatedAt).toBeTruthy();
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

  it('400 for invalid brand value', async () => {
    const boss = await seedUser({ email: 'boss-bad@example.com', role: 'super_admin' });
    const token = mintJwt({ sub: boss.userId, email: boss.email });

    const res = await request(app)
      .put('/api/brand')
      .set(authHeader(token))
      .send({ brand: 'azure' });
    expect(res.status).toBe(400);
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
