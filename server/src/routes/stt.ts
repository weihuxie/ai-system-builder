import { Router } from 'express';
import multer from 'multer';

import { LangSchema, type SttResponse } from '@asb/shared';
import { HttpError } from '../middleware/errors.js';
import { GEMINI_MODELS, getGemini } from '../lib/gemini.js';
import { logEvent, newTraceId } from '../lib/logger.js';
import { isAbortOrTimeoutError, raceWithTimeout, STT_TIMEOUT_MS } from '../lib/timeout.js';

export const sttRouter = Router();

// 4 MB cap — Vercel Hobby has a 4.5 MB request body limit (includes headers + base64 overhead).
// Short mic recordings (webm/opus, ~10–20s) are typically 100–500 KB, so 4 MB is plenty.
// If we ever move off Vercel, this can go back up to 10 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

sttRouter.post('/', upload.single('audio'), async (req, res, next) => {
  const traceId = newTraceId();
  const startedAt = performance.now();
  let lang: string | undefined;
  let audioBytes = 0;
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

    const ai = getGemini();
    const b64 = req.file.buffer.toString('base64');

    const prompt = `Transcribe this audio recording to ${lang} text. Return plain text only, no extra commentary.`;

    let text: string | undefined;
    let timedOut = false;
    try {
      const resp = await raceWithTimeout(
        ai.models.generateContent({
          model: GEMINI_MODELS.stt,
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: req.file.mimetype || 'audio/webm',
                    data: b64,
                  },
                },
              ],
            },
          ],
        }),
        STT_TIMEOUT_MS,
        'STT',
      );
      text = resp.text?.trim();
    } catch (e) {
      timedOut = isAbortOrTimeoutError(e);
      // 超时和调用失败都走 LLM_CALL_FAILED —— 前端同一条错误 banner 就够用。
      // 日志里会清楚区分是 timeout 还是其它（TimeoutError vs 别的 message）。
      const msg = timedOut ? `STT timeout after ${STT_TIMEOUT_MS}ms` : (e as Error).message;
      throw new HttpError(502, 'LLM_CALL_FAILED', msg);
    }

    if (!text) throw new HttpError(502, 'LLM_CALL_FAILED', 'Empty STT result');

    logEvent('stt_success', {
      traceId,
      latencyMs: Math.round(performance.now() - startedAt),
      lang,
      audioBytes,
      outputLen: text.length,
      model: GEMINI_MODELS.stt,
    });

    const payload: SttResponse = { text };
    res.json(payload);
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
      });
    } else {
      logEvent('stt_failed', {
        traceId,
        latencyMs,
        code: 'UNKNOWN',
        message: (err as Error)?.message ?? String(err),
        lang,
        audioBytes,
      });
    }
    next(err);
  }
});
