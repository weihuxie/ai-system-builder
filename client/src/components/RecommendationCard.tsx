import { useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Sparkles } from 'lucide-react';

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
 * Single recommendation card. The rationale is the demo's hero — visually
 * dominant via a callout block (accent left-border + tinted background +
 * Sparkles icon). Product name / audience act as supporting metadata above
 * the rationale, not competing with it for attention.
 *
 * Rationale is default-expanded (user's chosen option ① from Q-Rationale-UX).
 * A 5-line clamp + "展开详情 / 收起" toggle only appears if the text actually overflows.
 */
export default function RecommendationCard({ product, rationale, lang, brand, rank }: Props) {
  const ui = t(lang);
  const name = pickLang(product.name, lang);
  const audience = pickLang(product.audience, lang);
  const url = pickBrandLang(product.url, brand, lang);

  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef<HTMLParagraphElement | null>(null);

  // Detect whether the line-clamp actually cuts content. If not, no need to
  // show the toggle — avoids a lonely "Show more" on 1-line rationales.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [rationale, expanded]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.08, duration: 0.35 }}
      className="flex flex-col rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-5 shadow-sm hover:shadow-lg hover:shadow-black/20 hover:border-[var(--accent-muted)] hover:-translate-y-0.5 transition-all"
    >
      {/* Header: rank + name + audience */}
      <div className="flex items-baseline gap-2">
        <span className="text-xs accent-text font-semibold tabular-nums">
          {`#${rank + 1}`}
        </span>
        <h3 className="text-lg font-semibold text-white leading-tight flex-1 min-w-0">
          {name}
        </h3>
      </div>
      {audience && (
        <p className="mt-1 text-sm text-white/60 leading-relaxed">{audience}</p>
      )}

      {/* Rationale callout — the visual hero. AI's pitch lives here.
          Accent left border + tinted bg + sparkles icon → "this came from AI". */}
      {rationale && (
        <div className="mt-4 flex-1 rounded-xl border-l-2 border-l-[var(--accent)] bg-[var(--bg-surface-elevated)] py-3 pl-3 pr-4">
          <div className="flex items-baseline gap-1.5 mb-1.5">
            <Sparkles size={12} className="accent-text shrink-0 translate-y-[1px]" />
            <span className="text-[11px] accent-text font-semibold uppercase tracking-wider">
              {ui.rationaleLabel.replace(/[:：]\s*$/, '')}
            </span>
          </div>
          <p
            ref={textRef}
            className={[
              'text-sm leading-relaxed text-white/85 whitespace-pre-wrap',
              expanded ? '' : 'line-clamp-5',
            ].join(' ')}
          >
            {rationale}
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
      )}

      {/* Fallback: if no rationale (e.g. AI returned empty), show description */}
      {!rationale && (
        <p className="mt-4 flex-1 text-sm leading-relaxed text-white/75">
          {pickLang(product.description, lang)}
        </p>
      )}

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
