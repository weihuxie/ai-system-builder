import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { pickLang, type ProductItem } from '@asb/shared';

import { useDeleteProductMutation, useProductsQuery } from '../../lib/queries';
import { t } from '../../lib/translations';
import { useAppStore } from '../../lib/store';
import ErrorBanner from '../ErrorBanner';
import ProductEditor from './ProductEditor';

export default function ProductList() {
  const lang = useAppStore((s) => s.lang);
  const ui = t(lang);

  const productsQuery = useProductsQuery();
  const del = useDeleteProductMutation();
  const [editing, setEditing] = useState<ProductItem | null | undefined>(undefined);
  // undefined = editor closed; null = creating; ProductItem = editing that item

  const products = productsQuery.data ?? [];

  const onDelete = async (p: ProductItem) => {
    if (!window.confirm(ui.adminConfirmDelete)) return;
    try {
      await del.mutateAsync(p.id);
    } catch {
      // banner
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-white/70">{ui.adminProductsTitle}</h2>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="inline-flex items-center gap-1 rounded-full accent-bg text-black px-3 py-1.5 text-xs font-medium hover:brightness-110"
        >
          <Plus size={14} />
          {ui.adminAddProduct}
        </button>
      </div>

      <ErrorBanner error={productsQuery.error ?? del.error} lang={lang} />

      <ul className="mt-4 divide-y divide-white/5">
        {products.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{pickLang(p.name, lang)}</span>
                <code className="text-[10px] text-white/40">{p.id}</code>
                {!p.isParticipating && (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                    off
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-white/50 line-clamp-1">
                {pickLang(p.audience, lang)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setEditing(p)}
                aria-label={ui.adminEditProduct}
                className="rounded-lg p-2 text-white/70 hover:bg-white/5 hover:text-white"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(p)}
                aria-label={ui.adminDeleteProduct}
                className="rounded-lg p-2 text-white/70 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
        {products.length === 0 && !productsQuery.isLoading && (
          <li className="py-6 text-center text-sm text-white/40">—</li>
        )}
      </ul>

      {editing !== undefined && (
        <ProductEditor lang={lang} initial={editing} onClose={() => setEditing(undefined)} />
      )}
    </section>
  );
}
