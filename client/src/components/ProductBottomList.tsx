import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Boxes,
  FileCheck,
  Package,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';

import {
  ALL_AUDIENCE_BUCKETS,
  audienceBucketsFor,
  pickBrandLang,
  pickLang,
  type AudienceBucket,
  type ProductItem,
} from '@asb/shared';

import { useAppStore } from '../lib/store';
import { t } from '../lib/translations';

// Icon heuristic: pick a lucide icon by lowercased product id substring.
// This is a *visual hint*, not a categorisation system — admin can rename
// products freely without breaking anything (just falls back to Package).
// Avoids adding a `category` schema field for what's purely a UI affordance.
function iconFor(id: string): LucideIcon {
  const k = id.toLowerCase();
  if (k.includes('crm') || k.includes('customer')) return Users;
  if (k.includes('agent') || k.includes('pilot') || k.includes('ai')) return Sparkles;
  if (k.includes('clm') || k.includes('contract')) return FileCheck;
  if (k.includes('compliance') || k.includes('gdpr') || k.includes('audit')) return ShieldCheck;
  if (k.includes('expense') || k.includes('settle') || k.includes('finance') || k.includes('payroll')) return Wallet;
  if (
    k.includes('erp') ||
    k.includes('oms') ||
    k.includes('srm') ||
    k.includes('scp') ||
    k.includes('supply') ||
    k.includes('order') ||
    k.includes('inventory')
  ) {
    return Boxes;
  }
  return Package;
}

/**
 * "All products" catalog shown below the AI recommendation area.
 *
 * Two roles:
 *   1. Reference / browsing for visitors who don't engage the AI flow —
 *      staff can verbally walk through and point at cards
 *   2. Deep-link target: each card opens its brand × lang specific landing
 *      page in a new tab (pickBrandLang fallback chain)
 *
 * Section has id="all-products" so an in-page skip link from the input area
 * can scroll directly here for the "no AI" fallback path.
 */
export default function ProductBottomList({ products }: { products: ProductItem[] }) {
  const lang = useAppStore((s) => s.lang);
  const brand = useAppStore((s) => s.brand);
  const ui = t(lang);

  const participating = products.filter((p) => p.isParticipating);

  // Pre-compute bucket set per product (one regex pass per product, memoised
  // across re-renders since `products` rarely changes mid-session).
  const productBuckets = useMemo(() => {
    const map = new Map<string, Set<AudienceBucket>>();
    for (const p of participating) {
      // Bucket detection runs against the audience string in the *current* lang.
      // Since the regex covers zh/zh-HK/en/ja synonyms in one pattern, lang
      // mismatches between page lang and audience text don't drop matches.
      map.set(p.id, audienceBucketsFor(pickLang(p.audience, lang)));
    }
    return map;
  }, [participating, lang]);

  // Bucket → product count, used both to decide which chips to *show* (skip
  // empty ones) and to render the "(3)" suffix on chips for scanability.
  const bucketCounts = useMemo(() => {
    const counts = new Map<AudienceBucket, number>();
    for (const buckets of productBuckets.values()) {
      for (const b of buckets) counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    return counts;
  }, [productBuckets]);

  // Only render chips for buckets that have ≥ 1 product. Avoids dead chips.
  const availableBuckets = ALL_AUDIENCE_BUCKETS.filter((b) => (bucketCounts.get(b) ?? 0) > 0);

  // Multi-select bucket filter. OR semantics: a product passes the filter if
  // it matches ANY selected bucket. Empty set = no filter (show all).
  const [selected, setSelected] = useState<Set<AudienceBucket>>(new Set());
  const toggle = (b: AudienceBucket) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
  };
  const clear = () => setSelected(new Set());

  const visible = useMemo(() => {
    if (selected.size === 0) return participating;
    return participating.filter((p) => {
      const buckets = productBuckets.get(p.id);
      if (!buckets) return false;
      for (const b of selected) {
        if (buckets.has(b)) return true;
      }
      return false;
    });
  }, [participating, productBuckets, selected]);

  if (participating.length === 0) return null;

  return (
    <section id="all-products" className="mt-12 border-t border-white/5 pt-8 scroll-mt-20">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-white/70">{ui.allProductsTitle}</h2>
        <span className="text-[11px] text-white/40 tabular-nums">
          {visible.length} / {participating.length}
        </span>
      </div>

      {/* Role-bucket filter chips — staff-led demo affordance:
          - Visitor says "I'm in legal at a bank" → staff clicks 法务 chip
          - Multiple chips OR-merged so cross-functional searches work too
          - Chips with 0 matches are hidden so the bar stays clean */}
      {availableBuckets.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
          {availableBuckets.map((b) => {
            const isOn = selected.has(b);
            const count = bucketCounts.get(b) ?? 0;
            return (
              <button
                key={b}
                type="button"
                onClick={() => toggle(b)}
                className={[
                  'inline-flex items-center gap-1 rounded-full border px-3 py-1 transition-colors',
                  isOn
                    ? 'accent-bg text-black border-transparent font-medium'
                    : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white',
                ].join(' ')}
                aria-pressed={isOn}
              >
                <span>{ui.audienceBucketLabel[b]}</span>
                <span className={isOn ? 'text-black/60' : 'text-white/40'}>·{count}</span>
              </button>
            );
          })}
          {selected.size > 0 && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-white/60 hover:text-white"
            >
              <X size={11} />
              {ui.audienceBucketClear}
            </button>
          )}
        </div>
      )}

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((p) => {
          const url = pickBrandLang(p.url, brand, lang);
          const Icon = iconFor(p.id);
          const description = pickLang(p.description, lang);
          const audience = pickLang(p.audience, lang);
          const body = (
            <div className="group h-full flex flex-col gap-3 rounded-xl border border-white/5 bg-[var(--bg-surface)]/60 p-4 transition-all hover:bg-[var(--bg-surface)] hover:border-[var(--accent-muted)] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30">
              {/* Header: icon + name + arrow */}
              <div className="flex items-start gap-3">
                <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] group-hover:bg-[var(--accent)]/20 transition-colors">
                  <Icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{pickLang(p.name, lang)}</p>
                </div>
                {url && (
                  <ArrowUpRight
                    size={14}
                    className="mt-1 shrink-0 text-white/30 group-hover:text-[var(--accent)] transition-colors"
                  />
                )}
              </div>

              {/* Description preview — 2 lines max so card height stays bounded */}
              {description && (
                <p className="text-xs text-white/60 leading-relaxed line-clamp-2">
                  {description}
                </p>
              )}

              {/* Audience as a small footer chip — secondary info, not the headline */}
              {audience && (
                <p className="mt-auto text-[10px] text-white/40 uppercase tracking-wide truncate">
                  {audience}
                </p>
              )}
            </div>
          );
          return (
            <li key={p.id}>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer noopener" className="block h-full">
                  {body}
                </a>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>

      {/* Empty filter result — only happens if user toggles a chip whose
          products all got hidden by some other condition. Defensive guard;
          unlikely in normal use since chips are derived from visible set. */}
      {visible.length === 0 && selected.size > 0 && (
        <p className="mt-4 text-center text-xs text-white/40">
          {ui.audienceBucketEmpty}
        </p>
      )}
    </section>
  );
}
