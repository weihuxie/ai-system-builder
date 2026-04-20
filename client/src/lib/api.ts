// ───────────────────────────────────────────
// Thin fetch wrapper: injects JWT from sessionStorage, returns typed JSON,
// surfaces structured ApiError for the UI layer.
// ───────────────────────────────────────────

import type { ApiError } from '@asb/shared';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const JWT_STORAGE_KEY = 'asb.jwt';

export class ApiCallError extends Error {
  constructor(public readonly error: ApiError, public readonly status: number) {
    super(error.message);
  }
}

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(JWT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(JWT_STORAGE_KEY, token);
    else sessionStorage.removeItem(JWT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const resp = await fetch(`${API_BASE}${path}`, { ...init, headers });

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
