import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';

import {
  ALL_BRANDS,
  ALL_LANGS,
  type Brand,
  type BrandLangMap,
  type Lang,
  type LangMap,
  type ProductItem,
} from '@asb/shared';

import { useAdminProductsQuery, useUpsertProductMutation } from '../../lib/queries';
import { t } from '../../lib/translations';
import ErrorBanner from '../ErrorBanner';

// ───────────────────────────────────────────
// suggestId: derive an internal short code from the English product name.
// Editors no longer see "ID" as a separate concept — they fill the name in
// 4 langs, and we extract a short code from name.en at save time. The code
// becomes products.id (PK) and is what AI prompts / golden eval / logs
// reference. This tradeoff keeps the AI prompt token-efficient and trace
// human-readable while removing the "what's an ID?" cognitive burden.
//
// Heuristics, in priority order:
//   1. Parenthesized ALL-CAPS acronym wins:
//      "Customer Relationship Management (CRM)" → "CRM"
//   2. Multi-word: initials, uppercased: "Order Management System" → "OMS"
//   3. Single word: capitalized + truncated: "Settlement" → "Settlement"
//   4. No English letters → '' (caller blocks save with a "fill EN name" hint)
//
// Two products with name.en yielding the same suggestId collide on PK and
// the save fails — callers should compute the collision against existing
// IDs and surface a "rename to differentiate" hint inline before submit.
// ───────────────────────────────────────────
export function suggestId(enName: string): string {
  if (!enName) return '';
  const trimmed = enName.trim();
  const paren = trimmed.match(/\(([A-Z]{2,8})\)/);
  if (paren?.[1]) return paren[1];
  const cleaned = trimmed.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const words = cleaned.split(' ').filter((w) => w.length > 0);
  if (words.length === 0) return '';
  if (words.length >= 2) {
    return words.slice(0, 6).map((w) => w.charAt(0).toUpperCase()).join('');
  }
  const w = words[0]!;
  return w.charAt(0).toUpperCase() + w.slice(1, 12).toLowerCase();
}

// ownerEmail is server-computed (left-join); Draft never carries it.
// ownerId defaults to null on create — server sets it to the current user for
// editors, or accepts an explicit value from super_admin.
type Draft = Omit<ProductItem, 'createdAt' | 'updatedAt' | 'ownerEmail'>;

function emptyLangMap(): LangMap {
  return { 'zh-CN': '', 'zh-HK': '', en: '', ja: '' };
}
function emptyBrandLangMap(): BrandLangMap {
  return { google: emptyLangMap(), aws: emptyLangMap() };
}
function toDraft(p?: ProductItem | null): Draft {
  if (!p) {
    return {
      id: '',
      name: emptyLangMap(),
      description: emptyLangMap(),
      audience: emptyLangMap(),
      url: emptyBrandLangMap(),
      isParticipating: true,
      ownerId: null,
    };
  }
  const { createdAt: _c, updatedAt: _u, ownerEmail: _oe, ...rest } = p;
  return rest;
}

const LANG_LABEL: Record<Lang, string> = {
  'zh-CN': '简中',
  'zh-HK': '繁中',
  en: 'EN',
  ja: '日本語',
};
const BRAND_LABEL: Record<Brand, string> = { google: 'Google', aws: 'AWS' };

interface Props {
  lang: Lang;
  /** null = create mode, ProductItem = edit mode */
  initial: ProductItem | null;
  onClose: () => void;
}

/**
 * Modal editor for create / edit. Uses a tabbed language editor so the admin
 * doesn't face 4 copies of name/description/audience inline at once.
 *
 * Identity model: the English name (name.en) is the user-facing identifier.
 * On create, the system silently derives a short code (products.id PK) from
 * name.en via suggestId. Editors never see "ID" in the UI. On edit, the
 * existing PK is locked and only the displayed names/descriptions can change.
 */
