import { useMemo, useState } from 'react';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { pickLang, type AuthedUser, type ProductItem } from '@asb/shared';

import {
  useAdminProductsQuery,
  useCloneProductMutation,
  useDeleteProductMutation,
  useUpsertProductMutation,
} from '../../lib/queries';
import { t } from '../../lib/translations';
import { useAppStore } from '../../lib/store';
import ErrorBanner from '../ErrorBanner';
import ProductEditor from './ProductEditor';

type Filter = 'mine' | 'all' | 'orphan';

export default function ProductList({ me }: { me: AuthedUser }) {
  const lang = useAppStore((s) => s.lang);
  const ui = t(lang);

  // Admin-scoped query (server enforces: editor → only own rows; super_admin → all).
  // Editor can no longer see siblings' products even via raw Network response.
  const productsQuery = useAdminProductsQuery(true);
  const del = useDeleteProductMutation();
  const clone = useCloneProductMutation();
  const upsert = useUpsertProductMutation();
  const [editing, setEditing] = useState<ProductItem | null | undefined>(undefined);
  // undefined = editor closed; null = creating; ProductItem = editing that item
  const [filter, setFilter] = useState<Filter>(me.role === 'editor' ? 'mine' : 'all');

  const all = productsQuery.data ?? [];

  // For editor: server returns own + platform (ownerId=null). Sort own to top
  // so the editor always sees their work first, then the read-only reference
  // catalog below. For super_admin: retain mine/all/orphan filter triage.
  const visible = useMemo(() => {
    if (me.role === 'editor') {
      return [...all].sort((a, b) => {
        const aMine = a.ownerId === me.id ? 0 : 1;
        const bMine = b.ownerId === me.id ? 0 : 1;
        if (aMine !== bMine) return aMine - bMine;
        return a.id.localeCompare(b.id);
      });
    }
    if (filter === 'mine') return all.filter((p) => p.ownerId === me.id);
    if (filter === 'orphan') return all.filter((p) => p.ownerId === null);
    return all;
  }, [all, filter, me.id, me.role]);

  const canMutate = (p: ProductItem) => me.role === 'super_admin' || p.ownerId === me.id;
  const isPlatform = (p: ProductItem) => p.ownerId === null;
  const myCount = me.role === 'editor' ? all.filter((p) => p.ownerId === me.id).length : 0;
  const platformCount = me.role === 'editor' ? all.filter((p) => p.ownerId === null).length : 0;

  const onDelete = async (p: ProductItem) => {
    if (!window.confirm(ui.adminConfirmDelete)) return;
    try {
      await del.mutateAsync(p.id);
    } catch {
      // banner
    }
  };

  const onClone = async (p: ProductItem) => {
    try {
      const created = await clone.mutateAsync(p.id);
      toast.success(ui.adminProductCloned, { description: created.id });
    } catch {
      // banner
    }
  };

  const onTogglePublish = async (p: ProductItem) => {
    const next = !p.isParticipating;
    try {
      await upsert.mutateAsync({
        mode: 'update',
        product: {
          id: p.id,
          name: p.name,
          description: p.description,
          audience: p.audience,
          url: p.url,
          isParticipating: next,
          ownerId: p.ownerId,
        },
      });
      toast.success(next ? ui.adminProductPublished : ui.adminProductUnpublished, {
        description: pickLang(p.name, lang),
      });
    } catch {
      // banner
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
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

      {me.role === 'super_admin' && (
        <div className="mt-3 inline-flex rounded-full border border-white/10 bg-white/5 p-0.5 text-xs">
          {(['all', 'mine', 'orphan'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={[
                'rounded-full px-3 py-1 transition-colors',
                filter === f
                  ? 'accent-bg text-black font-medium'
                  : 'text-white/70 hover:text-white',
              ].join(' ')}
            >
              {f === 'all'
                ? `${ui.adminProductsTitle} (${all.length})`
                : f === 'mine'
                  ? `${ui.adminUsersRoleEditor}/${me.email.split('@')[0]}`
                  : ui.adminProductUnowned}
            </button>
          ))}
        </div>
      )}

      {/* Editor lead-in: a count summary + a hint that platform rows are
          read-only reference. Onboarding aid for fresh editors who'd otherwise
          see a single empty row and not know what to do. */}
      {me.role === 'editor' && (
        <p className="mt-2 text-[11px] text-white/40 leading-relaxed">
          {ui.adminProductsEditorHint
            .replace('{my}', String(myCount))
            .replace('{platform}', String(platformCount))}
        </p>
      )}

      <ErrorBanner
        error={productsQuery.error ?? del.error ?? clone.error ?? upsert.error}
        lang={lang}
      />

      <ul className="mt-4 divide-y divide-white/5">
        {visible.map((p) => {
          const mutable = canMutate(p);
          const platformRow = me.role === 'editor' && isPlatform(p);
          return (
            <li
              key={p.id}
              className={[
                'flex items-center justify-between gap-3 py-3',
                platformRow && 'opacity-70', // visually fade read-only reference rows
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{pickLang(p.name, lang)}</span>
                  <code className="text-[10px] text-white/40">{p.id}</code>
                  <button
                    type="button"
                    onClick={() => onTogglePublish(p)}
                    disabled={!mutable || upsert.isPending}
                    className={[
                      'rounded-full px-2 py-0.5 text-[10px] transition-colors',
                      p.isParticipating
                        ? 'bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                        : 'bg-white/5 text-white/50 hover:bg-white/10',
                      !mutable && 'cursor-not-allowed opacity-60',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {p.isParticipating ? 'on' : 'off'}
                  </button>
                  {me.role === 'super_admin' && (
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/50">
                      {p.ownerEmail ?? ui.adminProductUnowned}
                    </span>
                  )}
                  {/* Editor-side ownership badge:
                      "我的" → editable
                      "平台" → read-only reference (super_admin curated) */}
                  {me.role === 'editor' && (
                    <span
                      className={[
                        'rounded-full border px-2 py-0.5 text-[10px]',
                        platformRow
                          ? 'border-white/10 bg-white/[0.03] text-white/50'
                          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
                      ].join(' ')}
                    >
                      {platformRow ? ui.adminProductBadgePlatform : ui.adminProductBadgeMine}
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
                  onClick={() => onClone(p)}
                  disabled={clone.isPending}
                  aria-label={ui.adminProductClone}
                  title={ui.adminProductClone}
                  className="rounded-lg p-2 text-white/70 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  disabled={!mutable}
                  aria-label={ui.adminEditProduct}
                  className="rounded-lg p-2 text-white/70 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(p)}
                  disabled={!mutable}
                  aria-label={ui.adminDeleteProduct}
                  className="rounded-lg p-2 text-white/70 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          );
        })}
        {visible.length === 0 && !productsQuery.isLoading && (
          <li className="py-6 text-center text-sm text-white/40">—</li>
        )}
      </ul>

      {editing !== undefined && (
        <ProductEditor lang={lang} initial={editing} onClose={() => setEditing(undefined)} />
      )}
    </section>
  );
}
