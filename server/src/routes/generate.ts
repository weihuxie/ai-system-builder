import { Router } from 'express';

import {
  DEFAULT_LLM_CHAIN,
  DEFAULT_TEMPERATURE,
  GenerateRequestSchema,
  LlmChainSchema,
  SolutionSchema,
  type GenerateResponse,
  type LlmChain,
} from '@asb/shared';

import { rowToProduct, type ProductRow } from '../lib/mappers.js';
import { providers } from '../lib/providers.js';
import { buildRecommendationPrompt } from '../lib/prompt.js';
import { getSupabase } from '../lib/supabase.js';
import { HttpError } from '../middleware/errors.js';

export const generateRouter = Router();

generateRouter.post('/', async (req, res, next) => {
  try {
    const parsed = GenerateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid request body', parsed.error.issues);
    }
    const { userInput, lang } = parsed.data;

    const supabase = getSupabase();
    const [{ data: productRows, error: prodErr }, { data: cfgRow, error: cfgErr }] = await Promise.all([
      supabase.from('products').select('*').eq('is_participating', true),
      supabase.from('global_config').select('brand, llm_chain, temperature').eq('id', 1).single(),
    ]);

    if (prodErr) throw new HttpError(500, 'INTERNAL', `Product fetch failed: ${prodErr.message}`);
    if (cfgErr) throw new HttpError(500, 'INTERNAL', `Config fetch failed: ${cfgErr.message}`);

    // ownerEmail is irrelevant here (prompt only needs id/name/description/audience).
    const products = ((productRows ?? []) as ProductRow[]).map((r) => rowToProduct(r));
    if (products.length === 0) {
      throw new HttpError(500, 'INTERNAL', 'No active products configured');
    }
    const brand = (cfgRow?.brand ?? 'google') as 'google' | 'aws';

    // Parse chain from DB; fall back to defaults if DB value is malformed.
    const parsedChain = LlmChainSchema.safeParse(cfgRow?.llm_chain);
    const chain: LlmChain = parsedChain.success ? parsedChain.data : DEFAULT_LLM_CHAIN;
    const temperature =
      typeof cfgRow?.temperature === 'number' ? cfgRow.temperature : DEFAULT_TEMPERATURE;

    const prompt = buildRecommendationPrompt({ products, userInput, lang, brand });
    const activeProductIds = products.map((p) => p.id);

    // Walk the chain top → bottom. Each item gets one shot; overload/quota falls through.
    // Skipped: disabled items, providers with no API key in env, known fatal errors.
    const trace: Array<{ providerId: string; model: string; outcome: string }> = [];
    let rawText: string | undefined;
    let lastFailure = 'No provider configured';

    for (const item of chain) {
      if (!item.enabled) continue;
      const provider = providers[item.providerId];
      if (!provider) {
        trace.push({ providerId: item.providerId, model: item.model, outcome: 'unknown_provider' });
        continue;
      }
      if (!provider.isConfigured()) {
        trace.push({ providerId: item.providerId, model: item.model, outcome: 'no_api_key' });
        continue;
      }
      const result = await provider.generate(item.model, {
        prompt,
        activeProductIds,
        temperature,
      });
      if (result.ok) {
        rawText = result.rawText;
        trace.push({ providerId: item.providerId, model: item.model, outcome: 'success' });
        break;
      }
      lastFailure = `${item.providerId}/${item.model}: ${result.message}`;
      trace.push({ providerId: item.providerId, model: item.model, outcome: result.kind });
      if (result.kind === 'fatal') {
        // Fatal isn't retryable on the same provider, but we still want to try the next
        // entry — e.g., auth error on Gemini shouldn't block Kimi. So continue.
        continue;
      }
    }

    if (!rawText) {
      throw new HttpError(502, 'LLM_CALL_FAILED', lastFailure, { trace });
    }

    let rawObj: unknown;
    try {
      rawObj = JSON.parse(rawText);
    } catch {
      throw new HttpError(502, 'AI_PARSE', 'Model returned non-JSON', { rawText, trace });
    }

    const valid = SolutionSchema.safeParse(rawObj);
    if (!valid.success) {
      throw new HttpError(502, 'AI_INVALID', 'Model output schema mismatch', {
        issues: valid.error.issues,
        trace,
      });
    }

    const activeIds = new Set(activeProductIds);
    const ids = valid.data.selectedProducts;
    if (!ids.every((x) => activeIds.has(x))) {
      throw new HttpError(502, 'AI_INVALID', 'Returned id not in active product catalog', {
        ids,
        trace,
      });
    }

    const rationale: Record<string, string> = {};
    for (const id of ids) {
      const r = valid.data.rationale[id];
      rationale[id] = typeof r === 'string' ? r : '';
    }

    const response: GenerateResponse = { selectedProducts: ids, rationale };
    res.json(response);
  } catch (err) {
    next(err);
  }
});
