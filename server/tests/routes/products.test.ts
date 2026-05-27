import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { app } from '../helpers/app.js';
import { resetDb, seedProduct, seedUser, testDb } from '../helpers/db.js';
import { authHeader, mintJwt } from '../helpers/jwt.js';

function productPayload(id: string, overrides: Record<string, unknown> = {}) {
  const label = id;
  return {
    id,
    name: { 'zh-CN': label, 'zh-HK': label, en: label, ja: label },
    description: { 'zh-CN': 'x', 'zh-HK': 'x', en: 'x', ja: 'x' },
    audience: { 'zh-CN': 'y', 'zh-HK': 'y', en: 'y', ja: 'y' },
    url: {
      google: { 'zh-CN': 'https://g.com', 'zh-HK': 'https://g.com', en: 'https://g.com', ja: 'https://g.com' },
      aws: { 'zh-CN': 'https://a.com', 'zh-HK': 'https://a.com', en: 'https://a.com', ja: 'https://a.com' },
    },
    isParticipating: true,
    ...overrides,
  };
}

describe('GET /api/products', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns only is_participating=true rows (anon homepage view)', async () => {
    // Endpoint policy (changed 2026-04-25): /api/products is the public
    // catalog feed, so it filters to is_participating=true and intentionally
    // hides editor drafts. Admin UI uses /api/products/admin which returns
    // role-scoped rowsets (see test below).
    const ed = await seedUser({ email: 'ed1@example.com', role: 'editor' });
    await seedProduct({ id: 'pub1', ownerId: ed.userId });
    await seedProduct({ id: 'pub2', ownerId: null, isParticipating: false });

    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    const ids = res.body.map((p: { id: string }) => p.id);
    expect(ids).toContain('pub1');
    expect(ids).not.toContain('pub2');
  });

  it('denormalizes ownerEmail from admin_users via lookup map', async () => {
    const ed = await seedUser({ email: 'owner+asbtest-skip@example.com', role: 'editor' });
    await seedProduct({ id: 'own1', ownerId: ed.userId });

    const res = await request(app).get('/api/products');
    const row = res.body.find((p: { id: string }) => p.id === 'own1');
    expect(row.ownerId).toBe(ed.userId);
    expect(row.ownerEmail).toBe(ed.email);
  });
});

