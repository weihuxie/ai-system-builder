import { motion } from 'motion/react';

import { DEFAULT_QUICK_OPTIONS } from '@asb/shared';

import { useAppStore } from '../lib/store';
import { t } from '../lib/translations';

/**
 * 4 clickable scenario cards. Click → compose template string into the
 * textarea (via store.setUserInput). Scroll/focus handling lives in parent.
 */
export default function QuickScenarios({ onPick }: { onPick?: () => void }) {
  const lang = useAppStore((s) => s.lang);
  const setUserInput = useAppStore((s) => s.setUserInput);
  const resetForNewQuery = useAppStore((s) => s.resetForNewQuery);
  const ui = t(lang);
  const options = DEFAULT_QUICK_OPTIONS[lang];

  return (
    <section className="mt-6">
      <h2 className="text-sm font-medium text-white/70 mb-3">{ui.quickScenariosTitle}</h2>
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
    </section>
  );
}
