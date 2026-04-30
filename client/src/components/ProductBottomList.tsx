import {
  ArrowUpRight,
  Boxes,
  FileCheck,
  Package,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { pickBrandLang, pickLang, type ProductItem } from '@asb/shared';

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

  const visible = products.filter((p) => p.isParticipating);
  if (visible.length === 0) return null;

  return (
    <section id="all-products" className="mt-12 border-t border-white/5 pt-8 scroll-mt-20">
      <h2 className="text-sm font-medium text-white/70 mb-4">{ui.allProductsTitle}</h2>
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
    </section>
  );
}
