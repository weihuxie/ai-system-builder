import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { resetDb, seedProduct, testDb } from '../helpers/db.js';

// F8: RLS regression test for the anon role.
//
// Why: Supabase Realtime broadcasts respect RLS — events for rows that the
// subscriber's role can't SELECT are filtered server-side. Therefore the
// "non-participating products don't fan out to anon" guarantee reduces to
// "anon SELECT policy on products correctly filters is_participating=true".
// Same for "anon can't write" — we want defense-in-depth even though writes
// always go through the backend with service_role key.
//
// We verify the guarantees directly by hitting Supabase REST with an anon
// client (no JWT). If a future migration weakens any of these policies, this
// test fails BEFORE the change reaches Summit.
//
// Realtime websocket fan-out is NOT exercised here (would require a
// long-running subscription + race-y assertion); we lean on the documented
// "Realtime ⊆ SELECT RLS" guarantee. Manual two-tab smoke is in CLAUDE.md.

function anonClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL!;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error('.env.test missing SUPABASE_ANON_KEY — required for RLS test');
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe('RLS · anon role on products', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    await resetDb();
  });

  it('anon SELECT only returns is_participating=true rows', async () => {
    // Seed one of each via service key.
    await seedProduct({ id: 'PUB', ownerId: null, isParticipating: true });
    await seedProduct({ id: 'HIDDEN', ownerId: null, isParticipating: false });

    const { data, error } = await anonClient().from('products').select('id, is_participating');
    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id).sort();
    expect(ids).toEqual(['PUB']); // HIDDEN filtered out
  });

  it('anon INSERT is blocked (no insert policy for anon)', async () => {
    const { error } = await anonClient()
      .from('products')
      .insert({
        id: 'EVIL',
        name: { en: 'evil', 'zh-CN': 'evil', 'zh-HK': 'evil', ja: 'evil' },
        description: { en: 'd', 'zh-CN': 'd', 'zh-HK': 'd', ja: 'd' },
        audience: { en: 'a', 'zh-CN': 'a', 'zh-HK': 'a', ja: 'a' },
        url: {},
      });
    expect(error).not.toBeNull();
    // Postgres "permission denied" / RLS rejection both end up as 42501 (PG)
    // or 401/403 from PostgREST. We accept either signal — the point is it FAILED.
    expect(error?.code === '42501' || error?.message?.toLowerCase().includes('row-level')).toBe(true);

    // Verify nothing landed via service key.
    const { data: check } = await testDb().from('products').select('id').eq('id', 'EVIL');
    expect(check ?? []).toHaveLength(0);
  });

  it('anon UPDATE on participating row affects 0 rows (no update policy)', async () => {
    await seedProduct({ id: 'PUB', ownerId: null, isParticipating: true });

    // PostgREST returns 0 affected rows when UPDATE is silently filtered by RLS.
    // We assert by reading back: name unchanged.
    await anonClient().from('products').update({ is_participating: false }).eq('id', 'PUB');
    const { data: check } = await testDb()
      .from('products')
      .select('is_participating')
      .eq('id', 'PUB')
      .single();
    expect(check?.is_participating).toBe(true); // anon update silently dropped
  });

  it('anon DELETE on participating row affects 0 rows', async () => {
    await seedProduct({ id: 'PUB', ownerId: null, isParticipating: true });

    await anonClient().from('products').delete().eq('id', 'PUB');
    const { data: check } = await testDb().from('products').select('id').eq('id', 'PUB');
    expect(check ?? []).toHaveLength(1); // still there
  });
});

describe('RLS · anon role on global_config', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('anon SELECT works (config is public-readable)', async () => {
    const { data, error } = await anonClient()
      .from('global_config')
      .select('id, brand')
      .eq('id', 1)
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBe(1);
    expect(['google', 'aws']).toContain(data?.brand);
  });

  it('anon UPDATE on global_config is silently dropped', async () => {
    await anonClient().from('global_config').update({ brand: 'aws' }).eq('id', 1);
    const { data: check } = await testDb()
      .from('global_config')
      .select('brand')
      .eq('id', 1)
      .single();
    // resetDb seeds brand='google'; anon's flip to 'aws' must not have applied.
    expect(check?.brand).toBe('google');
  });
});
