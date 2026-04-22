// ───────────────────────────────────────────
// Whisper STT —— Gemini STT 的 last-ditch fallback
//
// 为什么存在：
//   CLAUDE.md §2.4 约定"某语言（可能是日语）不达标时后端切 Whisper，
//   前端无感"。东京场日语输入是主通道，Gemini 2.5 Flash 在日语 STT
//   上偶尔返回空或漂移；Whisper（OpenAI）在日语上更稳。
//
// 接入哲学：
//   - 不强制依赖：没配 OPENAI_API_KEY → isConfigured() 返回 false，
//     /api/stt 走原 Gemini 单通道，0 regression
//   - 配了 key → /api/stt 在 Gemini 失败/空结果时自动落到 Whisper
//   - 不在路由里暴露选择逻辑，保持讲师 UI 无感
//
// API 契约：OpenAI /v1/audio/transcriptions
//   - multipart/form-data，model=whisper-1
//   - language 用 ISO-639-1（zh-CN → zh, zh-HK → zh, ja → ja, en → en）
// ───────────────────────────────────────────

import type { Lang } from '@asb/shared';

import { STT_TIMEOUT_MS, isAbortOrTimeoutError } from './timeout.js';

const WHISPER_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';

export type WhisperResult =
  | { ok: true; text: string }
  | { ok: false; kind: 'disabled' | 'overload' | 'fatal'; message: string };

export function isWhisperConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function toWhisperLang(lang: Lang): string {
  // Whisper 用 ISO-639-1 单 code；zh-CN / zh-HK 都压成 zh
  if (lang.startsWith('zh')) return 'zh';
  return lang;
}

export async function whisperTranscribe(args: {
  audio: Buffer;
  mimeType: string;
  lang: Lang;
}): Promise<WhisperResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, kind: 'disabled', message: 'OPENAI_API_KEY not configured' };
  }

  const form = new FormData();
  // Whisper 按后缀推断格式；webm/opus 在 OpenAI 的支持列表里
  const filename = args.mimeType.includes('webm') ? 'audio.webm' : 'audio.mp3';
  form.append('file', new Blob([args.audio], { type: args.mimeType }), filename);
  form.append('model', 'whisper-1');
  form.append('language', toWhisperLang(args.lang));
  // 让返回更结构化：只要 text，不要 verbose_json（避免我们后续多解析一层）
  form.append('response_format', 'text');

  try {
    const resp = await fetch(WHISPER_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(STT_TIMEOUT_MS),
    });
    if (!resp.ok) {
      const body = await resp.text();
      const overload = resp.status === 429 || resp.status === 503;
      return {
        ok: false,
        kind: overload ? 'overload' : 'fatal',
        message: `Whisper ${resp.status}: ${body.slice(0, 300)}`,
      };
    }
    // response_format=text 直接返回纯文本，不是 JSON
    const text = (await resp.text()).trim();
    if (!text) return { ok: false, kind: 'fatal', message: 'Empty response from Whisper' };
    return { ok: true, text };
  } catch (e) {
    const msg = (e as Error).message || 'Whisper fetch failed';
    if (isAbortOrTimeoutError(e)) {
      return { ok: false, kind: 'overload', message: `Whisper timeout after ${STT_TIMEOUT_MS}ms` };
    }
    return { ok: false, kind: 'fatal', message: msg };
  }
}
