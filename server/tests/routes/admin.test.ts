import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { app } from '../helpers/app.js';
import { resetDb, seedUser, testDb } from '../helpers/db.js';
import { authHeader, mintJwt } from '../helpers/jwt.js';

describe('POST /api/admin/users — invite', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates a whitelist row visible to super_admin', async () => {
    const boss = await seedUser({ email: 'admin-inv@example.com', role: 'super_admin' });
    const token = mintJwt({ sub: boss.userId, email: boss.email });

    const res = await request(app)
      .post('/api/admin/users')
      .set(authHeader(token))
      .send({ email: 'newbie@example.com', role: 'editor' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('newbie@example.com');
    expect(res.body.role).toBe('editor');
    expect(res.body.userId).toBeNull(); // not yet activated
    expect(res.body.activatedAt).toBeNull();
  });

  it('invite is idempotent — re-inviting updates role', async () => {
    const boss = await seedUser({ email: 'admin-idem@example.com', role: 'super_admin' });
    const token = mintJwt({ sub: boss.userId, email: boss.email });

    await request(app)
      .post('/api/admin/users')
      .set(authHeader(token))
      .send({ email: 'promote@example.com', role: 'editor' });
    const res2 = await request(app)
      .post('/api/admin/users')
      .set(authHeader(token))
      .send({ email: 'promote@example.com', role: 'super_admin' });

    expect(res2.status).toBe(201);
    expect(res2.body.role).toBe('super_admin');
  });

  it('400 when email is invalid', async () => {
    const boss = await seedUser({ email: 'admin-bad@example.com', role: 'super_admin' });
    const token = mintJwt({ sub: boss.userId, email: boss.email });

    const res = await request(app)
      .post('/api/admin/users')
      .set(authHeader(token))
      .send({ email: 'not-an-email', role: 'editor' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
  });

  it('403 when editor tries to invite', async () => {
    const ed = await seedUser({ email: 'ed-inv@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });

    const res = await request(app)
      .post('/api/admin/users')
      .set(authHeader(token))
      .send({ email: 'x@example.com', role: 'editor' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});

describe('DELETE /api/admin/users/:email — revoke', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('removes the whitelist row', async () => {
    const boss = await seedUser({ email: 'admin-rev@example.com', role: 'super_admin' });
    const victim = await seedUser({ email: 'victim@example.com', role: 'editor' });
    const token = mintJwt({ sub: boss.userId, email: boss.email });

    const res = await request(app)
      .delete(`/api/admin/users/${encodeURIComponent(victim.email)}`)
      .set(authHeader(token));
    expect(res.status).toBe(204);

    const { data } = await testDb()
      .from('admin_users')
      .select('email')
      .eq('email', victim.email)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it('400 when revoking self', async () => {
    const boss = await seedUser({ email: 'admin-self@example.com', role: 'super_admin' });
    const token = mintJwt({ sub: boss.userId, email: boss.email });

    const res = await request(app)
      .delete(`/api/admin/users/${encodeURIComponent(boss.email)}`)
      .set(authHeader(token));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/yourself/i);
  });

  it('403 when editor tries to revoke someone', async () => {
    const ed = await seedUser({ email: 'ed-rev@example.com', role: 'editor' });
    const other = await seedUser({ email: 'ed-other@example.com', role: 'editor' });
    const token = mintJwt({ sub: ed.userId, email: ed.email });

    const res = await request(app)
      .delete(`/api/admin/users/${encodeURIComponent(other.email)}`)
      .set(authHeader(token));
    expect(res.status).toBe(403);
  });
});
