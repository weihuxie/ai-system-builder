import { useEffect, useRef, useState } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';

import {
  ALL_LLM_PROVIDERS,
  DEFAULT_LLM_CHAIN,
  LLM_MODEL_PRESETS,
  type LlmChain,
  type LlmChainItem,
  type LlmProviderId,
} from '@asb/shared';

import { useLlmChainQuery, useSetLlmChainMutation } from '../../lib/queries';
import ErrorBanner from '../ErrorBanner';
import { useAppStore } from '../../lib/store';

/**
 * Admin panel: configure the LLM fallback chain.
 * - Drag-to-reorder via HTML5 DnD (no library deps)
 * - Per-row: provider picker, model dropdown (preset list + custom input), enabled toggle
 * - Temperature slider affects all providers
 * - Save button writes to DB; /api/generate reads fresh value per request
 * - Shows a warning tag when a provider has no API key in server env
 */
export default function LlmChainConfig() {
  const lang = useAppStore((s) => s.lang);
  const query = useLlmChainQuery();
  const mutation = useSetLlmChainMutation();

  const [localChain, setLocalChain] = useState<LlmChain>([]);
  const [localTemp, setLocalTemp] = useState<number>(0.7);
  const dragIndexRef = useRef<number | null>(null);

  // Sync server → local when loaded / refetched
  useEffect(() => {
    if (query.data) {
      setLocalChain(query.data.chain);
      setLocalTemp(query.data.temperature);
    }
  }, [query.data]);

  if (query.isLoading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-[var(--bg-surface)] p-5">
        <div className="text-sm text-slate-500">加载中…</div>
      </section>
    );
  }
  if (query.error) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-[var(--bg-surface)] p-5">
        <ErrorBanner error={query.error} lang={lang} onDismiss={() => query.refetch()} />
      </section>
    );
  }

  const configured = query.data?.configured ?? { gemini: false, kimi: false, deepseek: false };

  const updateRow = (idx: number, patch: Partial<LlmChainItem>) => {
    setLocalChain((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeRow = (idx: number) => setLocalChain((prev) => prev.filter((_, i) => i !== idx));
  const addRow = () =>
    setLocalChain((prev) => [
      ...prev,
      { providerId: 'gemini', model: LLM_MODEL_PRESETS.gemini[0] ?? 'gemini-2.5-flash', enabled: true },
    ]);
  const resetDefaults = () => setLocalChain(DEFAULT_LLM_CHAIN);

  const handleDragStart = (idx: number) => {
    dragIndexRef.current = idx;
  };
  const handleDragOver = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
  };
  const handleDrop = (idx: number) => {
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from === null || from === idx) return;
    setLocalChain((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      if (!moved) return prev;
      next.splice(idx, 0, moved);
      return next;
    });
  };

  const save = () => mutation.mutate({ chain: localChain, temperature: localTemp });

  const initial = query.data;
  const dirty =
    !!initial &&
    (JSON.stringify(initial.chain) !== JSON.stringify(localChain) ||
      initial.temperature !== localTemp);

  return (
    <section className="rounded-2xl border border-slate-200 bg-[var(--bg-surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-slate-600">AI 模型链</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetDefaults}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            恢复默认
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || mutation.isPending}
            className="rounded-full accent-bg px-4 py-1.5 text-sm font-medium text-black disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? '保存中…' : '保存'}
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        从上到下依次尝试，前一个失败（配额/超载）自动切到下一个。拖拽 <GripVertical className="inline" size={12}/> 调整顺序。
      </p>

      <ul className="flex flex-col gap-2">
        {localChain.map((item, idx) => {
          const presets = LLM_MODEL_PRESETS[item.providerId];
          const hasKey = configured[item.providerId];
          const datalistId = `models-${item.providerId}-${idx}`;
          return (
            <li
              key={idx}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(idx)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5"
            >
              <GripVertical size={14} className="text-slate-400 cursor-grab shrink-0" />
              <span className="text-xs text-slate-400 w-4 shrink-0">{idx + 1}</span>

              <select
                value={item.providerId}
                onChange={(e) =>
                  updateRow(idx, {
                    providerId: e.target.value as LlmProviderId,
                    model: LLM_MODEL_PRESETS[e.target.value as LlmProviderId][0] ?? item.model,
                  })
                }
                className="bg-transparent border border-slate-200 rounded-md px-2 py-1 text-sm text-slate-700 focus:outline-none focus:border-[var(--accent-muted)]"
              >
                {ALL_LLM_PROVIDERS.map((p) => (
                  <option key={p} value={p} className="bg-[var(--bg-surface)]">
                    {p}
                  </option>
                ))}
              </select>

              <input
                type="text"
                list={datalistId}
                value={item.model}
                onChange={(e) => updateRow(idx, { model: e.target.value })}
                placeholder="model ID"
                spellCheck={false}
                autoCapitalize="off"
                className="bg-transparent border border-slate-200 rounded-md px-2 py-1 text-sm text-slate-700 focus:outline-none focus:border-[var(--accent-muted)] flex-1 min-w-0 font-mono"
              />
              <datalist id={datalistId}>
                {presets.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>

              {!hasKey && (
                <span
                  title={`${item.providerId.toUpperCase()}_API_KEY 未配置`}
                  className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/30"
                >
                  无密钥
                </span>
              )}

              <label className="inline-flex items-center gap-1.5 cursor-pointer ml-1">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) => updateRow(idx, { enabled: e.target.checked })}
                  className="accent-[color:var(--accent)]"
                />
                <span className="text-xs text-slate-500">启用</span>
              </label>

              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="text-slate-400 hover:text-red-400 p-1"
                aria-label="remove"
              >
                <Trash2 size={14} />
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={addRow}
        className="mt-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <Plus size={14} />
        添加一项
      </button>

      <div className="mt-5 pt-4 border-t border-slate-200">
        <label className="flex items-center gap-3 text-sm text-slate-600">
          <span className="w-20 shrink-0">Temperature</span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={localTemp}
            onChange={(e) => setLocalTemp(Number(e.target.value))}
            className="flex-1 accent-[color:var(--accent)]"
          />
          <span className="w-10 text-right tabular-nums text-slate-500">{localTemp.toFixed(1)}</span>
        </label>
      </div>

      <ErrorBanner error={mutation.error} lang={lang} onDismiss={() => mutation.reset()} />
    </section>
  );
}
