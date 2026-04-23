import { useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';

import { pickBrandLang, pickLang, type Brand, type Lang, type ProductItem } from '@asb/shared';

import { t } from '../lib/translations';

interface Props {
  product: ProductItem;
  rationale: string;
  lang: Lang;
  brand: Brand;
  rank: number; // 0-based, for stagger animation
}

/**
 * Single recommendation card.
 * Rationale is default-expanded (user's chosen option ① from Q-Rationale-UX).
 * A 4-line clamp + "展开详情 / 收起" toggle only appears if the text actually overflows.
 */
export default function RecommendationCard({ product, rationale, lang, brand, rank }: Props) {
  const ui = t(lang);
  const name = pickLang(product.name, lang);
  const audience = pickLang(product.audience, lang);
  const url = pickBrandLang(product.url, brand, lang);

  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef<HTMLParagraphElement | null>(null);

  // Detect whether the 4-line clamp actually cuts content. If not, no need to
  // show the toggle button at all — avoids a lonely "Show more" for 1-line rationales.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    // `scrollHeight > clientHeight + 1` gives some rounding margin
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [rationale, expanded]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.08, duration: 0.35 }}
      className="flex flex-col rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-5 shadow-sm hover:shadow-lg hover:border-[var(--accent-muted)] transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs accent-text font-semibold uppercase tracking-wide">
            {`#${rank + 1}`}
          </div>
          <h3 className="mt-1 text-lg font-semibold text-white leading-tight">{name}</h3>
          {audience && <p className="mt-1 text-xs text-white/50">{audience}</p>}
        </div>
      </div>

      <div className="mt-4 flex-1">
        <p
          ref={textRef}
          className={[
            'text-sm leading-relaxed text-white/80 whitespace-pre-wrap',
            expanded ? '' : 'line-clamp-4',
          ].join(' ')}
        >
          {rationale || pickLang(product.description, lang)}
        </p>
        {overflows && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 text-xs accent-text hover:underline"
          >
            {expanded ? ui.rationaleCollapse : ui.rationaleExpand}
          </button>
        )}
      </div>

      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-4 inline-flex items-center gap-1 self-start rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:border-[var(--accent-muted)] transition-colors"
        >
          {ui.productCtaLearnMore}
          <ArrowUpRight size={12} />
        </a>
      )}
    </motion.article>
  );
}
