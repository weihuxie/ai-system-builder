import { ALL_LANGS, type Lang } from '@asb/shared';

import { useAppStore } from '../lib/store';
import { t } from '../lib/translations';

/**
 * 4-button pill row. Compact on mobile, inline on desktop.
 * Self-label each option in its own language (so a 日本語 user who lands on
 * zh-CN can still recognize "日本語").
 */
export default function LangSwitch() {
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const labels = t(lang).langLabels;

  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5 text-xs"
    >
      {ALL_LANGS.map((code) => {
        const active = code === lang;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code as Lang)}
            className={[
              'rounded-full px-3 py-1 transition-colors',
              active
                ? 'accent-bg text-black font-medium'
                : 'text-white/70 hover:text-white hover:bg-white/5',
            ].join(' ')}
            aria-pressed={active}
          >
            {labels[code]}
          </button>
        );
      })}
    </div>
  );
}
