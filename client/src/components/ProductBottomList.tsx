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
  ALL_INDUSTRIES,
  audienceBucketsFor,
  pickBrandLang,
  pickLang,
  type AudienceBucket,
  type Industry,
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

  // Multi-select role filter. OR within row: a product matches if it covers
  // ANY selected bucket. Empty = no role filter (show all).
  const [selectedRoles, setSelectedRoles] = useState<Set<AudienceBucket>>(new Set());
  const toggleRole = (b: AudienceBucket) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
  };

  // Multi-select industry filter. OR within row, AND with role filter (cross-row).
  // KEY decision: products with empty industries[] are treated as "applies to
  // all industries" — they match every industry filter. Maximises hit rate
  // for cross-cutting tools (CLM, Expense, CRM) so they don't disappear when
  // visitor narrows by industry. Editor-side hint tells admins this semantic.
  const [selectedIndustries, setSelectedIndustries] = useState<Set<Industry>>(new Set());
  const toggleIndustry = (i: Industry) => {
    setSelectedIndustries((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const clear = () => {
    setSelectedRoles(new Set());
    setSelectedIndustries(new Set());
  };

  // Industry → product count, only counting products that actually tag this
  // industry (cross-cutting [] products are not counted toward any specific
  // industry's badge — they show up via the wildcard fallback at filter time).
  const industryCounts = useMemo(() => {
    const counts = new Map<Industry, number>();
    for (const p of participating) {
      const inds = (p.industries ?? []) as Industry[];
      for (const i of inds) counts.set(i, (counts.get(i) ?? 0) + 1);
    }
    return counts;
  }, [participating]);
  const availableIndustries = ALL_INDUSTRIES.filter((i) => (industryCounts.get(i) ?? 0) > 0);

  const visible = useMemo(() => {
    return participating.filter((p) => {
      // Role filter (OR within row, skip if empty)
      if (selectedRoles.size > 0) {
        const buckets = productBuckets.get(p.id);
        if (!buckets) return false;
        let roleMatch = false;
        for (const b of selectedRoles) {
          if (buckets.has(b)) {
            roleMatch = true;
            break;
          }
        }
        if (!roleMatch) return false;
      }
      // Industry filter (OR within row, AND with role filter, with wildcard semantics)
      if (selectedIndustries.size > 0) {
        const inds = (p.industries ?? []) as Industry[];
        // Wildcard: empty product industries = applies to all → always match
        if (inds.length === 0) return true;
        let industryMatch = false;
        for (const i of selectedIndustries) {
          if (inds.includes(i)) {
            industryMatch = true;
            break;
          }
        }
        if (!industryMatch) return false;
      }
      return true;
    });
  }, [participating, productBuckets, selectedRoles, selectedIndustries]);

  const hasAnyFilter = selectedRoles.size > 0 || selectedIndustries.size > 0;

  if (participating.length === 0) return null;

  return (
    <section id="all-products" className="mt-12 border-t border-white/5 pt-8 scroll-mt-20">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-white/70">{ui.allProductsTitle}</h2>
        <span className="text-[11px] text-white/40 tabular-nums">
          {visible.length} / {participating.length}
        </span>
      </div>

      {/* Filter rows. Two stacked rows:
          - 行业 (industry) — explicit metadata; wildcard fallback for products
            tagged with empty industries (CLM/Expense type cross-cutting tools)
          - 角色 (role bucket) — derived heuristically from product.audience text
          Cross-row semantics is AND (must match both); within-row is OR. */}
      {(availableIndustries.length > 0 || availableBuckets.length > 0) && (
        <div className="mb-5 space-y-2">
          {/* Industry row */}
          {availableIndustries.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/40 mr-1">
                {ui.filterByIndustry}
              </span>
              {availableIndustries.map((i) => {
                const isOn = selectedIndustries.has(i);
                const count = industryCounts.get(i) ?? 0;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleIndustry(i)}
                    className={[
                      'inline-flex items-center gap-1 rounded-full border px-3 py-1 transition-colors',
                      isOn
                        ? 'accent-bg text-black border-transparent font-medium'
                        : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white',
                    ].join(' ')}
                    aria-pressed={isOn}
                  >
                    <span>{ui.industryLabel[i]}</span>
                    <span className={isOn ? 'text-black/60' : 'text-white/40'}>·{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Role row */}
          {availableBuckets.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/40 mr-1">
                {ui.filterByRole}
              </span>
              {availableBuckets.map((b) => {
                const isOn = selectedRoles.has(b);
                const count = bucketCounts.get(b) ?? 0;
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleRole(b)}
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
              {hasAnyFilter && (
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

      {/* Empty filter result — happens when industry × role intersection
          excludes all products. */}
      {visible.length === 0 && hasAnyFilter && (
        <p className="mt-4 text-center text-xs text-white/40">
          {ui.audienceBucketEmpty}
        </p>
      )}
    </section>
  );
}
