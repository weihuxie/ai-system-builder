// ───────────────────────────────────────────
// Supabase anon client — used ONLY for Realtime subscriptions.
// All data reads/writes go through the backend so that:
//   - service key stays server-side
//   - we have one place to enforce validation / audit
// ───────────────────────────────────────────

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/**
 * Lazy singleton. Returns null if env vars are missing so the rest of the app
 * still works offline (Realtime is a nice-to-have, not a hard dep).
 */
export function getSupabase(): SupabaseClient | null {
  if (cached) return cached;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // eslint-disable-next-line no-console
    console.warn('[asb/client] Supabase env missing — realtime sync disabled');
    return null;
  }
  cached = createClient(url, key, {
    auth: { persistSession: false },
  });
  return cached;
}
