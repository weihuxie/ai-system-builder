import { Router } from 'express';
import { z } from 'zod';

import { ProductItemInputSchema } from '@asb/shared';
import { getSupabase } from '../lib/supabase.js';
import { productToRow, rowToProduct, type ProductRow } from '../lib/mappers.js';
import { requireAdmin } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

export const productsRouter = Router();

// ───────────────────────────────────────────
// Public read
// (admin list also uses this endpoint — RLS lets anon see only is_participating=true,
//  but admin UI calls via the proxied backend which uses the service key and sees all.)
// ───────────────────────────────────────────

productsRouter.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await getSupabase().from('products').select('*').order('id');
    if (error) throw new HttpError(500, 'INTERNAL', error.message);
    const rows = (data ?? []) as ProductRow[];
    res.json(rows.map(rowToProduct));
  } catch (err) {
    next(err);
  }
});

// ───────────────────────────────────────────
// Admin-only writes
// ───────────────────────────────────────────

productsRouter.post('/', requireAdmin, async (req, res, next) => {
  try {
    const parsed = ProductItemInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid product', parsed.error.issues);
    }
    // created_at / updated_at are filled by DB defaults + trigger — don't set here.
    const { data, error } = await getSupabase()
      .from('products')
      .insert(productToRow(parsed.data))
      .select()
      .single();
    if (error) throw new HttpError(500, 'INTERNAL', error.message);
    res.status(201).json(rowToProduct(data as ProductRow));
  } catch (err) {
    next(err);
  }
});

productsRouter.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const idParsed = z.string().min(1).max(64).safeParse(req.params.id);
    if (!idParsed.success) throw new HttpError(400, 'VALIDATION', 'Invalid id');

    const parsed = ProductItemInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid product patch', parsed.error.issues);
    }
    // updated_at is bumped by the DB trigger; we just send the changed fields.
    const { data, error } = await getSupabase()
      .from('products')
      .update(productToRow(parsed.data))
      .eq('id', idParsed.data)
      .select()
      .single();
    if (error) throw new HttpError(500, 'INTERNAL', error.message);
    res.json(rowToProduct(data as ProductRow));
  } catch (err) {
    next(err);
  }
});

productsRouter.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const idParsed = z.string().min(1).max(64).safeParse(req.params.id);
    if (!idParsed.success) throw new HttpError(400, 'VALIDATION', 'Invalid id');
    const { error } = await getSupabase().from('products').delete().eq('id', idParsed.data);
    if (error) throw new HttpError(500, 'INTERNAL', error.message);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
