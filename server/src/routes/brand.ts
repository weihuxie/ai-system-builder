import { Router } from 'express';

import { BrandSchema, type Brand } from '@asb/shared';
import { clearGenerateCache } from '../lib/generateCache.js';
import { getSupabase } from '../lib/supabase.js';
import { superAdminChain } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

export const brandRouter = Router();

// ───────────────────────────────────────────
// Singleton row: global_config.id = 1
// Public GET → current brand (so client can paint correct theme on first paint)
// Admin PUT → flip brand; Supabase Realtime fans out to all demo machines
// ───────────────────────────────────────────

const GLOBAL_CONFIG_ID = 1;

brandRouter.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await getSupabase()
      .from('global_config')
      .select('brand, updated_at')
      .eq('id', GLOBAL_CONFIG_ID)
      .single();

    if (error) throw new HttpError(500, 'INTERNAL', error.message);
    if (!data) throw new HttpError(500, 'INTERNAL', 'global_config row missing');

    const brand = BrandSchema.safeParse(data.brand);
    if (!brand.success) {
      // DB row corrupted — safer to tell the client explicitly than silently pick a default
      throw new HttpError(500, 'INTERNAL', `Invalid brand in DB: ${String(data.brand)}`);
    }

    res.json({ brand: brand.data as Brand, updatedAt: data.updated_at });
  } catch (err) {
    next(err);
  }
});

brandRouter.put('/', ...superAdminChain, async (req, res, next) => {
  try {
    const parsed = BrandSchema.safeParse(req.body?.brand);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid brand (must be "google" or "aws")');
    }

    const now = new Date().toISOString();
    const { data, error } = await getSupabase()
      .from('global_config')
      .update({ brand: parsed.data, updated_at: now, updated_by: req.user!.id })
      .eq('id', GLOBAL_CONFIG_ID)
      .select('brand, updated_at')
      .single();

    if (error) throw new HttpError(500, 'INTERNAL', error.message);

    // Brand change → AI rationale tone changes (Google vs AWS narrative). Invalidate.
    clearGenerateCache();

    res.json({ brand: data.brand as Brand, updatedAt: data.updated_at });
  } catch (err) {
    next(err);
  }
});
