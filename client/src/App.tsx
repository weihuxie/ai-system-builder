import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useBrandQuery, useProductsQuery } from './lib/queries';
import { detectInitialLang } from './lib/i18n';
import { subscribeToConfig } from './lib/realtime';
import { useAppStore } from './lib/store';
import { applyTheme } from './lib/themes';
import { t } from './lib/translations';

import Header from './components/Header';
import InputArea from './components/InputArea';
import OfflineBanner from './components/OfflineBanner';
import ProductBottomList from './components/ProductBottomList';
import QuickScenarios from './components/QuickScenarios';
import RecommendationGrid from './components/RecommendationGrid';

/**
 * User mode.
 * Boot sequence:
 *   1. detectInitialLang()   — lang via localStorage > /api/geo > navigator
 *   2. fetch /api/brand       — paint theme (CSS vars)
 *   3. subscribeToConfig()    — Supabase realtime for multi-site sync
 *   4. fetch /api/products    — catalog for bottom list + recommendation lookup
 */
export default function App() {
  const lang = useAppStore((s) => s.lang);
  const brand = useAppStore((s) => s.brand);
  const setLang = useAppStore((s) => s.setLang);
  const setBrand = useAppStore((s) => s.setBrand);

  const qc = useQueryClient();
  const brandQuery = useBrandQuery();
  const productsQuery = useProductsQuery();

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // 1. Initial language detection (runs once)
  useEffect(() => {
    let cancelled = false;
    detectInitialLang().then((resolved) => {
      if (!cancelled) setLang(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [setLang]);

  // 2. Sync server brand → store + CSS vars
  useEffect(() => {
    if (brandQuery.data?.brand && brandQuery.data.brand !== brand) {
      setBrand(brandQuery.data.brand);
    }
  }, [brandQuery.data?.brand, brand, setBrand]);

  // 3. Apply theme whenever brand changes (covers both user-side sync and admin-triggered flips)
  useEffect(() => {
    applyTheme(brand);
  }, [brand]);

  // 4. Realtime subscription (products + global_config)
  useEffect(() => {
    const unsub = subscribeToConfig(qc);
    return unsub;
  }, [qc]);

  const products = productsQuery.data ?? [];

  return (
    <div className="relative min-h-dvh bg-[var(--bg-base)] text-[var(--text-primary)] overflow-x-hidden">
      {/* Ambient gradient blobs — décor, behind everything. See index.css
          .hero-ambient. They give the page a "morning light" warmth that flat
          off-white couldn't, without distracting from content (heavy blur,
          low opacity). Tinted by --accent so brand switch carries through. */}
      <div className="hero-ambient" aria-hidden="true" />
      <div className="hero-ambient-secondary" aria-hidden="true" />

      <div className="relative z-10">
        <Header />
        <OfflineBanner />
        <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
          <section className="pt-12 sm:pt-20">
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight max-w-3xl">
              {t(lang).inputHint}
              <span className="ml-2 inline-block text-2xl sm:text-3xl">✨</span>
            </h2>
          </section>

          <InputArea ref={inputRef} />

          <QuickScenarios
            onPick={() => {
              // Focus textarea + scroll it into view so users see their filled input
              requestAnimationFrame(() => {
                inputRef.current?.focus();
                inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              });
            }}
          />

          <RecommendationGrid products={products} />

          <ProductBottomList products={products} />
        </main>
      </div>
    </div>
  );
}
