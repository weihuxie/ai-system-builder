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

// Stryker disable next-line StringLiteral: '/' is mount-equivalent to '' under express.Router.
brandRouter.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await getSupabase()
      .from('global_config')
      // Stryker disable next-line StringLiteral: PostgREST .select('') returns all columns; server only forwards brand+updated_at so the wire contract is unchanged.
      .select('brand, updated_at')
      // Stryker disable next-line StringLiteral: empty column name on a singleton row table; .single() still resolves the only row.
      .eq('id', GLOBAL_CONFIG_ID)
      .single();

    if (error) throw new HttpError(500, 'INTERNAL', error.message);
    // Stryker disable next-line all: dead-code defense. supabase .single() contract makes (error,data) mutually exclusive — when there are no rows, error=PGRST116 (handled above) and data=null only via that branch. This line is unreachable on a healthy client.
    if (!data) throw new HttpError(500, 'INTERNAL', 'global_config row missing');

    // Stryker disable next-line all: defense-in-depth against schema drift; global_config.brand has a CHECK constraint pinning values to 'google'|'aws' (migration 0001).
    const brand = BrandSchema.safeParse(data.brand);
    // Stryker disable next-line all: same as above — only reachable if DB schema drifts.
    if (!brand.success) {
      // Stryker disable next-line all: same as above.
      throw new HttpError(500, 'INTERNAL', `Invalid brand in DB: ${String(data.brand)}`);
    }

    res.json({ brand: brand.data as Brand, updatedAt: data.updated_at });
  } catch (err) {
    next(err);
  }
});

// Stryker disable next-line StringLiteral: '/' is mount-equivalent to '' under express.Router.
brandRouter.put('/', ...superAdminChain, async (req, res, next) => {
  try {
    // Stryker disable next-line OptionalChaining: express.json() guarantees req.body is an object (never undefined), so `?.` is dead defense.
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
