import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

import { useBrandQuery, useMeQuery, queryKeys } from '../lib/queries';
import { detectInitialLang } from '../lib/i18n';
import { subscribeToConfig } from '../lib/realtime';
import { getSupabase } from '../lib/supabase';
import { useAppStore } from '../lib/store';
import { applyTheme } from '../lib/themes';
import { t } from '../lib/translations';

import LangSwitch from '../components/LangSwitch';
import LoginForm from '../components/admin/LoginForm';
import BrandSwitch from '../components/admin/BrandSwitch';
import LlmChainConfig from '../components/admin/LlmChainConfig';
import ProductList from '../components/admin/ProductList';
import AdminUsersPanel from '../components/admin/AdminUsersPanel';

/**
 * /admin — Google OAuth gate (design §8.2 post-upgrade).
 * Flow:
 *   no session              → LoginForm
 *   session, /me = 403      → NotWhitelistedPanel (with sign-out)
 *   session, /me OK         → admin UI (role-gated panels in Stage 7)
 */
export default function AdminPage() {
  const lang = useAppStore((s) => s.lang);
  const brand = useAppStore((s) => s.brand);
  const setLang = useAppStore((s) => s.setLang);
  const setBrand = useAppStore((s) => s.setBrand);
  const ui = t(lang);

  const qc = useQueryClient();
  const brandQuery = useBrandQuery();

  // Supabase session state — undefined while we check, null when signed out,
  // a Session object when authenticated.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const me = useMeQuery(!!session);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setSession(null);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // New session/logout → fetch /me afresh
      qc.invalidateQueries({ queryKey: queryKeys.me });
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  useEffect(() => {
    let cancelled = false;
    detectInitialLang().then((resolved) => {
      if (!cancelled) setLang(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [setLang]);

  useEffect(() => {
    if (brandQuery.data?.brand && brandQuery.data.brand !== brand) {
      setBrand(brandQuery.data.brand);
    }
  }, [brandQuery.data?.brand, brand, setBrand]);

  useEffect(() => {
    applyTheme(brand);
  }, [brand]);

  useEffect(() => subscribeToConfig(qc), [qc]);

  const signOut = async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    qc.clear();
  };

  const authed = !!me.data;

  return (
    <div className="min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-20 border-b border-white/5 backdrop-blur bg-[var(--bg-base)]/80">
        <div className="mx-auto max-w-4xl flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
          <h1 className="text-sm sm:text-base font-semibold">{ui.adminTitle}</h1>
          <div className="flex items-center gap-3">
            <LangSwitch />
            {(authed || session) && (
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
              >
                <LogOut size={12} />
                {ui.adminLogout}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
        {session === undefined || (session && me.isLoading) ? (
          <p className="mt-20 text-center text-sm text-white/60">…</p>
        ) : !session ? (
          <LoginForm lang={lang} />
        ) : !me.data ? (
          <div className="mx-auto mt-20 w-full max-w-md rounded-2xl border border-amber-400/20 bg-amber-500/5 p-6">
            <h2 className="text-lg font-semibold text-amber-200">{ui.adminNotWhitelistedTitle}</h2>
            <p className="mt-3 text-sm text-white/80">
              {session.user.email && (
                <span className="font-mono text-white">{session.user.email}</span>
              )}
            </p>
            <p className="mt-3 text-sm text-white/70">{ui.adminNotWhitelistedHint}</p>
            <button
              type="button"
              onClick={signOut}
              className="mt-6 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
            >
              {ui.adminSwitchAccount}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {me.data.role === 'super_admin' && (
              <>
                <BrandSwitch />
                <LlmChainConfig />
                <AdminUsersPanel me={me.data} />
              </>
            )}
            <ProductList me={me.data} />
          </div>
        )}
      </main>
    </div>
  );
}
