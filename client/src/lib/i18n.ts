import { countryToLang, isLang, type Lang } from '@asb/shared';

const LANG_STORAGE_KEY = 'asb.lang';

/**
 * Resolve the initial display language.
 * Priority (see design doc §6.2):
 *   1. localStorage (user-picked preference)
 *   2. GET /api/geo (server-side IP lookup via geojs.io, 3s timeout)
 *   3. navigator.language prefix match
 *   4. 'en' fallback
 */
export async function detectInitialLang(): Promise<Lang> {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && isLang(stored)) return stored;
  } catch {
    // ignore
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const resp = await fetch(`${import.meta.env.VITE_API_BASE || '/api'}/geo`, {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (resp.ok) {
      const data = (await resp.json()) as { country?: string; lang?: string };
      if (data.lang && isLang(data.lang)) return data.lang;
      if (data.country) return countryToLang(data.country);
    }
  } catch {
    // ignore and fall through
  }

  return navigatorFallback();
}

function navigatorFallback(): Lang {
  const nav = (navigator.language || 'en').toLowerCase();
  if (nav.startsWith('zh-tw') || nav.startsWith('zh-hk') || nav.startsWith('zh-mo')) return 'zh-HK';
  if (nav.startsWith('zh')) return 'zh-CN';
  if (nav.startsWith('ja')) return 'ja';
  return 'en';
}
