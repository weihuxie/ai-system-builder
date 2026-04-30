// ───────────────────────────────────────────
// Row ↔ Type mappers
//
// Postgres uses snake_case (is_participating, created_at, updated_at)
// but our TS types use camelCase (see shared/types.ts).
// Do ALL conversions in this file so routes never touch snake_case keys.
// ───────────────────────────────────────────

import type { ProductItem, LangMap, BrandLangMap } from '@asb/shared';

/**
 * Shape of a row as it comes back from Supabase's `products` table.
 *
 * `url` is typed as unknown because the JSONB column can hold either:
 *   - legacy: { google: string, aws: string }             (pre-2026-04 migration)
 *   - new:    { google: LangMap, aws: LangMap }           (post migration)
 * rowToProduct normalises both shapes into BrandLangMap so consumers never see
 * the legacy form. Once migrate-product-urls.mjs has been run in every env,
 * this branch becomes dead code but we keep it as a safety net for hand-edited
 * JSONB rows.
 */
export interface ProductRow {
  id: string;
  name: LangMap;
  description: LangMap;
  audience: LangMap;
  url: unknown;
  is_participating: boolean;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
  /** jsonb array of industry IDs (migration 0005). May be missing on rows
   *  inserted before the migration ran — normalised to [] on read. */
  industries?: unknown;
}

function emptyLangMap(): LangMap {
  return { 'zh-CN': '', 'zh-HK': '', en: '', ja: '' };
}

/** Inflate a single brand's URL entry. Accepts either a flat string (legacy)
 *  or a partial LangMap (new); returns a fully-populated LangMap. */
function inflateBrandUrls(v: unknown): LangMap {
  if (typeof v === 'string') {
    return { 'zh-CN': v, 'zh-HK': v, en: v, ja: v };
  }
  if (v && typeof v === 'object') {
    const obj = v as Partial<LangMap>;
    return {
      'zh-CN': typeof obj['zh-CN'] === 'string' ? obj['zh-CN'] : '',
      'zh-HK': typeof obj['zh-HK'] === 'string' ? obj['zh-HK'] : '',
      en: typeof obj.en === 'string' ? obj.en : '',
      ja: typeof obj.ja === 'string' ? obj.ja : '',
    };
  }
  return emptyLangMap();
}

/** Normalise a DB `url` JSONB value into BrandLangMap, tolerating legacy shapes. */
function normaliseUrl(raw: unknown): BrandLangMap {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    google: inflateBrandUrls(obj.google),
    aws: inflateBrandUrls(obj.aws),
  };
}

/**
 * Build ProductItem from a DB row. ownerEmail is denormalized — caller must
 * pass the email (looked up from admin_users separately) or leave null.
 * We don't embed via PostgREST because there's no FK between products and
 * admin_users (both reference auth.users, not each other).
 */
/** Coerce DB `industries` jsonb (may be undefined / null / non-array) to string[]. */
function normaliseIndustries(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

export function rowToProduct(row: ProductRow, ownerEmail: string | null = null): ProductItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    audience: row.audience,
    url: normaliseUrl(row.url),
    isParticipating: row.is_participating,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerId: row.owner_id,
    ownerEmail,
    industries: normaliseIndustries(row.industries),
  };
}

/**
 * Convert a (possibly partial) ProductItem into a column-matching insert/update payload.
 * Only the fields actually present in `p` are included (so PATCH semantics work).
 * ownerEmail is NOT persisted — it's denormalized on read from admin_users.
 */
export function productToRow(
  p: Partial<Omit<ProductItem, 'createdAt' | 'updatedAt' | 'ownerEmail'>>,
): Partial<ProductRow> {
  const row: Partial<ProductRow> = {};
  if (p.id !== undefined) row.id = p.id;
  if (p.name !== undefined) row.name = p.name;
  if (p.description !== undefined) row.description = p.description;
  if (p.audience !== undefined) row.audience = p.audience;
  if (p.url !== undefined) row.url = p.url;
  if (p.isParticipating !== undefined) row.is_participating = p.isParticipating;
  if (p.ownerId !== undefined) row.owner_id = p.ownerId;
  if (p.industries !== undefined) row.industries = p.industries;
  return row;
}
