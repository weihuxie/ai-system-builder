import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Admin client used from Playwright test hooks: seed whitelist rows, create
// auth users with known passwords, truncate between suites.
let _admin: SupabaseClient | null = null;

export function testAdminClient(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error(
      '.env.test missing SUPABASE_URL / SUPABASE_SERVICE_KEY — Playwright cannot seed users.',
    );
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

export async function resetTestDb(): Promise<void> {
  const db = testAdminClient();
  await db.from('products').delete().neq('id', '__never__');
  await db.from('admin_users').delete().neq('email', '__never__@example.com');

  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  for (const u of list?.users ?? []) {
    if (u.email && u.email.includes('+asbtest-e2e@')) {
      await db.auth.admin.deleteUser(u.id);
    }
  }

  await db
    .from('global_config')
    .update({
      brand: 'google',
      llm_chain: [{ providerId: 'gemini', model: 'gemini-2.5-flash', enabled: true }],
      temperature: 0.7,
    })
    .eq('id', 1);
}

export interface SeededE2EUser {
  email: string;
  password: string;
  userId: string;
  role: 'editor' | 'super_admin';
}

export async function seedE2EUser(
  emailLocalPart: string,
  role: 'editor' | 'super_admin',
): Promise<SeededE2EUser> {
  const db = testAdminClient();
  const email = `${emailLocalPart}+asbtest-e2e@example.com`;
  const password = `E2E-${Math.random().toString(36).slice(2, 12)}!`;

  await db.from('admin_users').upsert({ email, role }, { onConflict: 'email' });

  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`seed auth.users: ${error.message}`);
  const userId = data.user!.id;

  await db
    .from('admin_users')
    .update({ user_id: userId, activated_at: new Date().toISOString() })
    .eq('email', email);

  return { email, password, userId, role };
}

export async function seedE2EProduct(opts: {
  id: string;
  ownerId: string | null;
  isParticipating?: boolean;
}): Promise<void> {
  const db = testAdminClient();
  const label = opts.id;
  await db.from('products').insert({
    id: opts.id,
    name: { 'zh-CN': label, 'zh-HK': label, en: label, ja: label },
    description: { 'zh-CN': 'd', 'zh-HK': 'd', en: 'd', ja: 'd' },
    audience: { 'zh-CN': 'a', 'zh-HK': 'a', en: 'a', ja: 'a' },
    url: { google: 'https://g.com', aws: 'https://a.com' },
    is_participating: opts.isParticipating ?? true,
    owner_id: opts.ownerId,
  });
}
