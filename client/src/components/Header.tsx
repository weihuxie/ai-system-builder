import { pickLang } from '@asb/shared';

import { useAppStore } from '../lib/store';
import { THEMES } from '../lib/themes';
import LangSwitch from './LangSwitch';

/**
 * Top bar: brand title (brand-driven) + lang switcher.
 * Brand-switch lives in /admin — users can't flip it from here.
 */
export default function Header() {
  const lang = useAppStore((s) => s.lang);
  const brand = useAppStore((s) => s.brand);
  const theme = THEMES[brand];

  return (
    <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-base)]/80 border-b border-[var(--border-subtle)]">
      <div className="mx-auto max-w-6xl flex items-center justify-between gap-4 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={theme.logoUrl}
            alt="HAND"
            data-brand-logo={brand}
            className="h-10 sm:h-12 w-auto max-w-[180px] shrink-0 object-contain"
          />
          <h1 className="truncate text-sm sm:text-base font-semibold tracking-tight">
            {pickLang(theme.headerTitle, lang)}
          </h1>
        </div>
        <LangSwitch />
      </div>
    </header>
  );
}
