import { forwardRef, useRef } from 'react';
import { Loader2, Send } from 'lucide-react';

import { useGenerateMutation } from '../lib/queries';
import { useAppStore } from '../lib/store';
import { t } from '../lib/translations';
import ErrorBanner from './ErrorBanner';
import MicButton from './MicButton';

/**
 * Textarea + mic + submit, plus inline error banner for the generate call.
 * Textarea value is bound to store.userInput so QuickScenarios and MicButton
 * can write into it without prop-drilling refs.
 *
 * Exposes a ref (via forwardRef) so parent can focus() after a quick-scenario pick.
 */
const InputArea = forwardRef<HTMLTextAreaElement>(function InputArea(_, externalRef) {
  const lang = useAppStore((s) => s.lang);
  const userInput = useAppStore((s) => s.userInput);
  const setUserInput = useAppStore((s) => s.setUserInput);
  const setSolution = useAppStore((s) => s.setSolution);
  const setIsGenerating = useAppStore((s) => s.setIsGenerating);
  const resetForNewQuery = useAppStore((s) => s.resetForNewQuery);
  const ui = t(lang);

  const gen = useGenerateMutation();
  const localRef = useRef<HTMLTextAreaElement | null>(null);

  const submit = async () => {
    const input = userInput.trim();
    if (!input || gen.isPending) return;
    // resetForNewQuery clears solution; flip isGenerating on so RecommendationGrid
    // immediately renders 3 skeleton cards + rotating status text. The audience
    // sees activity instead of blank space during the 2-4s LLM call.
    resetForNewQuery();
    setIsGenerating(true);
    try {
      const resp = await gen.mutateAsync({ userInput: input, lang });
      // Pass the whole response (incl. provider/model/latencyMs meta) into the
      // store so RecommendationGrid can label the result with the actual model.
      setSolution(resp);
    } catch {
      // banner will render via gen.error
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="mt-6">
      <div className="rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-4 focus-within:border-[var(--accent-muted)] transition-colors">
        <textarea
          ref={(el) => {
            localRef.current = el;
            if (typeof externalRef === 'function') externalRef(el);
            else if (externalRef) externalRef.current = el;
          }}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder={ui.inputPlaceholder}
          rows={4}
          maxLength={2000}
          className="w-full resize-none bg-transparent outline-none text-sm sm:text-base leading-relaxed placeholder:text-white/40"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-white/50 hidden sm:block">{ui.inputHint}</p>
          <div className="flex items-center gap-2 ml-auto">
            <MicButton />
            <button
              type="button"
              onClick={submit}
              disabled={!userInput.trim() || gen.isPending}
              className="inline-flex items-center gap-2 rounded-full accent-bg text-black px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
            >
              {gen.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              <span>{gen.isPending ? ui.generating : ui.generateButton}</span>
            </button>
          </div>
        </div>
      </div>
      <ErrorBanner
        error={gen.error}
        lang={lang}
        onRetry={() => {
          gen.reset();
          void submit();
        }}
        onDismiss={() => gen.reset()}
      />
    </section>
  );
});

export default InputArea;
