import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// F4: STT dual-path integration test.
//
// Why: stt.ts went from Gemini-primary → Whisper-primary on 2026-04-26 with no
// test coverage. The dual-path control flow (Whisper success → break;
// Whisper fail → Gemini fallback; both fail → 502) only existed in the
// maintainer's head. Cost: untested control flow on a venue-critical Summit
// path (lecturer's voice input goes through here).
//
// Approach: mock `lib/whisper.js` and `lib/gemini.js` BEFORE app.ts imports
// them. Drive /api/stt with a small fake audio buffer; assert the response +
// which providers were called.
//
// Trade-off: we don't drive raw OpenAI / Gemini wire formats; we mock at the
// module boundary. That means provider HTTP error parsing is out of scope
// here (covered by whisper.ts unit-level handling and the live eval).

// Per-test scripts. Reset in beforeEach.
const whisperScript: {
  configured: boolean;
  result?: { ok: true; text: string } | { ok: false; kind: 'overload' | 'fatal' | 'disabled'; message: string };
} = { configured: true };

const geminiScript: {
  result?: { text: string } | { error: Error };
} = {};

const callTrace: string[] = [];

vi.mock('../../src/lib/whisper.js', () => ({
  isWhisperConfigured: () => whisperScript.configured,
  whisperTranscribe: async () => {
    callTrace.push('whisper');
    return whisperScript.result ?? { ok: false, kind: 'disabled' as const, message: 'no script' };
  },
}));

vi.mock('../../src/lib/gemini.js', () => ({
  GEMINI_MODELS: {
    recommend: 'gemini-2.5-flash',
    recommendFallbacks: ['gemini-2.5-flash-lite'],
    stt: 'gemini-2.5-flash',
  },
  getGemini: () => ({
    models: {
      generateContent: async () => {
        callTrace.push('gemini');
        if (geminiScript.result && 'error' in geminiScript.result) {
          throw geminiScript.result.error;
        }
        return { text: geminiScript.result?.text ?? '' };
      },
    },
  }),
}));

// Import the app AFTER vi.mock so it sees the stubbed modules.
const { app } = await import('../helpers/app.js');

// Tiny fake audio buffer — content irrelevant since both providers are mocked.
const fakeAudio = Buffer.from('fake-webm-bytes');

describe('STT dual-path · /api/stt', () => {
  beforeEach(() => {
    callTrace.length = 0;
    whisperScript.configured = true;
    whisperScript.result = undefined;
    geminiScript.result = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Whisper success → returns text, Gemini not called', async () => {
    whisperScript.result = { ok: true, text: 'hello from whisper' };

    const res = await request(app)
      .post('/api/stt')
      .field('lang', 'en')
      .attach('audio', fakeAudio, { filename: 'audio.webm', contentType: 'audio/webm' });

    expect(res.status).toBe(200);
    expect(res.body.text).toBe('hello from whisper');
    expect(callTrace).toEqual(['whisper']); // gemini untouched
  });

  it('Whisper fail → Gemini success returns Gemini text', async () => {
    whisperScript.result = { ok: false, kind: 'overload', message: 'whisper 503' };
    geminiScript.result = { text: 'hello from gemini' };

    const res = await request(app)
      .post('/api/stt')
      .field('lang', 'en')
      .attach('audio', fakeAudio, { filename: 'audio.webm', contentType: 'audio/webm' });

    expect(res.status).toBe(200);
    expect(res.body.text).toBe('hello from gemini');
    expect(callTrace).toEqual(['whisper', 'gemini']);
  });

  it('Whisper not configured → skips directly to Gemini', async () => {
    whisperScript.configured = false;
    geminiScript.result = { text: 'gemini direct' };

    const res = await request(app)
      .post('/api/stt')
      .field('lang', 'en')
      .attach('audio', fakeAudio, { filename: 'audio.webm', contentType: 'audio/webm' });

    expect(res.status).toBe(200);
    expect(res.body.text).toBe('gemini direct');
    // Whisper transcribe should NOT have been invoked when isWhisperConfigured()=false
    expect(callTrace).toEqual(['gemini']);
  });

  it('both providers fail → 502 LLM_CALL_FAILED with Whisper error preserved', async () => {
    whisperScript.result = { ok: false, kind: 'fatal', message: 'whisper auth bad' };
    geminiScript.result = { text: '' }; // empty → counted as failure

    const res = await request(app)
      .post('/api/stt')
      .field('lang', 'en')
      .attach('audio', fakeAudio, { filename: 'audio.webm', contentType: 'audio/webm' });

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('LLM_CALL_FAILED');
    // The route preserves the PRIMARY (whisper) failure message in the
    // response body so trace logs surface "who broke first" — pin that.
    expect(res.body.message).toContain('whisper auth bad');
    expect(callTrace).toEqual(['whisper', 'gemini']);
  });

  it('Whisper not configured + Gemini fails → 502 with Gemini message', async () => {
    whisperScript.configured = false;
    geminiScript.result = { error: new Error('gemini network blew up') };

    const res = await request(app)
      .post('/api/stt')
      .field('lang', 'en')
      .attach('audio', fakeAudio, { filename: 'audio.webm', contentType: 'audio/webm' });

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('LLM_CALL_FAILED');
    // No whisper attempt → primaryError is empty → fallback message wins.
    expect(res.body.message).toContain('gemini network blew up');
    expect(callTrace).toEqual(['gemini']);
  });

  it('rejects when lang field is missing', async () => {
    // Sanity: VALIDATION still fires before either provider is called.
    const res = await request(app)
      .post('/api/stt')
      .attach('audio', fakeAudio, { filename: 'audio.webm', contentType: 'audio/webm' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
    expect(callTrace).toEqual([]); // neither provider touched
  });
});
