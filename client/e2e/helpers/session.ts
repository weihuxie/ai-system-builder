import type { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Sign the user in from node (Playwright host) via signInWithPassword, get a
// real session, then inject it into the browser's localStorage under the key
// Supabase uses (`sb-<project-ref>-auth-token`). Reloading causes the app's
// supabase client to pick it up without any UI OAuth dance.
export async function signInAs(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!url || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.test');
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`signInWithPassword failed for ${email}: ${error?.message ?? 'no session'}`);
  }

  // Derive the project ref from the URL: https://<ref>.supabase.co
  const match = url.match(/^https?:\/\/([^.]+)\.supabase\.co/);
  if (!match) throw new Error(`Cannot parse Supabase project ref from URL: ${url}`);
  const storageKey = `sb-${match[1]}-auth-token`;

  // Supabase v2's persisted shape is the full session object as JSON.
  const sessionJson = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: data.session.user,
  });

  await page.goto('/admin');
  await page.evaluate(
    ({ key, value, langKey, langVal }) => {
      localStorage.setItem(key, value);
      // Pin the UI language to zh-CN so e2e regex assertions like /品牌切换/
      // match deterministically. Without this, detectInitialLang in
      // client/src/lib/i18n.ts falls through to /api/geo (depends on the test
      // machine's public IP) → navigator.language (Playwright default en-US),
      // making test outcome environment-dependent.
      localStorage.setItem(langKey, langVal);
    },
    { key: storageKey, value: sessionJson, langKey: 'asb.lang', langVal: 'zh-CN' },
  );
  await page.reload();
}

export async function signOut(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('sb-') && k.endsWith('-auth-token')) localStorage.removeItem(k);
    }
  });
}
