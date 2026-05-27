import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Copy, ExternalLink, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { ALL_BRANDS, pickLang, type AuthedUser, type Brand, type ProductItem } from '@asb/shared';

import {
  useAdminProductsQuery,
  useCloneProductMutation,
  useDeletedProductsQuery,
  useDeleteProductMutation,
  useRestoreProductMutation,
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

const BRAND_LABEL: Record<Brand, string> = { google: 'Google', aws: 'AWS', huawei: 'Huawei' };

// 4 互斥子集 + All（superset）。语义诚实：Mine + Platform + Others = All
// （super_admin 视角下 mine 和 others 都是 "ownerId 不为 NULL" 的子集，
// 只是看是不是自己）。Mine 排第一（最常用），All 排最后（reset 作用）。
// 4 互斥子集 + All + 回收站。trash 单独走 deleted query，跟前 5 个 live
// 子集语义独立（trash = deleted_at IS NOT NULL）。
type Filter = 'mine' | 'platform' | 'others' | 'all' | 'trash';

export default function ProductList({ me }: { me: AuthedUser }) {
  const lang = useAppStore((s) => s.lang);
  const ui = t(lang);

  // Admin-scoped query (server enforces: editor → only own rows; super_admin → all).
  // Editor can no longer see siblings' products even via raw Network response.
  const productsQuery = useAdminProductsQuery(true);
  const deletedQuery = useDeletedProductsQuery(true); // 回收站
  const del = useDeleteProductMutation();
  const restore = useRestoreProductMutation();
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
  const deleted = deletedQuery.data ?? [];
  const isTrash = filter === 'trash';

  // For editor: server returns own + platform (ownerId=null). Sort own to top
  // so the editor always sees their work first, then the read-only reference
  // catalog below. For super_admin: retain mine/all/orphan filter triage.
  // filter='trash' (both roles): show the recycle bin (deletedQuery data).
  const visible = useMemo(() => {
    if (isTrash) {
      // 回收站按 id 排，editor 只看到自己的（server 已按 role 过滤 deleted query）
      return [...deleted].sort((a, b) => a.id.localeCompare(b.id));
    }
    if (me.role === 'editor') {
      return [...all].sort((a, b) => {
        const aMine = a.ownerId === me.id ? 0 : 1;
        const bMine = b.ownerId === me.id ? 0 : 1;
        if (aMine !== bMine) return aMine - bMine;
        return a.id.localeCompare(b.id);
      });
    }
    if (filter === 'mine') return all.filter((p) => p.ownerId === me.id);
    if (filter === 'platform') return all.filter((p) => p.ownerId === null);
    if (filter === 'others') return all.filter((p) => p.ownerId !== null && p.ownerId !== me.id);
    return all;
  }, [all, deleted, isTrash, filter, me.id, me.role]);

  // 给 super_admin 在 chip 上展示 bucket 实时计数 + 回收站计数。
  const counts = useMemo(() => {
    if (me.role !== 'super_admin') return { mine: 0, platform: 0, others: 0, all: 0, trash: deleted.length };
    return {
      mine: all.filter((p) => p.ownerId === me.id).length,
      platform: all.filter((p) => p.ownerId === null).length,
      others: all.filter((p) => p.ownerId !== null && p.ownerId !== me.id).length,
      all: all.length,
      trash: deleted.length,
    };
  }, [all, deleted, me.id, me.role]);

  const canMutate = (p: ProductItem) => me.role === 'super_admin' || p.ownerId === me.id;
  const isPlatform = (p: ProductItem) => p.ownerId === null;
  const myCount = me.role === 'editor' ? all.filter((p) => p.ownerId === me.id).length : 0;
  const platformCount = me.role === 'editor' ? all.filter((p) => p.ownerId === null).length : 0;

  // 撤销恢复 — 给 toast action 和回收站「恢复」按钮共用
  const onRestore = async (p: ProductItem) => {
    try {
      await restore.mutateAsync(p.id);
      toast.success(ui.adminProductRestored, { description: pickLang(p.name, lang) });
    } catch {
      // ErrorBanner surfaces restore.error
    }
  };

  // 软删除 + 撤销 toast（A+B 协同）。删除不再弹 window.confirm —— 改成乐观软删
  // + sonner toast 带「撤销」action。撤销 = restore 调用（数据没真丢，软删而已）。
  // 即使错过 toast 窗口，回收站还能恢复，双保险。
  const onDelete = async (p: ProductItem) => {
    try {
      await del.mutateAsync(p.id);
      toast.success(ui.adminProductDeleted.replace('{name}', pickLang(p.name, lang)), {
        duration: 8000,
        action: {
          label: ui.adminUndo,
          onClick: () => {
            void onRestore(p);
          },
        },
      });
    } catch {
      // ErrorBanner surfaces del.error
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
          {(['mine', 'platform', 'others', 'all', 'trash'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              data-testid={`product-filter-${f}`}
              data-active={filter === f}
              className={[
                'rounded-full px-3 py-1 transition-colors',
                filter === f
                  ? 'accent-bg text-white font-medium'
                  : 'text-slate-600 hover:text-slate-900',
              ].join(' ')}
            >
              {f === 'mine'
                ? `${ui.adminProductFilterMine} (${counts.mine})`
                : f === 'platform'
                  ? `${ui.adminProductBadgePlatform} (${counts.platform})`
                  : f === 'others'
                    ? `${ui.adminProductFilterOthers} (${counts.others})`
                    : f === 'all'
                      ? `${ui.adminProductFilterAll} (${counts.all})`
                      : `${ui.adminProductFilterTrash} (${counts.trash})`}
            </button>
          ))}
        </div>
      )}

      {/* Editor 回收站入口 — 只在有软删除产品时出现（避免空 panel 多个按钮）。
          editor 没有 super_admin 那排 chip，所以单独给个 toggle。 */}
      {me.role === 'editor' && deleted.length > 0 && (
        <div className="mt-3 inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setFilter(filter === 'trash' ? 'mine' : 'trash')}
            data-testid="product-filter-trash"
            data-active={isTrash}
            className={[
              'rounded-full px-3 py-1 transition-colors',
              isTrash ? 'accent-bg text-white font-medium' : 'text-slate-600 hover:text-slate-900',
            ].join(' ')}
          >
            {isTrash
              ? `← ${ui.adminProductFilterMine}`
              : `${ui.adminProductFilterTrash} (${deleted.length})`}
          </button>
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
              data-testid="product-row"
              data-product-id={p.id}
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
                      <span
                        data-testid="product-owner-badge"
                        data-owner={p.ownerId === null ? 'platform' : p.ownerEmail ?? 'unknown'}
                        className="rounded-full border border-slate-200 bg-slate-50/70 px-2 py-0.5 text-[10px] text-slate-500"
                      >
                        {p.ownerEmail ?? ui.adminProductBadgePlatform}
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
                  {/* 回收站行：只给「恢复」；否则给 clone/edit/delete */}
                  {isTrash ? (
                    <button
                      type="button"
                      onClick={() => onRestore(p)}
                      disabled={!mutable || restore.isPending}
                      data-testid="product-restore"
                      aria-label={ui.adminProductRestore}
                      title={ui.adminProductRestore}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <RotateCcw size={14} />
                      {ui.adminProductRestore}
                    </button>
                  ) : (
                    <>
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
                        data-testid="product-delete"
                        aria-label={ui.adminDeleteProduct}
                        className="rounded-lg p-2 text-slate-600 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
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
