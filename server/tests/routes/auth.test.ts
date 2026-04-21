import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { app } from '../helpers/app.js';
import { resetDb, seedUser, testDb } from '../helpers/db.js';
import { authHeader, mintJwt } from '../helpers/jwt.js';

describe('auth middleware chain (via /api/admin/me)', () => {
  beforeAll(async () => {
    await resetDb();
  });
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await resetDb();
  });

  it('401 when no Authorization header', async () => {
    const res = await request(app).get('/api/admin/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('401 when bearer token is malformed', async () => {
    const res = await request(app)
      .get('/api/admin/me')
      .set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('401 when JWT is signed with a different secret', async () => {
    const token = mintJwt({
      sub: '00000000-0000-0000-0000-000000000000',
      email: 'ghost@example.com',
      secretOverride: 'totally-wrong-secret',
    });
    const res = await request(app).get('/api/admin/me').set(authHeader(token));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('401 when JWT is expired', async () => {
    const token = mintJwt({
      sub: '00000000-0000-0000-0000-000000000001',
      email: 'expired@example.com',
      expiresInSec: -60,
    });
    const res = await request(app).get('/api/admin/me').set(authHeader(token));
    expect(res.status).toBe(401);
  });

  it('403 NOT_WHITELISTED when JWT is valid but email is not in admin_users', async () => {
    // Create a Supabase auth user without a whitelist row.
    const { data } = await testDb().auth.admin.createUser({
      email: 'outsider+asbtest@example.com',
      password: 'Test-abc123!',
      email_confirm: true,
    });
    const userId = data?.user?.id;
    expect(userId).toBeTruthy();
    const token = mintJwt({ sub: userId!, email: data!.user!.email! });
    const res = await request(app).get('/api/admin/me').set(authHeader(token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_WHITELISTED');
  });

  it('200 with AuthedUser for a whitelisted editor', async () => {
    const u = await seedUser({ email: 'editor1@example.com', role: 'editor' });
    const token = mintJwt({ sub: u.userId, email: u.email });
    const res = await request(app).get('/api/admin/me').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: u.userId, email: u.email, role: 'editor' });
  });

  it('200 with super_admin role', async () => {
    const u = await seedUser({ email: 'boss@example.com', role: 'super_admin' });
    const token = mintJwt({ sub: u.userId, email: u.email });
    const res = await request(app).get('/api/admin/me').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('super_admin');
  });
});

describe('super_admin gate (via GET /api/admin/users)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('403 FORBIDDEN when a non-super_admin calls super_admin endpoints', async () => {
    const u = await seedUser({ email: 'editor2@example.com', role: 'editor' });
    const token = mintJwt({ sub: u.userId, email: u.email });
    const res = await request(app).get('/api/admin/users').set(authHeader(token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('200 for super_admin', async () => {
    const u = await seedUser({ email: 'boss2@example.com', role: 'super_admin' });
    const token = mintJwt({ sub: u.userId, email: u.email });
    const res = await request(app).get('/api/admin/users').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.map((r: { email: string }) => r.email)).toContain(u.email);
  });
});
