// ───────────────────────────────────────────
// Thin fetch wrapper: injects the current Supabase access_token as a Bearer
// token, returns typed JSON, surfaces structured ApiError for the UI layer.
//
// Token source of truth: Supabase Auth client (persistSession: true).
// We deliberately don't mirror it into localStorage — the SDK already does
// that; duplicating invites drift.
// ───────────────────────────────────────────

import type { ApiError } from '@asb/shared';

import { getSupabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export class ApiCallError extends Error {
  constructor(public readonly error: ApiError, public readonly status: number) {
    super(error.message);
  }
}

async function currentAccessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = await currentAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const resp = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (resp.status === 204) return undefined as T;

  if (!resp.ok) {
    let payload: ApiError;
    try {
      payload = (await resp.json()) as ApiError;
    } catch {
      payload = { code: 'INTERNAL', message: `HTTP ${resp.status}` };
    }
    throw new ApiCallError(payload, resp.status);
  }

  return (await resp.json()) as T;
}
