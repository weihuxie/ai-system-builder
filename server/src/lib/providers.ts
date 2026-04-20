import { Type, type Schema } from '@google/genai';

import type { LlmProviderId } from '@asb/shared';

import { getGemini } from './gemini.js';

// Unified provider result: either text or a typed error.
// kind='overload' → transient (503/429), caller may fall through to next provider.
// kind='fatal' → terminal (auth, validation, 5xx unknown), still falls through but surfaces msg.
// kind='disabled' → provider not usable in this env (e.g. no API key).
export type ProviderResult =
  | { ok: true; rawText: string }
  | { ok: false; kind: 'overload' | 'fatal' | 'disabled'; message: string };

export interface GenerateArgs {
  prompt: string;
  activeProductIds: string[];
  temperature: number;
}

export interface LlmProvider {
  id: LlmProviderId;
  /** True if provider has what it needs to run (API key, etc.) */
  isConfigured(): boolean;
  generate(model: string, args: GenerateArgs): Promise<ProviderResult>;
}

// ───────────────────────────────────────────
// Gemini provider (native responseSchema with dynamic rationale keys)
// ───────────────────────────────────────────

function buildGeminiSchema(activeIds: string[]): Schema {
  const rationaleProperties: Record<string, Schema> = {};
  for (const id of activeIds) {
    rationaleProperties[id] = {
      type: Type.STRING,
      description: `2-3 sentence reason for recommending ${id} (only fill when selected).`,
    };
  }
  return {
    type: Type.OBJECT,
    properties: {
      selectedProducts: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        minItems: '3',
        maxItems: '3',
        description: 'Exactly 3 product IDs from the provided list.',
      },
      rationale: {
        type: Type.OBJECT,
        properties: rationaleProperties,
        description: "Map of productId → 2-3 sentence reason in the user's language.",
      },
    },
    required: ['selectedProducts', 'rationale'],
  };
}

export const geminiProvider: LlmProvider = {
  id: 'gemini',
  isConfigured: () => Boolean(process.env.GEMINI_API_KEY),
  async generate(model, { prompt, activeProductIds, temperature }) {
    try {
      const ai = getGemini();
      const resp = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: buildGeminiSchema(activeProductIds),
          temperature,
        },
      });
      const text = resp.text;
      if (!text) return { ok: false, kind: 'fatal', message: 'Empty response from Gemini' };
      return { ok: true, rawText: text };
    } catch (e) {
      const msg = (e as Error).message || '';
      const overload = /UNAVAILABLE|503|429|RESOURCE_EXHAUSTED|high demand|quota/i.test(msg);
      return { ok: false, kind: overload ? 'overload' : 'fatal', message: msg };
    }
  },
};

// ───────────────────────────────────────────
// Kimi / Moonshot provider (OpenAI-compatible, JSON mode via response_format)
// Endpoint: https://api.moonshot.cn/v1 — keys issued on platform.moonshot.cn
// (the console most users register against) only work against this host.
// The api.moonshot.ai host exists but is a separate issuing domain that
// returns 401 "Invalid Authentication" for .cn-issued keys.
// ───────────────────────────────────────────

const KIMI_ENDPOINT = 'https://api.moonshot.cn/v1/chat/completions';

export const kimiProvider: LlmProvider = {
  id: 'kimi',
  isConfigured: () => Boolean(process.env.KIMI_API_KEY),
  async generate(model, { prompt, activeProductIds, temperature }) {
    const apiKey = process.env.KIMI_API_KEY;
    if (!apiKey) return { ok: false, kind: 'disabled', message: 'KIMI_API_KEY not configured' };

    // Kimi supports OpenAI-style JSON mode but not open-ended JSON schema.
    // So we inject an explicit output contract into the prompt and then rely
    // on response_format=json_object to guarantee syntactically valid JSON.
    const schemaHint = [
      '',
      'OUTPUT FORMAT (strict):',
      'Return a single JSON object with exactly two keys:',
      '  "selectedProducts": array of exactly 3 product IDs from this set: ' +
        activeProductIds.map((id) => `"${id}"`).join(', '),
      '  "rationale": object mapping each selected ID to a 2-3 sentence string reason',
      'Example shape: {"selectedProducts":["A","B","C"],"rationale":{"A":"...","B":"...","C":"..."}}',
      'Do NOT include any other keys, markdown, or commentary — JSON only.',
    ].join('\n');
    const fullPrompt = prompt + '\n' + schemaHint;

    try {
      const resp = await fetch(KIMI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: fullPrompt }],
          temperature,
          response_format: { type: 'json_object' },
        }),
      });
      if (!resp.ok) {
        const body = await resp.text();
        const overload = resp.status === 429 || resp.status === 503;
        return {
          ok: false,
          kind: overload ? 'overload' : 'fatal',
          message: `Kimi ${resp.status}: ${body.slice(0, 300)}`,
        };
      }
      const data = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content;
      if (!text) return { ok: false, kind: 'fatal', message: 'Empty response from Kimi' };
      return { ok: true, rawText: text };
    } catch (e) {
      return { ok: false, kind: 'fatal', message: (e as Error).message || 'Kimi fetch failed' };
    }
  },
};

// ───────────────────────────────────────────
// DeepSeek provider (OpenAI-compatible, JSON mode via response_format)
// Endpoint: https://api.deepseek.com/v1/chat/completions
// Global API, works from anywhere with a valid key from platform.deepseek.com.
// ───────────────────────────────────────────

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

export const deepseekProvider: LlmProvider = {
  id: 'deepseek',
  isConfigured: () => Boolean(process.env.DEEPSEEK_API_KEY),
  async generate(model, { prompt, activeProductIds, temperature }) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return { ok: false, kind: 'disabled', message: 'DEEPSEEK_API_KEY not configured' };

    const schemaHint = [
      '',
      'OUTPUT FORMAT (strict):',
      'Return a single JSON object with exactly two keys:',
      '  "selectedProducts": array of exactly 3 product IDs from this set: ' +
        activeProductIds.map((id) => `"${id}"`).join(', '),
      '  "rationale": object mapping each selected ID to a 2-3 sentence string reason',
      'Example shape: {"selectedProducts":["A","B","C"],"rationale":{"A":"...","B":"...","C":"..."}}',
      'Do NOT include any other keys, markdown, or commentary — JSON only.',
    ].join('\n');
    const fullPrompt = prompt + '\n' + schemaHint;

    try {
      const resp = await fetch(DEEPSEEK_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: fullPrompt }],
          temperature,
          response_format: { type: 'json_object' },
        }),
      });
      if (!resp.ok) {
        const body = await resp.text();
        const overload = resp.status === 429 || resp.status === 503;
        return {
          ok: false,
          kind: overload ? 'overload' : 'fatal',
          message: `DeepSeek ${resp.status}: ${body.slice(0, 300)}`,
        };
      }
      const data = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content;
      if (!text) return { ok: false, kind: 'fatal', message: 'Empty response from DeepSeek' };
      return { ok: true, rawText: text };
    } catch (e) {
      return { ok: false, kind: 'fatal', message: (e as Error).message || 'DeepSeek fetch failed' };
    }
  },
};

// ───────────────────────────────────────────
// Registry
// ───────────────────────────────────────────

export const providers: Record<LlmProviderId, LlmProvider> = {
  gemini: geminiProvider,
  kimi: kimiProvider,
  deepseek: deepseekProvider,
};
