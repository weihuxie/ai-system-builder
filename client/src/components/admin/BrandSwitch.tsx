import { ALL_BRANDS, type Brand } from '@asb/shared';

import { useBrandQuery, useSetBrandMutation } from '../../lib/queries';
import { t } from '../../lib/translations';
import { useAppStore } from '../../lib/store';
import ErrorBanner from '../ErrorBanner';

const BRAND_LABEL: Record<Brand, string> = {
  google: 'Google',
  aws: 'AWS',
};

export default function BrandSwitch() {
  const lang = useAppStore((s) => s.lang);
  const ui = t(lang);

  const brandQuery = useBrandQuery();
  const setBrand = useSetBrandMutation();
  const current = brandQuery.data?.brand ?? 'google';

  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-5">
      <h2 className="text-sm font-medium text-white/70 mb-3">{ui.adminBrandSwitchTitle}</h2>
      <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5">
        {ALL_BRANDS.map((b) => {
          const active = b === current;
          return (
            <button
              key={b}
              type="button"
              disabled={setBrand.isPending || active}
              onClick={() => setBrand.mutate(b)}
              className={[
                'rounded-full px-4 py-1.5 text-sm transition-colors',
                active
                  ? 'accent-bg text-black font-medium'
                  : 'text-white/70 hover:text-white hover:bg-white/5',
              ].join(' ')}
            >
              {BRAND_LABEL[b]}
            </button>
          );
        })}
      </div>
      <ErrorBanner error={setBrand.error} lang={lang} onDismiss={() => setBrand.reset()} />
    </section>
  );
}