export default function ProductEditor({ lang, initial, onClose }: Props) {
  const ui = t(lang);
  const [draft, setDraft] = useState<Draft>(toDraft(initial));
  const [editingLang, setEditingLang] = useState<Lang>(lang);
  const upsert = useUpsertProductMutation();
  const mode = initial ? 'update' : 'create';

  // Existing IDs for collision validation. Hits the same react-query cache as
  // ProductList so no extra network request.
  const productsQuery = useAdminProductsQuery(true);
  const existingIds = useMemo(() => {
    const ids = new Set((productsQuery.data ?? []).map((p) => p.id));
    // In edit mode, the current product's own ID is allowed (locked anyway).
    if (initial) ids.delete(initial.id);
    return ids;
  }, [productsQuery.data, initial]);

  // Save-blockers in create mode:
  //   - name.en empty       → can't derive a code, server PK would be empty
  //   - derived code clashes → would 409 on insert; show inline hint pre-flight
  const enName = draft.name.en.trim();
  const derivedId = mode === 'create' ? suggestId(enName) : draft.id;
  const enNameMissing = mode === 'create' && enName === '';
  const idCollision =
    mode === 'create' && derivedId !== '' && existingIds.has(derivedId);

  // Sync draft if parent swaps the `initial` product without remounting
  useEffect(() => {
    setDraft(toDraft(initial));
  }, [initial]);

  const submit = async () => {
    if (enNameMissing || idCollision || upsert.isPending) return;
    // Stamp the derived id onto the draft right before submit so server
    // gets the canonical short code as PK.
    const product = mode === 'create' ? { ...draft, id: derivedId } : draft;
    if (!product.id.trim()) return;
    try {
      await upsert.mutateAsync({ mode, product });
      onClose();
    } catch {
      // banner
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-6 my-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {mode === 'create' ? ui.adminAddProduct : ui.adminEditProduct}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-white/60 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Lang tabs (no separate ID field — identity = name.en, derived at save) */}
        <div className="mt-5 inline-flex rounded-full border border-white/10 bg-white/5 p-0.5 text-xs">
          {ALL_LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setEditingLang(l)}
              className={[
                'rounded-full px-3 py-1 transition-colors',
                l === editingLang
                  ? 'accent-bg text-black font-medium'
                  : 'text-white/70 hover:text-white',
              ].join(' ')}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>

        {/* Name / Description / Audience — one lang at a time */}
        {(
          [
            ['name', ui.adminFieldName] as const,
            ['description', ui.adminFieldDescription] as const,
            ['audience', ui.adminFieldAudience] as const,
          ]
        ).map(([field, label]) => {
          const showNameMeta =
            field === 'name' && editingLang === 'en' && mode === 'create';
          return (
            <div key={field} className="mt-4">
              <label className="block text-xs text-white/60">{label}</label>
              {field === 'description' ? (
                <textarea
                  rows={3}
                  value={draft[field][editingLang]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [field]: { ...draft[field], [editingLang]: e.target.value },
                    })
                  }
                  className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[var(--accent-muted)]"
                />
              ) : (
                <input
                  type="text"
                  value={draft[field][editingLang]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [field]: { ...draft[field], [editingLang]: e.target.value },
                    })
                  }
                  placeholder={showNameMeta ? 'Customer Relationship Management' : undefined}
                  className={[
                    'mt-1 w-full rounded-lg border bg-white/5 px-3 py-2 text-sm outline-none transition-colors',
                    showNameMeta && idCollision
                      ? 'border-red-500/50 focus:border-red-500/70'
                      : 'border-white/10 focus:border-[var(--accent-muted)]',
                  ].join(' ')}
                />
              )}

              {/* Inline meta under the English name input on create:
                  - shows the auto-derived code (so editor sees what their
                    name produces under the hood, no surprise on save)
                  - flips to red collision warning if that code already exists */}
              {showNameMeta && (
                <p
                  className={[
                    'mt-1 text-[11px] leading-relaxed',
                    idCollision ? 'text-red-300' : 'text-white/40',
                  ].join(' ')}
                >
                  {idCollision
                    ? ui.adminFieldEnNameCollision.replace('{id}', derivedId)
                    : derivedId
                      ? ui.adminFieldEnNameHint.replace('{id}', derivedId)
                      : ui.adminFieldEnNameHintEmpty}
                </p>
              )}
            </div>
          );
        })}

        {/* URL per brand × lang — shares the lang tab above, so switching the tab
            shows this lang's two brand URLs. Fallback logic (pickBrandLang) lets
            you leave a slot empty; the runtime will show brand.en then google.en. */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ALL_BRANDS.map((b) => (
            <div key={b}>
              <label className="block text-xs text-white/60">
                {ui.adminFieldUrl} — {BRAND_LABEL[b]} · {LANG_LABEL[editingLang]}
              </label>
              <input
                type="url"
                value={draft.url[b][editingLang]}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    url: {
                      ...draft.url,
                      [b]: { ...draft.url[b], [editingLang]: e.target.value },
                    },
                  })
                }
                placeholder="https://…"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[var(--accent-muted)]"
              />
            </div>
          ))}
        </div>

        {/* Participating toggle */}
        <label className="mt-5 flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.isParticipating}
            onChange={(e) => setDraft({ ...draft, isParticipating: e.target.checked })}
            className="accent-[var(--accent)]"
          />
          <span className="text-sm">{ui.adminFieldParticipating}</span>
        </label>

        <ErrorBanner error={upsert.error} lang={lang} onDismiss={() => upsert.reset()} />

        <div className="mt-6 flex items-center justify-end gap-3">
          {/* Save-blockers surface here for the case where the editor never
              opened the EN tab — the inline hint under EN name wouldn't be
              visible, so we mirror it next to the save button. */}
          {enNameMissing && (
            <p className="text-[11px] text-amber-300/80 leading-relaxed">
              {ui.adminFieldEnNameRequired}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            {ui.adminCancel}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={enNameMissing || idCollision || upsert.isPending}
            className="inline-flex items-center gap-2 rounded-full accent-bg text-black px-4 py-2 text-sm font-medium disabled:opacity-40 hover:brightness-110"
          >
            {upsert.isPending && <Loader2 size={16} className="animate-spin" />}
            {ui.adminSave}
          </button>
        </div>
      </div>
    </div>
  );
}
