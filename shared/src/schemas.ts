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

// Per-brand × per-lang URL map. See types.ts BrandLangMap for the rationale.
export const BrandLangMapSchema = z.object({
  google: LangMapSchema,
  aws: LangMapSchema,
});

export const ProductItemSchema = z.object({
  id: z.string().min(1).max(64),
  name: LangMapSchema,
  description: LangMapSchema,
  audience: LangMapSchema,
  url: BrandLangMapSchema,
  isParticipating: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  ownerId: z.string().uuid().nullable(),
  ownerEmail: z.string().email().nullable(),
  // Industry tags (migration 0005). Loose validation: array of short strings,
  // up to 20 entries. UI suggests from ALL_INDUSTRIES dictionary but the
  // schema doesn't z.enum() it — lets editors add new IDs without a code
  // change while keeping basic shape integrity.
  industries: z.array(z.string().min(1).max(50)).max(20).optional(),
});

// ownerEmail is server-computed (left-join admin_users); never accepted from client.
// ownerId is optional on input — editor: server forces to req.user.id;
// super_admin: may pass explicit uuid to reassign.
export const ProductItemInputSchema = ProductItemSchema.omit({
  createdAt: true,
  updatedAt: true,
  ownerEmail: true,
}).extend({
  ownerId: z.string().uuid().nullable().optional(),
});

export const LlmProviderIdSchema = z.enum(['gemini', 'kimi', 'deepseek']);

export const LlmChainItemSchema = z.object({
  providerId: LlmProviderIdSchema,
  model: z.string().min(1).max(128),
  enabled: z.boolean(),
});

export const LlmChainSchema = z.array(LlmChainItemSchema).max(10);

// Quick scenarios — admin-editable list of pre-canned demo prompts. Each
// language has its own array (typically 4-12 items). Capped at 20 per lang
// so the homepage 2-col grid doesn't scroll forever.
export const QuickOptionSchema = z.object({
  role: z.string().min(1).max(80),
  industry: z.string().min(1).max(80),
  challenge: z.string().min(1).max(500),
  productIds: z.array(z.string().min(1).max(64)).max(8).optional(),
});
export const QuickOptionsByLangSchema = z.object({
  'zh-CN': z.array(QuickOptionSchema).max(20),
  'zh-HK': z.array(QuickOptionSchema).max(20),
  en: z.array(QuickOptionSchema).max(20),
  ja: z.array(QuickOptionSchema).max(20),
});

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

export const UserRoleSchema = z.enum(['editor', 'super_admin']);

export const AdminUserSchema = z.object({
  email: z.string().email().max(254),
  userId: z.string().uuid().nullable(),
  role: UserRoleSchema,
  invitedAt: z.string(),
  activatedAt: z.string().nullable(),
  invitedBy: z.string().uuid().nullable(),
});

export const InviteUserRequestSchema = z.object({
  email: z.string().email().max(254),
  role: UserRoleSchema,
});

export const AuthedUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: UserRoleSchema,
});

export const ApiErrorCodeSchema = z.enum([
  'LLM_REQUIRED',
  'LLM_CALL_FAILED',
  'AI_PARSE',
  'AI_INVALID',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_WHITELISTED',
  'OWNERSHIP_REQUIRED',
  'VALIDATION',
  'NOT_FOUND',
  'CONFLICT',
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
