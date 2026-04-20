import { Router } from 'express';
import multer from 'multer';

import { LangSchema, type SttResponse } from '@asb/shared';
import { HttpError } from '../middleware/errors.js';
import { GEMINI_MODELS, getGemini } from '../lib/gemini.js';

export const sttRouter = Router();

// 4 MB cap — Vercel Hobby has a 4.5 MB request body limit (includes headers + base64 overhead).
// Short mic recordings (webm/opus, ~10–20s) are typically 100–500 KB, so 4 MB is plenty.
// If we ever move off Vercel, this can go back up to 10 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

sttRouter.post('/', upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError(400, 'VALIDATION', 'Missing audio file');
    }
    const langParsed = LangSchema.safeParse(req.body.lang);
    if (!langParsed.success) {
      throw new HttpError(400, 'VALIDATION', 'Invalid or missing lang field');
    }
    const lang = langParsed.data;

    const ai = getGemini();
    const b64 = req.file.buffer.toString('base64');

    const prompt = `Transcribe this audio recording to ${lang} text. Return plain text only, no extra commentary.`;

    let text: string | undefined;
    try {
      const resp = await ai.models.generateContent({
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
      });
      text = resp.text?.trim();
    } catch (e) {
      throw new HttpError(502, 'LLM_CALL_FAILED', (e as Error).message);
    }

    if (!text) throw new HttpError(502, 'LLM_CALL_FAILED', 'Empty STT result');

    const payload: SttResponse = { text };
    res.json(payload);
  } catch (err) {
    next(err);
  }
});
