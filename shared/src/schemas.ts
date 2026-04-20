// ───────────────────────────────────────────
// Zod runtime validation schemas
// Use these at EVERY trust boundary:
//   - API request parsing (server side)
//   - AI output parsing (server side)
//   - localStorage/sessionStorage reads (client side)
// ───────────────────────────────────────────

import { z } from 'zod';
import type { Lang, Brand } from './types.js';

export const LangSchema = z.enum(['zh-CN', 'zh-HK', 'en', 'ja']);
export const BrandSchema = z.enum(['google', 'aws']);

export const LangMapSchema = z.object({
  'zh-CN': z.string(),
  'zh-HK': z.string(),
  en: z.string(),
  ja: z.string(),
});

export const BrandMapSchema = z.object({
  google: z.string(),
  aws: z.string(),
});

export const ProductItemSchema = z.object({
  id: z.string().min(1).max(64),
  name: LangMapSchema,
  description: LangMapSchema,
  audience: LangMapSchema,
  url: BrandMapSchema,
  isParticipating: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ProductItemInputSchema = ProductItemSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export const LlmProviderIdSchema = z.enum(['gemini', 'kimi', 'deepseek']);

export const LlmChainItemSchema = z.object({
  providerId: LlmProviderIdSchema,
  model: z.string().min(1).max(128),
  enabled: z.boolean(),
});

export const LlmChainSchema = z.array(LlmChainItemSchema).max(10);

export const GlobalConfigSchema = z.object({
  brand: BrandSchema,
  llmChain: LlmChainSchema,
  temperature: z.number().min(0).max(2),
  updatedAt: z.string(),
  updatedBy: z.string().nullable(),
});

export const GenerateRequestSchema = z.object({
  userInput: z.string().min(1).max(2000),
  lang: LangSchema,
});

/**
 * Solution schema — the *contract* we enforce on Gemini output.
 * Note: rationale is validated loosely (Gemini's responseSchema support for
 * open-keyed objects is incomplete). Server does additional filtering.
 */
export const SolutionSchema = z.object({
  selectedProducts: z.array(z.string().min(1)).length(3),
  rationale: z.record(z.string(), z.string()).default({}),
});

export const AdminLoginRequestSchema = z.object({
  password: z.string().min(1).max(128),
});

export const ApiErrorCodeSchema = z.enum([
  'LLM_REQUIRED',
  'LLM_CALL_FAILED',
  'AI_PARSE',
  'AI_INVALID',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'VALIDATION',
  'NOT_FOUND',
  'RATE_LIMITED',
  'INTERNAL',
]);

export const ApiErrorSchema = z.object({
  code: ApiErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
});

// Helper: narrow unknown → typed
export function isLang(x: unknown): x is Lang {
  return LangSchema.safeParse(x).success;
}
export function isBrand(x: unknown): x is Brand {
  return BrandSchema.safeParse(x).success;
}
