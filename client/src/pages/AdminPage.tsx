import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';

import { useBrandQuery } from '../lib/queries';
import { detectInitialLang } from '../lib/i18n';
import { subscribeToConfig } from '../lib/realtime';
import { getToken, setToken } from '../lib/api';
import { useAppStore } from '../lib/store';
import { applyTheme } from '../lib/themes';
import { t } from '../lib/translations';

import LangSwitch from '../components/LangSwitch';
import LoginForm from '../components/admin/LoginForm';
import BrandSwitch from '../components/admin/BrandSwitch';
import LlmChainConfig from '../components/admin/LlmChainConfig';
import ProductList from '../components/admin/ProductList';

/**
 * /admin — hidden path, single-password JWT gate (design §8.2).
 * After login:
 *   - BrandSwitch flips the active brand (fans out via Realtime to user-mode clients)
 *   - ProductList offers CRUD over the shared catalog
 */
export default function AdminPage() {
  const lang = useAppStore((s) => s.lang);
  const brand = useAppStore((s) => s.brand);
  const setLang = useAppStore((s) => s.setLang);
  const setBrand = useAppStore((s) => s.setBrand);
  const ui = t(lang);

  const qc = useQueryClient();
  const brandQuery = useBrandQuery();

  const [authed, setAuthed] = useState<boolean>(() => !!getToken());

  // Boot: lang detection (same as App.tsx) + theme + realtime
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

  const logout = () => {
    setToken(null);
    setAuthed(false);
  };

  return (
    <div className="min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-20 border-b border-white/5 backdrop-blur bg-[var(--bg-base)]/80">
        <div className="mx-auto max-w-4xl flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
          <h1 className="text-sm sm:text-base font-semibold">{ui.adminTitle}</h1>
          <div className="flex items-center gap-3">
            <LangSwitch />
            {authed && (
              <button
                type="button"
                onClick={logout}
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
        {!authed ? (
          <LoginForm lang={lang} onSuccess={() => setAuthed(true)} />
        ) : (
          <div className="flex flex-col gap-6">
            <BrandSwitch />
            <LlmChainConfig />
            <ProductList />
          </div>
        )}
      </main>
    </div>
  );
}
