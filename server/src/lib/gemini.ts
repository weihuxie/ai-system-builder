import { GoogleGenAI } from '@google/genai';

import { HttpError } from '../middleware/errors.js';

let _client: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, 'LLM_REQUIRED', 'GEMINI_API_KEY not configured');
  }
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

// Model IDs — centralized so PRs can swap/A-B test without hunting across code.
// NOTE: Gemini 2.5 Pro requires paid tier (free tier quota = 0 as of 2026-04).
// Flash is used for both to keep demo on free tier; upgrade to 'gemini-2.5-pro'
// for recommend once billing is enabled on the GCP project.
// Fallback chain: try first, on 503/UNAVAILABLE drop to next.
// Observed on Vercel iad1 2026-04: Flash 2.5 frequently 503s with "high demand"
// even when direct laptop→API works; lite is less throttled.
export const GEMINI_MODELS = {
  recommend: 'gemini-2.5-flash',
  // gemini-2.0-flash free tier quota = 0; skip. Lite has its own quota + worse schema fidelity.
  recommendFallbacks: ['gemini-2.5-flash-lite'] as const,
  stt: 'gemini-2.5-flash',
} as const;
