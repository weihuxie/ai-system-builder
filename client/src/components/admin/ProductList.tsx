import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Copy, ExternalLink, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { ALL_BRANDS, pickLang, type AuthedUser, type Brand, type ProductItem } from '@asb/shared';

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

// localStorage key for dismissing the editor onboarding tour. Set when the
// editor clicks the X. Stays per-browser (per-machine) so a fresh editor on a
// different demo laptop sees the tour again.
const TOUR_DISMISS_KEY = 'asb.editor-tour-dismissed.v1';

const BRAND_LABEL: Record<Brand, string> = { google: 'Google', aws: 'AWS' };

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

  // Inline-expand state: a Set of product IDs currently showing their full
  // detail block (description / audience / URLs). Click chevron toggles.
  // Plain Set for no extra deps; localStorage is overkill for view-only state.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Editor onboarding tour visibility — true when the localStorage flag is
  // absent (fresh browser / fresh laptop). Init lazily so SSR doesn't crash
  // on undefined window. super_admin doesn't see it.
  const [tourVisible, setTourVisible] = useState<boolean>(false);
  useEffect(() => {
    if (me.role !== 'editor') return;
    try {
      setTourVisible(localStorage.getItem(TOUR_DISMISS_KEY) !== '1');
    } catch {
      // Private mode / storage blocked — tour stays hidden, low cost
    }
  }, [me.role]);
  const dismissTour = () => {
    try {
      localStorage.setItem(TOUR_DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setTourVisible(false);
  };

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
    <section className="rounded-2xl border border-slate-200 bg-[var(--bg-surface)] p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-medium text-slate-600">{ui.adminProductsTitle}</h2>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="inline-flex items-center gap-1 rounded-full accent-bg text-white px-3 py-1.5 text-xs font-medium hover:brightness-110"
        >
          <Plus size={14} />
          {ui.adminAddProduct}
        </button>
      </div>

      {me.role === 'super_admin' && (
        <div className="mt-3 inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs">
          {(['all', 'mine', 'orphan'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={[
                'rounded-full px-3 py-1 transition-colors',
                filter === f
                  ? 'accent-bg text-white font-medium'
                  : 'text-slate-600 hover:text-slate-900',
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
        <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
          {ui.adminProductsEditorHint
            .replace('{my}', String(myCount))
            .replace('{platform}', String(platformCount))}
        </p>
      )}

      {/* Editor onboarding tour — first-time landing aid. Dismissed via the
          X button (localStorage flag, sticky per browser). super_admin sees
          the full panel toolset already and doesn't need this. */}
      {me.role === 'editor' && tourVisible && (
        <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="text-xs leading-relaxed">
              <p className="text-sm font-medium text-blue-100 mb-2">
                {ui.adminEditorTourTitle}
              </p>
              <ol className="list-decimal pl-4 space-y-1 text-slate-700">
                <li>{ui.adminEditorTourStep1}</li>
                <li>{ui.adminEditorTourStep2}</li>
                <li>{ui.adminEditorTourStep3}</li>
                <li>{ui.adminEditorTourStep4}</li>
              </ol>
            </div>
            <button
              type="button"
              onClick={dismissTour}
              aria-label={ui.adminEditorTourDismiss}
              title={ui.adminEditorTourDismiss}
              className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <ErrorBanner
        error={productsQuery.error ?? del.error ?? clone.error ?? upsert.error}
        lang={lang}
      />

      <ul className="mt-4 divide-y divide-slate-200">
        {visible.map((p) => {
          const mutable = canMutate(p);
          const platformRow = me.role === 'editor' && isPlatform(p);
          const isOpen = expanded.has(p.id);
          return (
            <li
              key={p.id}
              className={[
                'py-3',
                platformRow && 'opacity-70', // visually fade read-only reference rows
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {/* Header row — title + meta + actions */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{pickLang(p.name, lang)}</span>
                    <code className="text-[10px] text-slate-400">{p.id}</code>
                    <button
                      type="button"
                      onClick={() => onTogglePublish(p)}
                      disabled={!mutable || upsert.isPending}
                      className={[
                        'rounded-full px-2 py-0.5 text-[10px] transition-colors',
                        p.isParticipating
                          ? 'bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                          : 'bg-slate-50 text-slate-500 hover:bg-slate-100',
                        !mutable && 'cursor-not-allowed opacity-60',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {p.isParticipating ? 'on' : 'off'}
                    </button>
                    {me.role === 'super_admin' && (
                      <span className="rounded-full border border-slate-200 bg-slate-50/70 px-2 py-0.5 text-[10px] text-slate-500">
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
                            ? 'border-slate-200 bg-slate-50/70 text-slate-500'
                            : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
                        ].join(' ')}
                      >
                        {platformRow ? ui.adminProductBadgePlatform : ui.adminProductBadgeMine}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-1">
                    {pickLang(p.audience, lang)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {/* Expand chevron — toggle full-detail view inline. Always
                      shown (own + platform rows) since "see full info" is
                      always useful, even if you can't edit. */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(p.id)}
                    aria-label={isOpen ? ui.adminProductCollapse : ui.adminProductExpand}
                    title={isOpen ? ui.adminProductCollapse : ui.adminProductExpand}
                    aria-expanded={isOpen}
                    className="rounded-lg p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onClone(p)}
                    disabled={clone.isPending}
                    aria-label={ui.adminProductClone}
                    title={ui.adminProductClone}
                    className="rounded-lg p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(p)}
                    disabled={!mutable}
                    aria-label={ui.adminEditProduct}
                    className="rounded-lg p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(p)}
                    disabled={!mutable}
                    aria-label={ui.adminDeleteProduct}
                    className="rounded-lg p-2 text-slate-600 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Expanded detail block — current-lang only (lang switch at
                  page top changes what shows here). Read-only render; mutating
                  must go through the modal editor like before. */}
              {isOpen && (
                <div className="mt-3 ml-1 rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2.5 text-xs">
                  <div>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      {ui.adminFieldDescription}
                    </span>
                    <p className="mt-0.5 text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {pickLang(p.description, lang) || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      {ui.adminFieldAudience}
                    </span>
                    <p className="mt-0.5 text-slate-700 leading-relaxed">
                      {pickLang(p.audience, lang) || '—'}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {ALL_BRANDS.map((b) => {
                      const url = pickLang(p.url[b], lang) || '';
                      return (
                        <div key={b}>
                          <span className="text-[10px] uppercase tracking-wide text-slate-400">
                            {ui.adminFieldUrl} · {BRAND_LABEL[b]}
                          </span>
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-0.5 flex items-center gap-1 text-slate-700 hover:text-slate-900 truncate"
                              title={url}
                            >
                              <span className="truncate font-mono text-[11px]">{url}</span>
                              <ExternalLink size={10} className="shrink-0" />
                            </a>
                          ) : (
                            <p className="mt-0.5 text-slate-400">—</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {visible.length === 0 && !productsQuery.isLoading && (
          <li className="py-6 text-center text-sm text-slate-400">—</li>
        )}
      </ul>

      {editing !== undefined && (
        <ProductEditor lang={lang} initial={editing} onClose={() => setEditing(undefined)} />
      )}
    </section>
  );
}
