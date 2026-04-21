// ───────────────────────────────────────────
// i18n helpers (lang resolution + field fallback)
// Used by both client (UI) and server (prompt construction).
// ───────────────────────────────────────────

import type { Lang, LangMap, Brand, BrandMap } from './types.js';

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
 * Resolve a BrandMap (e.g. product.url) to the current brand's value.
 * If current brand's value is empty, fall back to google (our primary SKU).
 */
export function pickBrand(field: BrandMap | undefined, brand: Brand): string {
  if (!field) return '';
  const v = field[brand];
  if (v) return v;
  return field.google ?? '';
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
