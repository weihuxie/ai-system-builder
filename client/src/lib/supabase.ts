// ───────────────────────────────────────────
// Supabase client — shared by:
//   - Realtime subscriptions (multi-demo machines stay in sync)
//   - Auth (Google OAuth; the session's access_token is a JWT we forward to our
//     Express API via the Authorization header; Express verifies with
//     SUPABASE_JWT_SECRET)
// Data reads/writes still go through our Express API, not the anon client.
// ───────────────────────────────────────────

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/**
 * Lazy singleton. Returns null if env vars are missing so the rest of the app
 * still works offline (Realtime + Admin both become no-ops in that case).
 */
export function getSupabase(): SupabaseClient | null {
  if (cached) return cached;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // eslint-disable-next-line no-console
    console.warn('[asb/client] Supabase env missing — realtime + auth disabled');
    return null;
  }
  cached = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cached;
}
