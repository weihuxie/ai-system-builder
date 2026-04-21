// ───────────────────────────────────────────
// Offline fallback cache.
//
// Summit 现场梯子可能挂（上海场尤其），Vercel 也可能抽风。原则：
//   1. 首屏永远有内容可看 —— 从 localStorage 取上次成功的 products / brand，
//      localStorage 没东西就兜底到 DEFAULT_PRODUCTS / 'google'
//   2. 每次请求成功后写回 localStorage，下次断网就有最新缓存
//   3. 请求失败时 React Query 的 query.error 仍然会暴露，UI 层据此挂 OfflineBanner
//
// 不缓存的数据：/api/generate（AI 调用本来就实时，断网直接报错让用户看兜底列表）、
// /api/stt（同理）、admin/me 及以下（admin 路由断网就让它失败，不给误导）。
// ───────────────────────────────────────────

import { DEFAULT_PRODUCTS, type Brand, type ProductItem } from '@asb/shared';

const KEY_PRODUCTS = 'asb.cache.products.v1';
const KEY_BRAND = 'asb.cache.brand.v1';

function safeParse<T>(raw: string | null, validate: (x: unknown) => x is T): T | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return validate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ──── products ────────────────────────────────────────────────────────────

export function readProductsCache(): ProductItem[] {
  if (typeof localStorage === 'undefined') return DEFAULT_PRODUCTS;
  const cached = safeParse<ProductItem[]>(
    localStorage.getItem(KEY_PRODUCTS),
    (x): x is ProductItem[] => Array.isArray(x) && x.every((p) => typeof p?.id === 'string'),
  );
  return cached ?? DEFAULT_PRODUCTS;
}

export function writeProductsCache(products: ProductItem[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));
  } catch {
    // SecurityError / QuotaExceededError — fine, cache is best-effort
  }
}

// ──── brand ───────────────────────────────────────────────────────────────

export interface BrandCacheShape {
  brand: Brand;
  updatedAt: string;
}

const isBrandCache = (x: unknown): x is BrandCacheShape =>
  !!x &&
  typeof x === 'object' &&
  'brand' in x &&
  (x.brand === 'google' || x.brand === 'aws');

export function readBrandCache(): BrandCacheShape {
  if (typeof localStorage === 'undefined') return { brand: 'google', updatedAt: '' };
  const cached = safeParse<BrandCacheShape>(localStorage.getItem(KEY_BRAND), isBrandCache);
  return cached ?? { brand: 'google', updatedAt: '' };
}

export function writeBrandCache(payload: BrandCacheShape): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY_BRAND, JSON.stringify(payload));
  } catch {
    // best-effort
  }
}
