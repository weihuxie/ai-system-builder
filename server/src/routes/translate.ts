// ───────────────────────────────────────────
// 产品多语言翻译 — POST /api/admin/translate/product
//
// admin (editor / super_admin) 在 ProductEditor 填好简中后一键翻其他 3 lang。
// 复用现有 LLM chain（gemini→kimi→deepseek 之类，admin 在 LlmChainConfig 配的）+
// 限速器跟 /api/generate 共享同款（10/min/IP）。
//
// 设计决策（跟用户对齐过）：
//   A1: 复用 chain，不接专用翻译 API
//   D2: prompt 写规则告诉 LLM 保留缩写
//   E2: 部分成功也写入 — 服务端尽量返完整 translations，failed[] 列出哪个 lang 漏了
//   F1: source lang 写死 zh-CN，不接受 sourceLang 参数
// ───────────────────────────────────────────

import { Router } from 'express';

import {
  type LlmChain,
  LlmChainSchema,
  DEFAULT_LLM_CHAIN,
  TranslateProductRequestSchema,
  type TranslateProductResponse,
  type TranslateTargetLang,
  type TranslatedFields,
} from '@asb/shared';

import { logEvent, newTraceId } from '../lib/logger.js';
import { providers } from '../lib/providers.js';
import { getSupabase } from '../lib/supabase.js';
import { adminChain } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { buildTranslatePrompt } from '../lib/translatePrompt.js';

export const translateRouter = Router();

const TARGET_LANGS = ['zh-HK', 'en', 'ja'] as const satisfies readonly TranslateTargetLang[];

// shape guard for one lang's translated fields — strings only, all three present
function asTranslatedFields(v: unknown): TranslatedFields | null {
  if (!v || typeof v !== 'object') return null;
  const obj = v as Record<string, unknown>;
  if (typeof obj.name !== 'string') return null;
  if (typeof obj.description !== 'string') return null;
  if (typeof obj.audience !== 'string') return null;
  return { name: obj.name, description: obj.description, audience: obj.audience };
}

translateRouter.post('/product', ...adminChain, async (req, res, next) => {
  const traceId = newTraceId();
  const startedAt = performance.now();
  try {
    const parsed = TranslateProductRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid translate request', parsed.error.issues);
    }
    const fields = parsed.data.fields;

    // Read admin-configured chain from global_config (same source generate.ts uses).
    const supabase = getSupabase();
    const { data: cfgRow, error: cfgErr } = await supabase
      .from('global_config')
      .select('llm_chain')
      .eq('id', 1)
      .single();
    if (cfgErr) {
      throw new HttpError(500, 'INTERNAL', `Config fetch failed: ${cfgErr.message}`);
    }
    const parsedChain = LlmChainSchema.safeParse(cfgRow?.llm_chain);
    const chain: LlmChain = parsedChain.success ? parsedChain.data : DEFAULT_LLM_CHAIN;

    const prompt = buildTranslatePrompt(fields);

    // Walk chain top → bottom, same shape as generate.ts. Lower temperature
    // for translation (0.3) — we want consistent, faithful output, not
    // creative variation.
    const trace: Array<{ providerId: string; model: string; outcome: string }> = [];
    let rawText: string | undefined;
    let providerId: string | undefined;
    let model: string | undefined;
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
        // translate doesn't constrain output to a product set; pass empty so
        // Kimi/DeepSeek schemaHint generates a "0 products" hint but JSON mode
        // still works. Gemini uses responseSchema based on activeProductIds —
        // empty list → no per-product properties in schema, which is wrong
        // for translate. So we pass placeholder list and rely on parsing
        // below to extract our shape (not the generate Solution shape).
        // Net: providers always JSON-mode, we re-parse loosely.
        activeProductIds: ['_t_zhHK', '_t_en', '_t_ja'],
        temperature: 0.3,
      });
      if (result.ok) {
        rawText = result.rawText;
        providerId = item.providerId;
        model = item.model;
        trace.push({ providerId: item.providerId, model: item.model, outcome: 'success' });
        break;
      }
      lastFailure = `${item.providerId}/${item.model}: ${result.message}`;
      trace.push({ providerId: item.providerId, model: item.model, outcome: result.kind });
    }

    if (!rawText) {
      throw new HttpError(502, 'LLM_CALL_FAILED', lastFailure, { trace });
    }

    // Parse the LLM's JSON output. Tolerant: if any single lang is malformed,
    // we still ship the langs that parsed correctly (E2 partial-success).
    let rawObj: unknown;
    try {
      rawObj = JSON.parse(rawText);
    } catch {
      throw new HttpError(502, 'AI_PARSE', 'Model returned non-JSON', { rawText, trace });
    }

    const translations: TranslateProductResponse['translations'] = {};
    const failed: TranslateTargetLang[] = [];
    for (const lang of TARGET_LANGS) {
      const candidate = asTranslatedFields((rawObj as Record<string, unknown>)?.[lang]);
      if (candidate) {
        translations[lang] = candidate;
      } else {
        failed.push(lang);
      }
    }

    // Hard fail only if NOTHING parsed — otherwise E2 partial is OK
    if (failed.length === TARGET_LANGS.length) {
      throw new HttpError(502, 'AI_INVALID', 'Model output missing all target langs', {
        rawText,
        trace,
      });
    }

    const latencyMs = Math.round(performance.now() - startedAt);
    logEvent('translate_success', {
      traceId,
      latencyMs,
      provider: providerId,
      model,
      failedCount: failed.length,
      failedLangs: failed,
      trace,
    });

    const body: TranslateProductResponse = {
      translations,
      failed,
      provider: providerId as TranslateProductResponse['provider'],
      model,
      latencyMs,
    };
    res.json(body);
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startedAt);
    if (err instanceof HttpError) {
      logEvent('translate_failed', {
        traceId,
        latencyMs,
        status: err.status,
        code: err.code,
        message: err.message,
      });
    } else {
      logEvent('translate_failed', {
        traceId,
        latencyMs,
        code: 'UNKNOWN',
        message: (err as Error)?.message ?? String(err),
      });
    }
    next(err);
  }
});
