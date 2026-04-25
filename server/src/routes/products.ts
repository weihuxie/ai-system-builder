import { Router } from 'express';
import { z } from 'zod';

import { ProductItemInputSchema, withCopySuffix } from '@asb/shared';
import { getSupabase } from '../lib/supabase.js';
import { productToRow, rowToProduct, type ProductRow } from '../lib/mappers.js';
import { adminChain, canEditProduct } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

export const productsRouter = Router();

// ───────────────────────────────────────────
// Owner email denormalization
// products.owner_id → auth.users.id; admin_users has (email, user_id).
// No FK between products and admin_users (both point at auth.users), so we
// cannot embed via PostgREST. Fetch the admin_users rows for the set of
// owner_ids and build a lookup map in JS.
// ───────────────────────────────────────────
async function buildOwnerEmailMap(ownerIds: Array<string | null>): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ownerIds.filter((x): x is string => !!x)));
  if (unique.length === 0) return new Map();
  const { data, error } = await getSupabase()
    .from('admin_users')
    .select('email, user_id')
    .in('user_id', unique);
  if (error) throw new HttpError(500, 'INTERNAL', error.message);
  const map = new Map<string, string>();
  for (const row of (data ?? []) as Array<{ email: string; user_id: string | null }>) {
    if (row.user_id) map.set(row.user_id, row.email);
  }
  return map;
}

// ───────────────────────────────────────────
// GET /api/products
// Public read — used by the homepage catalog & AI recommendation grid.
// Returns ONLY is_participating=true rows. Tightened from the previous
// `select(*)` which returned every product (including non-participating
// drafts) to anyone hitting the endpoint, and leaked sibling editors'
// products to authenticated editors via Network tab. Admin UI now uses
// /api/admin/products which is auth-aware and role-filtered.
// ───────────────────────────────────────────

productsRouter.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await getSupabase()
      .from('products')
      .select('*')
      .eq('is_participating', true)
      .order('id');
    if (error) throw new HttpError(500, 'INTERNAL', error.message);
    const rows = (data ?? []) as ProductRow[];
    const emailMap = await buildOwnerEmailMap(rows.map((r) => r.owner_id));
    res.json(rows.map((r) => rowToProduct(r, r.owner_id ? (emailMap.get(r.owner_id) ?? null) : null)));
  } catch (err) {
    next(err);
  }
});

// ───────────────────────────────────────────
// GET /api/admin/products (admin)
// Auth + role aware:
//   - super_admin → every row (so they can re-assign / orphan-pool / undelete)
//   - editor      → only rows they own (owner_id = req.user.id)
// Editors hitting this endpoint never see siblings' products even via raw
// Network response, closing the leak that the legacy GET /api/products had.
// Mounted on the products router (not admin router) so the file ownership
// helpers (buildOwnerEmailMap, mappers) stay co-located. Path is namespaced
// via app.ts mount pattern below.
// ───────────────────────────────────────────

productsRouter.get('/admin', ...adminChain, async (req, res, next) => {
  try {
    const user = req.user!;
    let q = getSupabase().from('products').select('*').order('id');
    if (user.role === 'editor') {
      q = q.eq('owner_id', user.id);
    }
    const { data, error } = await q;
    if (error) throw new HttpError(500, 'INTERNAL', error.message);
    const rows = (data ?? []) as ProductRow[];
    const emailMap = await buildOwnerEmailMap(rows.map((r) => r.owner_id));
    res.json(rows.map((r) => rowToProduct(r, r.owner_id ? (emailMap.get(r.owner_id) ?? null) : null)));
  } catch (err) {
    next(err);
  }
});

// ───────────────────────────────────────────
// POST /api/products (admin)
// editor: ownerId is forced to req.user.id regardless of payload.
// super_admin: may pass explicit ownerId (to seed a product for someone else).
// ───────────────────────────────────────────

productsRouter.post('/', ...adminChain, async (req, res, next) => {
  try {
    const parsed = ProductItemInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid product', parsed.error.issues);
    }
    const user = req.user!;
    const payload = { ...parsed.data };
    if (user.role === 'editor') {
      payload.ownerId = user.id;
    } else if (payload.ownerId === undefined) {
      payload.ownerId = user.id;
    }

    const { data, error } = await getSupabase()
      .from('products')
      .insert(productToRow(payload))
      .select()
      .single();
    if (error) throw new HttpError(500, 'INTERNAL', error.message);

    const row = data as ProductRow;
    const emailMap = await buildOwnerEmailMap([row.owner_id]);
    res.status(201).json(rowToProduct(row, row.owner_id ? (emailMap.get(row.owner_id) ?? null) : null));
  } catch (err) {
    next(err);
  }
});

