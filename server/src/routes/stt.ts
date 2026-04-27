import { Router } from 'express';
import multer from 'multer';

import { LangSchema, type Lang, type SttResponse } from '@asb/shared';
import { HttpError } from '../middleware/errors.js';
import { GEMINI_MODELS, getGemini } from '../lib/gemini.js';
import { logEvent, newTraceId } from '../lib/logger.js';
import { isAbortOrTimeoutError, raceWithTimeout, STT_TIMEOUT_MS } from '../lib/timeout.js';
import { isWhisperConfigured, whisperTranscribe } from '../lib/whisper.js';

export const sttRouter = Router();

// 4 MB cap — Vercel Hobby has a 4.5 MB request body limit (includes headers + base64 overhead).
// Short mic recordings (webm/opus, ~10–20s) are typically 100–500 KB, so 4 MB is plenty.
// If we ever move off Vercel, this can go back up to 10 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

type SttAttempt = {
  provider: 'gemini' | 'whisper';
  outcome: 'success' | 'empty' | 'error';
  message?: string;
};

/**
 * Try Gemini first. Returns typed result instead of throwing, so caller can
 * decide whether to fall back to Whisper without tangling control flow.
 */
async function geminiStt(args: {
  audio: Buffer;
  mimeType: string;
  lang: Lang;
}): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  try {
    const ai = getGemini();
    const b64 = args.audio.toString('base64');
    const prompt = `Transcribe this audio recording to ${args.lang} text. Return plain text only, no extra commentary.`;

    const resp = await raceWithTimeout(
      ai.models.generateContent({
        model: GEMINI_MODELS.stt,
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }, { inlineData: { mimeType: args.mimeType, data: b64 } }],
          },
        ],
      }),
      STT_TIMEOUT_MS,
      'STT',
    );
    const text = resp.text?.trim();
    if (!text) return { ok: false, message: 'Empty STT result' };
    return { ok: true, text };
  } catch (e) {
    const msg = isAbortOrTimeoutError(e)
      ? `STT timeout after ${STT_TIMEOUT_MS}ms`
      : (e as Error).message;
    return { ok: false, message: msg };
  }
}

sttRouter.post('/', upload.single('audio'), async (req, res, next) => {
  const traceId = newTraceId();
  const startedAt = performance.now();
  let lang: Lang | undefined;
  let audioBytes = 0;
  const attempts: SttAttempt[] = [];
  try {
    if (!req.file) {
      throw new HttpError(400, 'VALIDATION', 'Missing audio file');
    }
    audioBytes = req.file.size;
    const langParsed = LangSchema.safeParse(req.body.lang);
    if (!langParsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid or missing lang field');
    }
    lang = langParsed.data;
    const mimeType = req.file.mimetype || 'audio/webm';

    // ── 1. Whisper (default primary) ──
    // Switched from Gemini-primary on 2026-04-26: Whisper handles noisy
    // multilingual audio (Summit venues are crowded) and zh/ja accents
    // measurably better than Gemini Flash STT, and OpenAI Asia edges have
    // tighter latency from our Asia user base. Gemini stays as fallback so
    // we don't lose the redundancy that the project's been getting away
    // with. If OPENAI_API_KEY is unset we skip directly to Gemini below
    // (e.g. local dev where the maintainer hasn't bothered with OpenAI).
    let primaryError: string = '';
    if (isWhisperConfigured()) {
      const wh = await whisperTranscribe({ audio: req.file.buffer, mimeType, lang });
      if (wh.ok) {
        attempts.push({ provider: 'whisper', outcome: 'success' });
        logEvent('stt_success', {
          traceId,
          latencyMs: Math.round(performance.now() - startedAt),
          lang,
          audioBytes,
          outputLen: wh.text.length,
          provider: 'whisper',
          model: 'whisper-1',
          attempts,
        });
        res.json({ text: wh.text } satisfies SttResponse);
        return;
      }
      attempts.push({ provider: 'whisper', outcome: 'error', message: wh.message });
      primaryError = wh.message;
    }

    // ── 2. Gemini STT (fallback) ──
    const gem = await geminiStt({ audio: req.file.buffer, mimeType, lang });
    if (gem.ok) {
      attempts.push({ provider: 'gemini', outcome: 'success' });
      logEvent('stt_success', {
        traceId,
        latencyMs: Math.round(performance.now() - startedAt),
        lang,
        audioBytes,
        outputLen: gem.text.length,
        provider: 'gemini',
        model: GEMINI_MODELS.stt,
        attempts,
      });
      res.json({ text: gem.text } satisfies SttResponse);
      return;
    }
    attempts.push({
      provider: 'gemini',
      outcome: /empty/i.test(gem.message) ? 'empty' : 'error',
      message: gem.message,
    });

    // 两家都挂了 → 前端拿到 LLM_CALL_FAILED。报错保留主通道的信息（whisper
    // 优先，没配 key 才退到 gemini 信息），让 trace 里能一眼看出谁先炸的。
    throw new HttpError(502, 'LLM_CALL_FAILED', primaryError || gem.message);
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startedAt);
    if (err instanceof HttpError) {
      logEvent('stt_failed', {
        traceId,
        latencyMs,
        status: err.status,
        code: err.code,
        message: err.message,
        lang,
        audioBytes,
        attempts,
      });
    } else {
      logEvent('stt_failed', {
        traceId,
        latencyMs,
        code: 'UNKNOWN',
        message: (err as Error)?.message ?? String(err),
        lang,
        audioBytes,
        attempts,
      });
    }
    next(err);
  }
});
