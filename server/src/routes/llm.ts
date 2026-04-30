import { Router } from 'express';

import { DEFAULT_LLM_CHAIN, LlmChainSchema, type LlmChain } from '@asb/shared';

import { clearGenerateCache } from '../lib/generateCache.js';
import { providers } from '../lib/providers.js';
import { getSupabase } from '../lib/supabase.js';
import { adminChain, superAdminChain } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { z } from 'zod';

export const llmRouter = Router();

const GLOBAL_CONFIG_ID = 1;

// ───────────────────────────────────────────
// GET /api/llm-chain (admin) → current chain + temperature + which providers are configured
// Surfaced to admin UI so the lecturer knows which provider rows will actually run.
// ───────────────────────────────────────────

llmRouter.get('/', ...adminChain, async (_req, res, next) => {
  try {
    const { data, error } = await getSupabase()
      .from('global_config')
      .select('llm_chain, temperature, updated_at')
      .eq('id', GLOBAL_CONFIG_ID)
      .single();
    if (error) throw new HttpError(500, 'INTERNAL', error.message);

    const parsedChain = LlmChainSchema.safeParse(data?.llm_chain);
    const chain: LlmChain = parsedChain.success ? parsedChain.data : DEFAULT_LLM_CHAIN;
    const temperature = typeof data?.temperature === 'number' ? data.temperature : 0.7;

    res.json({
      chain,
      temperature,
      updatedAt: data?.updated_at ?? null,
      configured: {
        gemini: providers.gemini.isConfigured(),
        kimi: providers.kimi.isConfigured(),
        deepseek: providers.deepseek.isConfigured(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ───────────────────────────────────────────
// PUT /api/llm-chain (admin) → replace chain (+optional temperature)
// ───────────────────────────────────────────

const PutBodySchema = z.object({
  chain: LlmChainSchema,
  temperature: z.number().min(0).max(2).optional(),
});

llmRouter.put('/', ...superAdminChain, async (req, res, next) => {
  try {
    const parsed = PutBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid body', parsed.error.issues);
    }
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      llm_chain: parsed.data.chain,
      updated_at: now,
      updated_by: req.user!.id,
    };
    if (parsed.data.temperature !== undefined) update.temperature = parsed.data.temperature;

    const { data, error } = await getSupabase()
      .from('global_config')
      .update(update)
      .eq('id', GLOBAL_CONFIG_ID)
      .select('llm_chain, temperature, updated_at')
      .single();
    if (error) throw new HttpError(500, 'INTERNAL', error.message);

    // Chain reorder / model change / temperature change all change AI output. Invalidate.
    clearGenerateCache();

    res.json({
      chain: data.llm_chain as LlmChain,
      temperature: data.temperature as number,
      updatedAt: data.updated_at,
    });
  } catch (err) {
    next(err);
  }
});