// ───────────────────────────────────────────
// PUT /api/products/:id (admin)
// Ownership-gated: editors can only mutate their own products.
// editors cannot reassign ownerId (payload value is ignored).
// ───────────────────────────────────────────

productsRouter.put('/:id', ...adminChain, async (req, res, next) => {
  try {
    const idParsed = z.string().min(1).max(64).safeParse(req.params.id);
    if (!idParsed.success) throw new HttpError(400, 'VALIDATION', 'Invalid id');

    const user = req.user!;
    const allowed = await canEditProduct(user, idParsed.data);
    if (!allowed) {
      throw new HttpError(403, 'OWNERSHIP_REQUIRED', 'Not your product');
    }

    const parsed = ProductItemInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid product patch', parsed.error.issues);
    }
    const payload = { ...parsed.data };
    if (user.role === 'editor') {
      // editors cannot reassign ownership
      delete payload.ownerId;
    }

    const { data, error } = await getSupabase()
      .from('products')
      .update(productToRow(payload))
      .eq('id', idParsed.data)
      .select()
      .single();
    if (error) throw new HttpError(500, 'INTERNAL', error.message);

    const row = data as ProductRow;
    const emailMap = await buildOwnerEmailMap([row.owner_id]);
    res.json(rowToProduct(row, row.owner_id ? (emailMap.get(row.owner_id) ?? null) : null));
  } catch (err) {
    next(err);
  }
});

// ───────────────────────────────────────────
// DELETE /api/products/:id (admin)
// ───────────────────────────────────────────

// ───────────────────────────────────────────
// POST /api/products/:id/clone (admin)
// Copies a product: new id = {id}-copy (or -copy-2, -copy-3, ... on collision),
// names get the lang-appropriate suffix, ownerId = current user,
// isParticipating=false so the clone doesn't appear to visitors until toggled.
//
// Any whitelisted admin can clone any product (the clone becomes theirs).
// Collision budget: 20 attempts — if all exhausted, returns 409 CONFLICT.
// ───────────────────────────────────────────

const CLONE_MAX_ATTEMPTS = 20;

productsRouter.post('/:id/clone', ...adminChain, async (req, res, next) => {
  try {
    const idParsed = z.string().min(1).max(64).safeParse(req.params.id);
    if (!idParsed.success) throw new HttpError(400, 'VALIDATION', 'Invalid id');

    const supabase = getSupabase();
    const { data: src, error: srcErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', idParsed.data)
      .maybeSingle();
    if (srcErr) throw new HttpError(500, 'INTERNAL', srcErr.message);
    if (!src) throw new HttpError(404, 'NOT_FOUND', 'Source product not found');

    const srcRow = src as ProductRow;
    const baseId = `${srcRow.id}-copy`;

    // Probe candidate ids one-by-one; on each attempt try to insert.
    // Unique-violation (23505) on id → bump suffix and retry.
    for (let attempt = 1; attempt <= CLONE_MAX_ATTEMPTS; attempt++) {
      const newId = attempt === 1 ? baseId : `${baseId}-${attempt}`;
      const user = req.user!;
      const insertRow = {
        id: newId,
        name: withCopySuffix(srcRow.name),
        description: srcRow.description,
        audience: srcRow.audience,
        url: srcRow.url,
        is_participating: false,
        owner_id: user.id,
      };
      const { data, error } = await supabase
        .from('products')
        .insert(insertRow)
        .select()
        .single();
      if (!error && data) {
        const row = data as ProductRow;
        const emailMap = await buildOwnerEmailMap([row.owner_id]);
        res.status(201).json(rowToProduct(row, row.owner_id ? (emailMap.get(row.owner_id) ?? null) : null));
        return;
      }
      // 23505 = unique_violation (Postgres). Fall through to next suffix.
      if (error && error.code !== '23505') {
        throw new HttpError(500, 'INTERNAL', error.message);
      }
    }
    throw new HttpError(409, 'CONFLICT', 'Too many clones; bump existing ones first');
  } catch (err) {
    next(err);
  }
});

productsRouter.delete('/:id', ...adminChain, async (req, res, next) => {
  try {
    const idParsed = z.string().min(1).max(64).safeParse(req.params.id);
    if (!idParsed.success) throw new HttpError(400, 'VALIDATION', 'Invalid id');

    const user = req.user!;
    const allowed = await canEditProduct(user, idParsed.data);
    if (!allowed) {
      throw new HttpError(403, 'OWNERSHIP_REQUIRED', 'Not your product');
    }

    const { error } = await getSupabase().from('products').delete().eq('id', idParsed.data);
    if (error) throw new HttpError(500, 'INTERNAL', error.message);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
