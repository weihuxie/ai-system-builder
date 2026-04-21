import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';

import { DEFAULT_QUICK_OPTIONS } from '@asb/shared';

import { useAppStore } from '../lib/store';
import { t } from '../lib/translations';

export default function QuickScenarios({ onPick }: { onPick?: () => void }) {
  const lang = useAppStore((s) => s.lang);
  const setUserInput = useAppStore((s) => s.setUserInput);
  const resetForNewQuery = useAppStore((s) => s.resetForNewQuery);
  const solution = useAppStore((s) => s.solution);
  const ui = t(lang);
  const options = DEFAULT_QUICK_OPTIONS[lang];

  // Auto-collapse once a recommendation is on screen so the 3 result cards
  // stay above the fold. User can still click the header to re-expand.
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    setExpanded(!solution);
  }, [solution]);

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-white/70 hover:text-white transition-colors mb-3"
        aria-expanded={expanded}
      >
        <span>{ui.quickScenariosTitle}</span>
        <ChevronDown
          size={14}
          className={`transition-transform ${expanded ? '' : '-rotate-90'}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="grid"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {options.map((opt, i) => (
                <motion.button
                  type="button"
                  key={`${opt.role}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -2 }}
                  onClick={() => {
                    setUserInput(ui.quickScenarioTemplate(opt.role, opt.industry, opt.challenge));
                    resetForNewQuery();
                    onPick?.();
                  }}
                  className="text-left rounded-xl border border-white/10 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] p-4 transition-colors"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="accent-text text-xs font-semibold uppercase tracking-wide">
                      {opt.industry}
                    </span>
                    <span className="text-xs text-white/40">·</span>
                    <span className="text-xs text-white/60">{opt.role}</span>
                  </div>
                  <p className="mt-2 text-sm text-white/80 leading-relaxed line-clamp-4">
                    {opt.challenge}
                  </p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
