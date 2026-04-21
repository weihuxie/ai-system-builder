// ───────────────────────────────────────────
// Core domain types (shared between client & server)
// Authoritative source; do NOT redefine in client/ or server/.
// ───────────────────────────────────────────

export type Lang = 'zh-CN' | 'zh-HK' | 'en' | 'ja';
export const ALL_LANGS: readonly Lang[] = ['zh-CN', 'zh-HK', 'en', 'ja'] as const;

export type Brand = 'google' | 'aws';
export const ALL_BRANDS: readonly Brand[] = ['google', 'aws'] as const;

export type LangMap = Record<Lang, string>;
export type BrandMap = Record<Brand, string>;

// ───────────────────────────────────────────
// Product
// ───────────────────────────────────────────

export interface ProductItem {
  id: string;
  name: LangMap;
  description: LangMap;
  audience: LangMap;
  url: BrandMap; // { google: '...', aws: '...' }
  isParticipating: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  // Ownership (0002 migration). NULL for legacy rows / deleted users = 孤儿池
  // (super_admin only). ownerEmail is denormalized on read via left-join.
  ownerId: string | null;
  ownerEmail: string | null;
}

// ───────────────────────────────────────────
// Quick scenario card (3-part: role / industry / challenge)
// ───────────────────────────────────────────

export interface QuickOption {
  role: string;
  industry: string;
  challenge: string;
}

// ───────────────────────────────────────────
// LLM provider chain (admin-editable, stored in global_config.llm_chain)
// Order = fallback priority. `enabled: false` entries are skipped at runtime.
// Keys (API keys) are NOT stored here — they live in server env vars per provider.
// ───────────────────────────────────────────

export type LlmProviderId = 'gemini' | 'kimi' | 'deepseek';
export const ALL_LLM_PROVIDERS: readonly LlmProviderId[] = ['gemini', 'kimi', 'deepseek'] as const;

export interface LlmChainItem {
  providerId: LlmProviderId;
  model: string;
  enabled: boolean;
}

export type LlmChain = LlmChainItem[];

// Model suggestions surfaced in the admin UI dropdown. Users may also type custom ones.
// Note: `kimi-latest` requires paid-tier access on platform.moonshot.cn; `moonshot-v1-32k`
// is the widely-available standard model, so it leads the Kimi list.
export const LLM_MODEL_PRESETS: Record<LlmProviderId, readonly string[]> = {
  gemini: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  kimi: ['moonshot-v1-32k', 'moonshot-v1-128k', 'moonshot-v1-8k', 'kimi-latest', 'kimi-k2-turbo-preview'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
};

// ───────────────────────────────────────────
// Global config (single row in DB)
// ───────────────────────────────────────────

export interface GlobalConfig {
  brand: Brand;
  llmChain: LlmChain;
  temperature: number;
  updatedAt: string;
  updatedBy: string | null;
}

// ───────────────────────────────────────────
// AI recommendation output
// ───────────────────────────────────────────

export interface Solution {
  selectedProducts: string[]; // length === 3, ids must be in activeProducts
  rationale: Record<string, string>; // key = productId, value = reason in user's language
}

// ───────────────────────────────────────────
// API request/response shapes
// ───────────────────────────────────────────

export interface GenerateRequest {
  userInput: string;
  lang: Lang;
}

export interface GenerateResponse extends Solution {}

export interface SttRequest {
  // multipart/form-data: { audio: Blob, lang: Lang }
  lang: Lang;
}

export interface SttResponse {
  text: string;
}

// Admin user role. editor = 只管自己名下的产品；super_admin = 全产品 + LLM 链 + Brand 切换
export type UserRole = 'editor' | 'super_admin';
export const ALL_USER_ROLES: readonly UserRole[] = ['editor', 'super_admin'] as const;

// Whitelist row (matches admin_users table). userId is null until first OAuth login.
export interface AdminUser {
  email: string;
  userId: string | null;
  role: UserRole;
  invitedAt: string;
  activatedAt: string | null;
  invitedBy: string | null;
}

// Current logged-in identity returned by GET /admin/me
export interface AuthedUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface InviteUserRequest {
  email: string;
  role: UserRole;
}

export interface GeoResponse {
  country: string | null; // ISO 3166-1 alpha-2, e.g. 'CN', 'HK', 'JP'; null if lookup fails
  lang: Lang; // resolved language from country (or fallback 'en')
}

// ───────────────────────────────────────────
// Structured API errors (always include `code`)
// ───────────────────────────────────────────

export type ApiErrorCode =
  | 'LLM_REQUIRED'
  | 'LLM_CALL_FAILED'
  | 'AI_PARSE'
  | 'AI_INVALID'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_WHITELISTED' // valid Google login but email not in admin_users
  | 'OWNERSHIP_REQUIRED' // editor tried to modify a product they don't own
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT' // e.g. clone id collision after exhausting suffixes
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

// ───────────────────────────────────────────
// Brand theme (frontend-only const, exported for type-safety)
// ───────────────────────────────────────────

export interface BrandTheme {
  id: Brand;
  logoUrl: string;
  headerTitle: LangMap;
  accent: string;
  accentMuted: string;
}
