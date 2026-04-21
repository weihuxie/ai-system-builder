import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

export function testDb(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

// Strips all test-owned rows. products + admin_users are the only tables we
// mutate; global_config is a single-row singleton — we RESET it instead of
// truncating so the PUT in 0001 migration's seed stays intact.
export async function resetDb(): Promise<void> {
  const db = testDb();

  // Products first (FK on owner_id → auth.users, but ON DELETE SET NULL so
  // order doesn't matter functionally).
  const { error: prodErr } = await db.from('products').delete().neq('id', '__never__');
  if (prodErr) throw new Error(`reset products: ${prodErr.message}`);

  const { error: adminErr } = await db
    .from('admin_users')
    .delete()
    .neq('email', '__never__@example.com');
  if (adminErr) throw new Error(`reset admin_users: ${adminErr.message}`);

  // Delete all auth.users created by tests. Supabase admin API pages through.
  const { data: userList, error: listErr } = await db.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw new Error(`list auth.users: ${listErr.message}`);
  for (const u of userList?.users ?? []) {
    // Only delete users we recognize as test-created (email contains our tag).
    if (u.email && u.email.includes('+asbtest@')) {
      await db.auth.admin.deleteUser(u.id);
    }
  }

  // Reset global_config row to defaults (the 0001 migration inserts a single
  // row; later updates move `brand`, `llm_chain`, etc. Tests want a known
  // starting state).
  const { error: cfgErr } = await db
    .from('global_config')
    .update({
      brand: 'google',
      llm_chain: [{ providerId: 'gemini', model: 'gemini-2.5-flash', enabled: true }],
      temperature: 0.7,
      updated_by: null,
    })
    .eq('id', 1);
  if (cfgErr) throw new Error(`reset global_config: ${cfgErr.message}`);
}

export interface SeedUserInput {
  email: string;
  role: 'editor' | 'super_admin';
}

export interface SeededUser {
  email: string;
  userId: string;
  role: 'editor' | 'super_admin';
  password: string;
}

// Creates an auth.users row (email-confirmed) AND an admin_users whitelist
// entry. Returns the user_id so tests can mint JWTs for it.
// The auth.users insert triggers activate_admin_on_signup() which backfills
// admin_users.user_id automatically, but we also set it explicitly to be
// robust against missing triggers in local schemas.
export async function seedUser(input: SeedUserInput): Promise<SeededUser> {
  const db = testDb();
  const tag = input.email.replace('@', '+asbtest@');
  const password = `Test-${Math.random().toString(36).slice(2, 10)}!`;

  // 1. insert whitelist first — trigger fires on user creation and fills user_id.
  const { error: insErr } = await db
    .from('admin_users')
    .upsert({ email: tag, role: input.role }, { onConflict: 'email' });
  if (insErr) throw new Error(`seed admin_users ${tag}: ${insErr.message}`);

  // 2. create auth user (email_confirm: true bypasses verification mail).
  const { data: created, error: authErr } = await db.auth.admin.createUser({
    email: tag,
    password,
    email_confirm: true,
  });
  if (authErr) throw new Error(`seed auth.users ${tag}: ${authErr.message}`);
  if (!created?.user) throw new Error(`seed auth.users ${tag}: no user returned`);

  // 3. ensure admin_users.user_id is set even if trigger is absent.
  await db
    .from('admin_users')
    .update({ user_id: created.user.id, activated_at: new Date().toISOString() })
    .eq('email', tag);

  return {
    email: tag,
    userId: created.user.id,
    role: input.role,
    password,
  };
}

// Insert a product directly (bypass route). Returns the row id.
export async function seedProduct(opts: {
  id: string;
  ownerId: string | null;
  isParticipating?: boolean;
  name?: string;
}): Promise<string> {
  const db = testDb();
  const label = opts.name ?? opts.id;
  const row = {
    id: opts.id,
    name: { 'zh-CN': label, 'zh-HK': label, en: label, ja: label },
    description: { 'zh-CN': 'desc', 'zh-HK': 'desc', en: 'desc', ja: 'desc' },
    audience: { 'zh-CN': 'aud', 'zh-HK': 'aud', en: 'aud', ja: 'aud' },
    url: { google: 'https://example.com/g', aws: 'https://example.com/a' },
    is_participating: opts.isParticipating ?? true,
    owner_id: opts.ownerId,
  };
  const { error } = await db.from('products').insert(row);
  if (error) throw new Error(`seed product ${opts.id}: ${error.message}`);
  return opts.id;
}
