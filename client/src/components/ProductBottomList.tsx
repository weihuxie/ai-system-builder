import { ArrowUpRight } from 'lucide-react';

import { pickBrand, pickLang, type ProductItem } from '@asb/shared';

import { useAppStore } from '../lib/store';
import { t } from '../lib/translations';

/**
 * Compact list of all participating products. Shown below recommendations so
 * attendees (and instructors) can see the full catalog and deep-link to any
 * product's landing page under the current brand.
 */
export default function ProductBottomList({ products }: { products: ProductItem[] }) {
  const lang = useAppStore((s) => s.lang);
  const brand = useAppStore((s) => s.brand);
  const ui = t(lang);

  const visible = products.filter((p) => p.isParticipating);
  if (visible.length === 0) return null;

  return (
    <section className="mt-12 border-t border-white/5 pt-8">
      <h2 className="text-sm font-medium text-white/70 mb-4">{ui.allProductsTitle}</h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((p) => {
          const url = pickBrand(p.url, brand);
          const body = (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-[var(--bg-surface)]/60 px-4 py-3 hover:bg-[var(--bg-surface)] hover:border-[var(--accent-muted)] transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{pickLang(p.name, lang)}</p>
                <p className="mt-1 text-xs text-white/50 line-clamp-2">
                  {pickLang(p.audience, lang)}
                </p>
              </div>
              {url && (
                <ArrowUpRight size={14} className="mt-1 shrink-0 text-white/40" />
              )}
            </div>
          );
          return (
            <li key={p.id}>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer noopener" className="block">
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
