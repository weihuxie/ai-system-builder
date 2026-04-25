// ───────────────────────────────────────────
// React Query hooks — ALL server I/O flows through here.
// Keeps cache keys + retry policy + optimistic updates in one spot.
// ───────────────────────────────────────────

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import type {
  AdminUser,
  AuthedUser,
  Brand,
  GenerateResponse,
  InviteUserRequest,
  Lang,
  LlmChain,
  LlmProviderId,
  ProductItem,
  SttResponse,
} from '@asb/shared';

import { ApiCallError, apiFetch } from './api';
import {
  readBrandCache,
  readProductsCache,
  writeBrandCache,
  writeProductsCache,
} from './offlineCache';

// ───────────────────────────────
// Query keys
// ───────────────────────────────
export const queryKeys = {
  products: ['products'] as const,
  /** Admin-scoped (auth + role filtered) products list. Distinct cache key
   *  from `products` because anon + admin views return different rowsets. */
  adminProducts: ['admin-products'] as const,
  brand: ['brand'] as const,
  llmChain: ['llm-chain'] as const,
  me: ['me'] as const,
  adminUsers: ['admin-users'] as const,
};

// ───────────────────────────────
// Products
// Offline fallback: initialData from localStorage cache (or DEFAULT_PRODUCTS
// bundled seed), and write-through on success. When the fetch errors, React
// Query keeps `data` as the initial (cached) value and sets `error` — UI shows
// OfflineBanner based on `error`, but the bottom product list is never blank.
// ───────────────────────────────
export function useProductsQuery(): UseQueryResult<ProductItem[]> {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: async () => {
      const data = await apiFetch<ProductItem[]>('/products');
      writeProductsCache(data);
      return data;
    },
    initialData: readProductsCache,
    initialDataUpdatedAt: 0, // treat as stale → refetch on mount
    staleTime: 10_000,
  });
}

// ───────────────────────────────
// Admin products query (auth + role filtered, no offline cache)
// Used by the admin /admin product list panel. Server enforces:
//   - super_admin → every row
//   - editor      → only rows they own
// Hitting this without a session 401s. No localStorage fallback because
// admin UX assumes online (and we don't want stale role-scoped data
// surviving a logout).
// ───────────────────────────────
export function useAdminProductsQuery(enabled: boolean): UseQueryResult<ProductItem[]> {
  return useQuery({
    queryKey: queryKeys.adminProducts,
    queryFn: () => apiFetch<ProductItem[]>('/products/admin'),
    enabled,
    staleTime: 10_000,
  });
}

export function useUpsertProductMutation(): UseMutationResult<
  ProductItem,
  Error,
  { mode: 'create' | 'update'; product: Omit<ProductItem, 'createdAt' | 'updatedAt' | 'ownerEmail'> }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ mode, product }) => {
      const path = mode === 'create' ? '/products' : `/products/${product.id}`;
      return apiFetch<ProductItem>(path, {
        method: mode === 'create' ? 'POST' : 'PUT',
        body: JSON.stringify(product),
      });
    },
    onSuccess: () => {
      // Invalidate BOTH the public catalog (homepage) AND the admin scoped list.
      // Skipping adminProducts would leave the editor's UI stale after their own edits.
      qc.invalidateQueries({ queryKey: queryKeys.products });
      qc.invalidateQueries({ queryKey: queryKeys.adminProducts });
    },
  });
}

