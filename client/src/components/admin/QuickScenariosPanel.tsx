import { useEffect, useState } from 'react';
import { Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react';

import { ALL_LANGS, DEFAULT_QUICK_OPTIONS, type Lang, type QuickOption } from '@asb/shared';

import { useQuickScenariosQuery, useUpdateQuickScenariosMutation } from '../../lib/queries';
import { useAppStore } from '../../lib/store';
import { t } from '../../lib/translations';
import ErrorBanner from '../ErrorBanner';

const LANG_LABEL: Record<Lang, string> = {
  'zh-CN': '简中',
  'zh-HK': '繁中',
  en: 'EN',
  ja: '日本語',
};

/**
 * super_admin-only panel for editing the homepage Quick Scenarios.
 *
 * Why exists: Summit lecturer falls back to clicking these when the venue is
 * too noisy / network too flaky for STT. They double as the demo flow's
 * golden path so making them editable in-the-field saves a redeploy when a
 * given venue's audience needs different wording.
 *
 * Storage: global_config.quick_scenarios jsonb (migration 0004). null in DB
 * means "use bundled DEFAULT_QUICK_OPTIONS" — the GET endpoint already does
 * the per-lang fallback merging, so what arrives in the form is always a
 * full Record<Lang, QuickOption[]>.
 */
export default function QuickScenariosPanel() {
  const lang = useAppStore((s) => s.lang);
  const ui = t(lang);
  const query = useQuickScenariosQuery();
  const update = useUpdateQuickScenariosMutation();

  const [editing, setEditing] = useState<Lang>(lang);
  // Local draft so edits don't fire the network on every keystroke.
  // Save button writes the whole bag back.
  const [draft, setDraft] = useState<Record<Lang, QuickOption[]>>(
    query.data?.scenarios ?? DEFAULT_QUICK_OPTIONS,
  );
  // Track if the local draft has diverged from server state — controls Save
  // button enable + a "unsaved changes" hint.
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (query.data?.scenarios) {
      setDraft(query.data.scenarios);
      setDirty(false);
    }
  }, [query.data?.scenarios]);

  const updateOne = (i: number, patch: Partial<QuickOption>) => {
    setDraft((prev) => ({
      ...prev,
      [editing]: prev[editing].map((o, idx) => (idx === i ? { ...o, ...patch } : o)),
    }));
    setDirty(true);
  };

  const removeOne = (i: number) => {
    setDraft((prev) => ({
      ...prev,
      [editing]: prev[editing].filter((_, idx) => idx !== i),
    }));
    setDirty(true);
  };

  const addOne = () => {
    setDraft((prev) => ({
      ...prev,
      [editing]: [...prev[editing], { role: '', industry: '', challenge: '' }],
    }));
    setDirty(true);
  };

  const save = async () => {
    // Strip out incomplete rows — empty role/industry/challenge are user
    // accidents (added a row, didn't fill). Saving them would clutter the
    // homepage with blank cards.
    const cleaned: Record<Lang, QuickOption[]> = {
      'zh-CN': draft['zh-CN'].filter((o) => o.role.trim() && o.industry.trim() && o.challenge.trim()),
      'zh-HK': draft['zh-HK'].filter((o) => o.role.trim() && o.industry.trim() && o.challenge.trim()),
      en: draft.en.filter((o) => o.role.trim() && o.industry.trim() && o.challenge.trim()),
      ja: draft.ja.filter((o) => o.role.trim() && o.industry.trim() && o.challenge.trim()),
    };
    await update.mutateAsync({ scenarios: cleaned });
    setDirty(false);
  };

  const reset = async () => {
    if (!window.confirm(ui.adminQuickScenariosResetConfirm)) return;
    await update.mutateAsync({ reset: true });
    setDirty(false);
  };

  const list = draft[editing];

  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-white/70">{ui.adminQuickScenariosTitle}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={update.isPending}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-40"
            title={ui.adminQuickScenariosReset}
          >
            <RotateCcw size={12} />
            {ui.adminQuickScenariosReset}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || update.isPending}
            className="inline-flex items-center gap-2 rounded-full accent-bg text-black px-4 py-1.5 text-xs font-medium disabled:opacity-40 hover:brightness-110"
          >
            {update.isPending && <Loader2 size={12} className="animate-spin" />}
            {ui.adminSave}
          </button>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-white/40 leading-relaxed">
        {ui.adminQuickScenariosHint}
      </p>

      {/* Lang tabs — same pattern as ProductEditor for muscle memory */}
      <div className="mt-3 inline-flex rounded-full border border-white/10 bg-white/5 p-0.5 text-xs">
        {ALL_LANGS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setEditing(l)}
            className={[
              'rounded-full px-3 py-1 transition-colors',
              l === editing
                ? 'accent-bg text-black font-medium'
                : 'text-white/70 hover:text-white',
            ].join(' ')}
          >
            {LANG_LABEL[l]} <span className="opacity-60">· {draft[l].length}</span>
          </button>
        ))}
      </div>

      {dirty && (
        <p className="mt-3 text-[11px] text-amber-300/80">
          {ui.adminQuickScenariosUnsaved}
        </p>
      )}

      <ErrorBanner
        error={query.error ?? update.error}
        lang={lang}
        onDismiss={() => update.reset()}
      />

      {/* Scenarios list — one row per scenario with 3 inputs (role/industry/challenge) + delete */}
      <ul className="mt-4 space-y-3">
        {list.map((opt, i) => (
          <li
            key={i}
            className="rounded-xl border border-white/5 bg-white/[0.02] p-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-white/40">
                  {ui.adminQuickScenariosFieldRole}
                </label>
                <input
                  type="text"
                  value={opt.role}
                  onChange={(e) => updateOne(i, { role: e.target.value })}
                  placeholder={ui.adminQuickScenariosFieldRolePlaceholder}
                  className="mt-0.5 w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent-muted)]"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-white/40">
                  {ui.adminQuickScenariosFieldIndustry}
                </label>
                <input
                  type="text"
                  value={opt.industry}
                  onChange={(e) => updateOne(i, { industry: e.target.value })}
                  placeholder={ui.adminQuickScenariosFieldIndustryPlaceholder}
                  className="mt-0.5 w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent-muted)]"
                />
              </div>
            </div>
            <div className="mt-2">
              <label className="block text-[10px] uppercase tracking-wide text-white/40">
                {ui.adminQuickScenariosFieldChallenge}
              </label>
              <textarea
                rows={2}
                value={opt.challenge}
                onChange={(e) => updateOne(i, { challenge: e.target.value })}
                placeholder={ui.adminQuickScenariosFieldChallengePlaceholder}
                className="mt-0.5 w-full resize-y rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent-muted)]"
              />
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => removeOne(i)}
                aria-label="delete"
                className="inline-flex items-center gap-1 rounded-md p-1.5 text-white/50 hover:bg-red-500/10 hover:text-red-300 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </li>
        ))}

        {list.length === 0 && (
          <li className="py-4 text-center text-xs text-white/40">
            {ui.adminQuickScenariosEmpty}
          </li>
        )}

        <li>
          <button
            type="button"
            onClick={addOne}
            disabled={list.length >= 20}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/60 hover:bg-white/5 hover:text-white/80 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={12} />
            {ui.adminQuickScenariosAdd}
            {list.length >= 20 && (
              <span className="text-white/40">· {ui.adminQuickScenariosMaxReached}</span>
            )}
          </button>
        </li>
      </ul>
    </section>
  );
}
