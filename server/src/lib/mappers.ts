// ───────────────────────────────────────────
// Row ↔ Type mappers
//
// Postgres uses snake_case (is_participating, created_at, updated_at)
// but our TS types use camelCase (see shared/types.ts).
// Do ALL conversions in this file so routes never touch snake_case keys.
// ───────────────────────────────────────────

import type { ProductItem, LangMap, BrandMap } from '@asb/shared';

/** Shape of a row as it comes back from Supabase's `products` table. */
export interface ProductRow {
  id: string;
  name: LangMap;
  description: LangMap;
  audience: LangMap;
  url: BrandMap;
  is_participating: boolean;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
}

/**
 * Build ProductItem from a DB row. ownerEmail is denormalized — caller must
 * pass the email (looked up from admin_users separately) or leave null.
 * We don't embed via PostgREST because there's no FK between products and
 * admin_users (both reference auth.users, not each other).
 */
export function rowToProduct(row: ProductRow, ownerEmail: string | null = null): ProductItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    audience: row.audience,
    url: row.url,
    isParticipating: row.is_participating,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerId: row.owner_id,
    ownerEmail,
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
  return row;
}