export function useDeleteProductMutation(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await apiFetch<void>(`/products/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      // Invalidate BOTH the public catalog (homepage) AND the admin scoped list.
      // Skipping adminProducts would leave the editor's UI stale after their own edits.
      qc.invalidateQueries({ queryKey: queryKeys.products });
      qc.invalidateQueries({ queryKey: queryKeys.adminProducts });
    },
  });
}

export function useCloneProductMutation(): UseMutationResult<ProductItem, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      apiFetch<ProductItem>(`/products/${id}/clone`, { method: 'POST' }),
    onSuccess: () => {
      // Invalidate BOTH the public catalog (homepage) AND the admin scoped list.
      // Skipping adminProducts would leave the editor's UI stale after their own edits.
      qc.invalidateQueries({ queryKey: queryKeys.products });
      qc.invalidateQueries({ queryKey: queryKeys.adminProducts });
    },
  });
}

// ───────────────────────────────
// Brand
// ───────────────────────────────
interface BrandResponse {
  brand: Brand;
  updatedAt: string;
}

export function useBrandQuery(): UseQueryResult<BrandResponse> {
  return useQuery({
    queryKey: queryKeys.brand,
    queryFn: async () => {
      const data = await apiFetch<BrandResponse>('/brand');
      writeBrandCache(data);
      return data;
    },
    initialData: readBrandCache,
    initialDataUpdatedAt: 0,
    staleTime: 30_000,
  });
}

export function useSetBrandMutation(): UseMutationResult<BrandResponse, Error, Brand> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (brand) =>
      apiFetch<BrandResponse>('/brand', { method: 'PUT', body: JSON.stringify({ brand }) }),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.brand, data);
    },
  });
}

// ───────────────────────────────
// Generate (AI recommendation)
// ───────────────────────────────
export function useGenerateMutation(): UseMutationResult<
  GenerateResponse,
  Error,
  { userInput: string; lang: Lang }
> {
  return useMutation({
    mutationFn: (payload) =>
      apiFetch<GenerateResponse>('/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  });
}

// ───────────────────────────────
// STT
// ───────────────────────────────
export function useSttMutation(): UseMutationResult<
  SttResponse,
  Error,
  { audio: Blob; lang: Lang }
> {
  return useMutation({
    mutationFn: async ({ audio, lang }) => {
      const fd = new FormData();
      fd.append('audio', audio, 'recording.webm');
      fd.append('lang', lang);
      return apiFetch<SttResponse>('/stt', { method: 'POST', body: fd });
    },
  });
}

// ───────────────────────────────
// LLM chain (admin-only)
// ───────────────────────────────
export interface LlmChainResponse {
  chain: LlmChain;
  temperature: number;
  updatedAt: string | null;
  configured: Record<LlmProviderId, boolean>;
}

export function useLlmChainQuery(enabled = true): UseQueryResult<LlmChainResponse> {
  return useQuery({
    queryKey: queryKeys.llmChain,
    queryFn: () => apiFetch<LlmChainResponse>('/llm-chain'),
    staleTime: 30_000,
    enabled,
  });
}

export function useSetLlmChainMutation(): UseMutationResult<
  LlmChainResponse,
  Error,
  { chain: LlmChain; temperature?: number }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      apiFetch<LlmChainResponse>('/llm-chain', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.llmChain, (prev: LlmChainResponse | undefined) => ({
        ...data,
        configured: prev?.configured ?? { gemini: false, kimi: false, deepseek: false },
      }));
    },
  });
}

// ───────────────────────────────
// Current user (GET /admin/me)
// `enabled` flag is set by AdminPage once a Supabase session is present.
// Returns null if the signed-in Gmail isn't whitelisted (NOT_WHITELISTED 403).
// ───────────────────────────────
export function useMeQuery(enabled: boolean): UseQueryResult<AuthedUser | null> {
  return useQuery({
    queryKey: queryKeys.me,
    enabled,
    retry: false,
    queryFn: async () => {
      try {
        return await apiFetch<AuthedUser>('/admin/me');
      } catch (e) {
        if (e instanceof ApiCallError && e.error.code === 'NOT_WHITELISTED') return null;
        throw e;
      }
    },
  });
}

// ───────────────────────────────
// Admin users (super_admin only)
// ───────────────────────────────
export function useAdminUsersQuery(enabled: boolean): UseQueryResult<AdminUser[]> {
  return useQuery({
    queryKey: queryKeys.adminUsers,
    enabled,
    queryFn: () => apiFetch<AdminUser[]>('/admin/users'),
  });
}

// POST /admin/users returns AdminUser + a one-time invite/login URL the
// super_admin shares manually (Lark/WeChat/SMS — see server/src/routes/admin.ts
// for why no email). `inviteLink` is null when APP_URL is unset (local dev).
// `inviteEmailSent` retained as deprecated alias (always false) so older cached
// clients don't crash; remove next refactor.
export type InviteUserResult = AdminUser & {
  inviteLink: string | null;
  /** @deprecated Always false now — link is returned via inviteLink instead. */
  inviteEmailSent: boolean;
};

export function useInviteUserMutation(): UseMutationResult<InviteUserResult, Error, InviteUserRequest> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      apiFetch<InviteUserResult>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminUsers }),
  });
}

export function useRevokeUserMutation(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email) => {
      await apiFetch<void>(`/admin/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminUsers }),
  });
}
