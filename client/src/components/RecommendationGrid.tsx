import { useMemo } from 'react';

import type { ProductItem } from '@asb/shared';

import { useAppStore } from '../lib/store';
import { t } from '../lib/translations';
import RecommendationCard from './RecommendationCard';

/**
 * Renders 3 cards when store.solution is set. Returns null otherwise (so the
 * section disappears on new queries — no stale content flash).
 */
export default function RecommendationGrid({ products }: { products: ProductItem[] }) {
  const lang = useAppStore((s) => s.lang);
  const brand = useAppStore((s) => s.brand);
  const solution = useAppStore((s) => s.solution);
  const ui = t(lang);

  const picks = useMemo(() => {
    if (!solution) return [] as Array<{ product: ProductItem; rationale: string }>;
    const byId = new Map(products.map((p) => [p.id, p]));
    return solution.selectedProducts
      .map((id) => {
        const product = byId.get(id);
        if (!product) return null;
        return { product, rationale: solution.rationale[id] ?? '' };
      })
      .filter((x): x is { product: ProductItem; rationale: string } => x !== null);
  }, [solution, products]);

  if (!solution || picks.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium text-white/70 mb-3">{ui.recommendationsTitle}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {picks.map(({ product, rationale }, i) => (
          <RecommendationCard
            key={product.id}
            product={product}
            rationale={rationale}
            lang={lang}
            brand={brand}
            rank={i}
          />
        ))}
      </div>
    </section>
  );
}
