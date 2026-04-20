// ───────────────────────────────────────────
// Supabase Realtime subscription — keep multi-demo machines in sync.
// When products or global_config change in DB, invalidate React Query cache.
// ───────────────────────────────────────────

import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from './queries';
import { getSupabase } from './supabase';

type Unsubscribe = () => void;

/**
 * Subscribe to `products` + `global_config` tables. Returns an unsubscribe fn.
 * No-op if Supabase env vars aren't set (offline / local demo).
 *
 * Known gotcha (CLAUDE.md §4.3): Realtime must be manually enabled on both
 * tables in the Supabase Dashboard → Database → Replication. Migration also
 * adds them to the supabase_realtime publication, but the dashboard toggle
 * is a separate switch on some projects.
 */
export function subscribeToConfig(qc: QueryClient): Unsubscribe {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  const channel = supabase
    .channel('asb-config')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      () => {
        qc.invalidateQueries({ queryKey: queryKeys.products });
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'global_config' },
      () => {
        qc.invalidateQueries({ queryKey: queryKeys.brand });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
