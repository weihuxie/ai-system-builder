import { useEffect, useState } from 'react';
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

import { useUpsertProductMutation } from '../../lib/queries';
import { t } from '../../lib/translations';
import ErrorBanner from '../ErrorBanner';

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
 * Submission rule: when creating, ID is required + must be unique (server enforces PK).
 * When editing, ID is locked.
 */
export default function ProductEditor({ lang, initial, onClose }: Props) {
  const ui = t(lang);
  const [draft, setDraft] = useState<Draft>(toDraft(initial));
  const [editingLang, setEditingLang] = useState<Lang>(lang);
  const upsert = useUpsertProductMutation();
  const mode = initial ? 'update' : 'create';

  // Sync draft if parent swaps the `initial` product without remounting
  useEffect(() => {
    setDraft(toDraft(initial));
  }, [initial]);

  const submit = async () => {
    if (!draft.id.trim()) return;
    try {
      await upsert.mutateAsync({ mode, product: draft });
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

        {/* ID (locked in edit mode) */}
        <label className="mt-5 block text-xs text-white/60">{ui.adminFieldId}</label>
        <input
          type="text"
          value={draft.id}
          disabled={mode === 'update'}
          onChange={(e) => setDraft({ ...draft, id: e.target.value })}
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm disabled:opacity-60 outline-none focus:border-[var(--accent-muted)]"
        />

        {/* Lang tabs */}
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
        ).map(([field, label]) => (
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
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[var(--accent-muted)]"
              />
            )}
          </div>
        ))}

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

        <div className="mt-6 flex items-center justify-end gap-2">
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
            disabled={!draft.id.trim() || upsert.isPending}
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
