// ───────────────────────────────────────────
// i18n helpers (lang resolution + field fallback)
// Used by both client (UI) and server (prompt construction).
// ───────────────────────────────────────────

import type { Lang, LangMap, Brand, BrandMap, BrandLangMap } from './types.js';

/**
 * Resolve a LangMap field to a displayable string.
 * Fallback chain: lang → zh-CN → en → first non-empty → ''.
 */
export function pickLang(field: LangMap | undefined, lang: Lang): string {
  if (!field) return '';
  const v = field[lang];
  if (v) return v;
  if (field['zh-CN']) return field['zh-CN'];
  if (field.en) return field.en;
  for (const k of ['zh-HK', 'ja'] as const) {
    if (field[k]) return field[k];
  }
  return '';
}

/**
 * Resolve a BrandMap (legacy, brand-only URL) to the current brand's value.
 * Kept for backward compat with any code still reading a flat BrandMap;
 * for per-lang URLs use pickBrandLang instead.
 */
export function pickBrand(field: BrandMap | undefined, brand: Brand): string {
  if (!field) return '';
  const v = field[brand];
  if (v) return v;
  return field.google ?? '';
}

/**
 * Resolve a BrandLangMap (product.url) to a single URL.
 * Fallback order — brand-consistency first, lang second:
 *   1. brand × lang        (exact match)
 *   2. brand × en          (same brand, default lang)
 *   3. google × lang       (primary brand, same lang)
 *   4. google × en         (last-resort global URL)
 *   5. ''                  (nothing to show → caller hides the CTA)
 *
 * Rationale: switching brand mid-visit is worse than seeing English under the
 * same brand. e.g. if viewer chose 日本語 + AWS and only google.ja exists,
 * we show aws.en (English AWS) rather than workspace.google.com/ja.
 */
export function pickBrandLang(
  field: BrandLangMap | undefined,
  brand: Brand,
  lang: Lang,
): string {
  if (!field) return '';
  const brandUrls = field[brand];
  if (brandUrls) {
    if (brandUrls[lang]) return brandUrls[lang];
    if (brandUrls.en) return brandUrls.en;
  }
  const google = field.google;
  if (google) {
    if (google[lang]) return google[lang];
    if (google.en) return google.en;
  }
  return '';
}

/**
 * Country code (ISO 3166-1 alpha-2) → default Lang.
 * Source of truth for IP-based language detection.
 */
export function countryToLang(country: string | undefined | null): Lang {
  if (!country) return 'en';
  const c = country.toUpperCase();
  if (c === 'CN') return 'zh-CN';
  if (c === 'HK' || c === 'TW' || c === 'MO') return 'zh-HK';
  if (c === 'JP') return 'ja';
  return 'en';
}

/**
 * Map app Lang → Web Speech API / STT service lang code.
 */
export function sttLangCode(lang: Lang): string {
  switch (lang) {
    case 'zh-CN':
      return 'zh-CN';
    case 'zh-HK':
      return 'zh-HK';
    case 'ja':
      return 'ja-JP';
    case 'en':
    default:
      return 'en-US';
  }
}

/**
 * Suffix appended to each lang's product name when cloning.
 * copySuffix('zh-CN') = '（副本）', copySuffix('en') = ' (Copy)', etc.
 */
export function copySuffix(lang: Lang): string {
  switch (lang) {
    case 'zh-CN':
    case 'zh-HK':
      return '（副本）';
    case 'ja':
      return '（コピー）';
    case 'en':
    default:
      return ' (Copy)';
  }
}

/**
 * Apply copySuffix to a LangMap (all 4 langs at once), stripping any
 * existing suffix first to avoid "xxx（副本）（副本）" accumulation on repeat clones.
 */
export function withCopySuffix(field: LangMap): LangMap {
  const next = {} as LangMap;
  for (const lang of ['zh-CN', 'zh-HK', 'en', 'ja'] as const) {
    const suffix = copySuffix(lang);
    const original = field[lang] ?? '';
    const stripped = original.endsWith(suffix) ? original.slice(0, -suffix.length) : original;
    next[lang] = stripped + suffix;
  }
  return next;
}
