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
  AdminLoginResponse,
  Brand,
  GenerateResponse,
  Lang,
  LlmChain,
  LlmProviderId,
  ProductItem,
  SttResponse,
} from '@asb/shared';

import { apiFetch, setToken } from './api';

// ───────────────────────────────
// Query keys
// ───────────────────────────────
export const queryKeys = {
  products: ['products'] as const,
  brand: ['brand'] as const,
  llmChain: ['llm-chain'] as const,
};

// ───────────────────────────────
// Products
// ───────────────────────────────
export function useProductsQuery(): UseQueryResult<ProductItem[]> {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: () => apiFetch<ProductItem[]>('/products'),
    // Stale fast — user might add products in admin and expect immediate refetch
    staleTime: 10_000,
  });
}

export function useUpsertProductMutation(): UseMutationResult<
  ProductItem,
  Error,
  { mode: 'create' | 'update'; product: Omit<ProductItem, 'createdAt' | 'updatedAt'> }
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
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.products }),
  });
}

export function useDeleteProductMutation(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await apiFetch<void>(`/products/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.products }),
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
    queryFn: () => apiFetch<BrandResponse>('/brand'),
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

export function useLlmChainQuery(): UseQueryResult<LlmChainResponse> {
  return useQuery({
    queryKey: queryKeys.llmChain,
    queryFn: () => apiFetch<LlmChainResponse>('/llm-chain'),
    staleTime: 30_000,
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
// Admin login
// ───────────────────────────────
export function useAdminLoginMutation(): UseMutationResult<AdminLoginResponse, Error, string> {
  return useMutation({
    mutationFn: async (password) => {
      const resp = await apiFetch<AdminLoginResponse>('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setToken(resp.token);
      return resp;
    },
  });
}