describe('POST /api/products', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('forces ownerId = req.user.id for editors (ignores payload ownerId)', async () => {
    const ed = await seedUser({ email: 'ed-post@example.com', role: 'editor' });
    const other = await seedUser({ email: 'other@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });

    const res = await request(app)
      .post('/api/products')
      .set(authHeader(token))
      .send(productPayload('new1', { ownerId: other.userId }));

    expect(res.status).toBe(201);
    expect(res.body.ownerId).toBe(ed.userId);
    expect(res.body.ownerEmail).toBe(ed.email);
  });

  it('respects explicit ownerId for super_admin', async () => {
    const boss = await seedUser({ email: 'boss-post@example.com', role: 'super_admin' });
    const ed = await seedUser({ email: 'ed-owned@example.com', role: 'editor' });
    const token = mintJwt({ sub: boss.userId, email: boss.email });

    const res = await request(app)
      .post('/api/products')
      .set(authHeader(token))
      .send(productPayload('seeded', { ownerId: ed.userId }));

    expect(res.status).toBe(201);
    expect(res.body.ownerId).toBe(ed.userId);
  });

  it('400 VALIDATION when payload is malformed', async () => {
    const ed = await seedUser({ email: 'ed-val@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });

    const res = await request(app)
      .post('/api/products')
      .set(authHeader(token))
      .send({ id: 'bad', name: 'not-a-langmap' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
  });
});

describe('PUT /api/products/:id — ownership', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('editor can update own product', async () => {
    const ed = await seedUser({ email: 'ed-put@example.com', role: 'editor' });
    await seedProduct({ id: 'mine', ownerId: ed.userId });
    const token = mintJwt({ sub: ed.userId, email: ed.email });

    const res = await request(app)
      .put('/api/products/mine')
      .set(authHeader(token))
      .send({ isParticipating: false });
    expect(res.status).toBe(200);
    expect(res.body.isParticipating).toBe(false);
  });

  it('403 OWNERSHIP_REQUIRED when editor updates someone else\'s product', async () => {
    const ed1 = await seedUser({ email: 'ed-owner@example.com', role: 'editor' });
    const ed2 = await seedUser({ email: 'ed-intruder@example.com', role: 'editor' });
    await seedProduct({ id: 'ed1s', ownerId: ed1.userId });
    const token = mintJwt({ sub: ed2.userId, email: ed2.email });

    const res = await request(app)
      .put('/api/products/ed1s')
      .set(authHeader(token))
      .send({ isParticipating: false });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('OWNERSHIP_REQUIRED');
  });

  it('super_admin can update any product', async () => {
    const boss = await seedUser({ email: 'boss-put@example.com', role: 'super_admin' });
    const ed = await seedUser({ email: 'ed-target@example.com', role: 'editor' });
    await seedProduct({ id: 'target', ownerId: ed.userId });
    const token = mintJwt({ sub: boss.userId, email: boss.email });

    const res = await request(app)
      .put('/api/products/target')
      .set(authHeader(token))
      .send({ isParticipating: false });
    expect(res.status).toBe(200);
  });

  it('editor cannot reassign ownerId (payload field stripped)', async () => {
    const ed = await seedUser({ email: 'ed-reassign@example.com', role: 'editor' });
    const other = await seedUser({ email: 'ed-steal@example.com', role: 'editor' });
    await seedProduct({ id: 'own', ownerId: ed.userId });
    const token = mintJwt({ sub: ed.userId, email: ed.email });

    const res = await request(app)
      .put('/api/products/own')
      .set(authHeader(token))
      .send({ ownerId: other.userId });
    expect(res.status).toBe(200);
    expect(res.body.ownerId).toBe(ed.userId); // unchanged
  });
});

describe('DELETE /api/products/:id — ownership', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('204 when editor deletes own', async () => {
    const ed = await seedUser({ email: 'ed-del@example.com', role: 'editor' });
    await seedProduct({ id: 'gone', ownerId: ed.userId });
    const token = mintJwt({ sub: ed.userId, email: ed.email });

    const res = await request(app).delete('/api/products/gone').set(authHeader(token));
    expect(res.status).toBe(204);
  });

  it('403 when editor deletes another\'s product', async () => {
    const ed1 = await seedUser({ email: 'ed-keep@example.com', role: 'editor' });
    const ed2 = await seedUser({ email: 'ed-nope@example.com', role: 'editor' });
    await seedProduct({ id: 'keep', ownerId: ed1.userId });
    const token = mintJwt({ sub: ed2.userId, email: ed2.email });

    const res = await request(app).delete('/api/products/keep').set(authHeader(token));
    expect(res.status).toBe(403);
  });

  // ── 软删除 (0006) ──
  it('DELETE is soft — row stays in DB with deleted_at set', async () => {
    const ed = await seedUser({ email: 'ed-soft@example.com', role: 'editor' });
    await seedProduct({ id: 'soft-gone', ownerId: ed.userId });
    const token = mintJwt({ sub: ed.userId, email: ed.email });

    await request(app).delete('/api/products/soft-gone').set(authHeader(token)).expect(204);

    // Row 物理上还在，只是 deleted_at 被标了 — 不是 hard delete
    const { data } = await testDb()
      .from('products')
      .select('id, deleted_at')
      .eq('id', 'soft-gone')
      .single();
    expect(data?.id).toBe('soft-gone');
    expect(data?.deleted_at).not.toBeNull();
  });

  it('soft-deleted product is excluded from public GET /api/products', async () => {
    await seedProduct({ id: 'hidden-after-del', ownerId: null });
    const sa = await seedUser({ email: 'sa-del@example.com', role: 'super_admin' });
    const token = mintJwt({ sub: sa.userId, email: sa.email });

    // visible before delete
    const before = await request(app).get('/api/products');
    expect(before.body.map((p: { id: string }) => p.id)).toContain('hidden-after-del');

    await request(app).delete('/api/products/hidden-after-del').set(authHeader(token)).expect(204);

    // gone from public catalog after soft delete
    const after = await request(app).get('/api/products');
    expect(after.body.map((p: { id: string }) => p.id)).not.toContain('hidden-after-del');
  });

  it('soft-deleted product excluded from default GET /admin but shown with ?deleted=true', async () => {
    const sa = await seedUser({ email: 'sa-bin@example.com', role: 'super_admin' });
    await seedProduct({ id: 'bin-me', ownerId: null });
    const token = mintJwt({ sub: sa.userId, email: sa.email });

    await request(app).delete('/api/products/bin-me').set(authHeader(token)).expect(204);

    // default admin list (live only) — bin-me 不在
    const live = await request(app).get('/api/products/admin').set(authHeader(token));
    expect(live.body.map((p: { id: string }) => p.id)).not.toContain('bin-me');

    // recycle bin view — bin-me 在
    const bin = await request(app).get('/api/products/admin?deleted=true').set(authHeader(token));
    expect(bin.body.map((p: { id: string }) => p.id)).toContain('bin-me');
  });
});

describe('POST /api/products/:id/restore — 回收站恢复', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('restore clears deleted_at and product reappears in catalog', async () => {
    const sa = await seedUser({ email: 'sa-restore@example.com', role: 'super_admin' });
    await seedProduct({ id: 'comeback', ownerId: null });
    const token = mintJwt({ sub: sa.userId, email: sa.email });

    await request(app).delete('/api/products/comeback').set(authHeader(token)).expect(204);
    // gone from public
    let pub = await request(app).get('/api/products');
    expect(pub.body.map((p: { id: string }) => p.id)).not.toContain('comeback');

    // restore
    const res = await request(app).post('/api/products/comeback/restore').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('comeback');
    expect(res.body.deletedAt).toBeNull();

    // back in public catalog
    pub = await request(app).get('/api/products');
    expect(pub.body.map((p: { id: string }) => p.id)).toContain('comeback');
  });

  it('editor can restore own product', async () => {
    const ed = await seedUser({ email: 'ed-restore@example.com', role: 'editor' });
    await seedProduct({ id: 'mine-back', ownerId: ed.userId });
    const token = mintJwt({ sub: ed.userId, email: ed.email });

    await request(app).delete('/api/products/mine-back').set(authHeader(token)).expect(204);
    const res = await request(app).post('/api/products/mine-back/restore').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.deletedAt).toBeNull();
  });

  it('403 when editor restores another\'s product', async () => {
    const ed1 = await seedUser({ email: 'ed-r1@example.com', role: 'editor' });
    const ed2 = await seedUser({ email: 'ed-r2@example.com', role: 'editor' });
    await seedProduct({ id: 'not-yours', ownerId: ed1.userId });
    const sa = await seedUser({ email: 'sa-r@example.com', role: 'super_admin' });
    const saToken = mintJwt({ sub: sa.userId, email: sa.email });
    // super_admin soft-deletes it
    await request(app).delete('/api/products/not-yours').set(authHeader(saToken)).expect(204);

    // ed2 tries to restore ed1's product
    const ed2Token = mintJwt({ sub: ed2.userId, email: ed2.email });
    const res = await request(app).post('/api/products/not-yours/restore').set(authHeader(ed2Token));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/products/:id/clone', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates a clone owned by the calling user with -copy suffix and isParticipating=false', async () => {
    const ed1 = await seedUser({ email: 'ed-src@example.com', role: 'editor' });
    const ed2 = await seedUser({ email: 'ed-cloner@example.com', role: 'editor' });
    await seedProduct({ id: 'original', ownerId: ed1.userId });
    const token = mintJwt({ sub: ed2.userId, email: ed2.email });

    const res = await request(app).post('/api/products/original/clone').set(authHeader(token));
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('original-copy');
    expect(res.body.isParticipating).toBe(false);
    expect(res.body.ownerId).toBe(ed2.userId);
    expect(res.body.name['zh-CN']).toContain('副本');
  });

  it('bumps suffix on collision', async () => {
    const ed = await seedUser({ email: 'ed-bump@example.com', role: 'editor' });
    await seedProduct({ id: 'orig', ownerId: ed.userId });
    await seedProduct({ id: 'orig-copy', ownerId: ed.userId });
    const token = mintJwt({ sub: ed.userId, email: ed.email });

    const res = await request(app).post('/api/products/orig/clone').set(authHeader(token));
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('orig-copy-2');
  });

  it('404 when source product does not exist', async () => {
    const ed = await seedUser({ email: 'ed-404@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });

    const res = await request(app).post('/api/products/ghost/clone').set(authHeader(token));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it(
    '409 CONFLICT after exhausting the suffix budget',
    async () => {
      const ed = await seedUser({ email: 'ed-exhaust@example.com', role: 'editor' });
      await seedProduct({ id: 'src', ownerId: ed.userId });
      await seedProduct({ id: 'src-copy', ownerId: ed.userId });
      // Pre-fill -copy-2 through -copy-20 (match CLONE_MAX_ATTEMPTS).
      for (let i = 2; i <= 20; i++) {
        await seedProduct({ id: `src-copy-${i}`, ownerId: ed.userId });
      }
      const token = mintJwt({ sub: ed.userId, email: ed.email });

      const res = await request(app).post('/api/products/src/clone').set(authHeader(token));
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICT');
    },
    // 22 sequential Supabase round-trips (1 src + 20 fillers + 1 clone attempt
    // that itself does up to 20 lookups). Public-internet RTT 200-300ms × 40+
    // ops easily blows past vitest's 20s default. Bump generously since this
    // test is intentionally exercising the worst case.
    60_000,
  );

  it('401 without auth', async () => {
    const ed = await seedUser({ email: 'ed-noauth@example.com', role: 'editor' });
    await seedProduct({ id: 'anyone', ownerId: ed.userId });
    const res = await request(app).post('/api/products/anyone/clone');
    expect(res.status).toBe(401);
  });
});

describe('products ownership invariant (smoke)', () => {
  beforeEach(async () => {
    await resetDb();
  });
  it('created products always have timestamps', async () => {
    const ed = await seedUser({ email: 'ed-ts@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });
    const res = await request(app)
      .post('/api/products')
      .set(authHeader(token))
      .send(productPayload('ts1'));
    expect(res.body.createdAt).toBeTruthy();
    expect(res.body.updatedAt).toBeTruthy();
    // Clean up manually because this test skips resetDb before exit
    await testDb().from('products').delete().eq('id', 'ts1');
  });
});
