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
}

export function rowToProduct(row: ProductRow): ProductItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    audience: row.audience,
    url: row.url,
    isParticipating: row.is_participating,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert a (possibly partial) ProductItem into a column-matching insert/update payload.
 * Only the fields actually present in `p` are included (so PATCH semantics work).
 */
export function productToRow(
  p: Partial<Omit<ProductItem, 'createdAt' | 'updatedAt'>>,
): Partial<ProductRow> {
  const row: Partial<ProductRow> = {};
  if (p.id !== undefined) row.id = p.id;
  if (p.name !== undefined) row.name = p.name;
  if (p.description !== undefined) row.description = p.description;
  if (p.audience !== undefined) row.audience = p.audience;
  if (p.url !== undefined) row.url = p.url;
  if (p.isParticipating !== undefined) row.is_participating = p.isParticipating;
  return row;
}
