// ───────────────────────────────────────────
// whisperTranscribe HTTP layer unit tests
//
// 之前 mutation baseline: whisper.ts 0% / 75 NoCoverage —— sttFailover
// 在 mock 层注入 WhisperResult，绕过了真实 whisper.ts 的 fetch 路径。
// 跟 providers.ts 修法一样：vi.spyOn(global, 'fetch') 直接 mock。
// ───────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isWhisperConfigured, whisperTranscribe } from '../../src/lib/whisper.js';

const audio = Buffer.from('fake-webm-bytes');

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'fake-openai-key';
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.OPENAI_API_KEY;
});

describe('isWhisperConfigured', () => {
  it('true when OPENAI_API_KEY set', () => {
    expect(isWhisperConfigured()).toBe(true);
  });

  it('false when OPENAI_API_KEY missing', () => {
    delete process.env.OPENAI_API_KEY;
    expect(isWhisperConfigured()).toBe(false);
  });

  it('false when OPENAI_API_KEY is empty string', () => {
    process.env.OPENAI_API_KEY = '';
    expect(isWhisperConfigured()).toBe(false);
  });
});

describe('whisperTranscribe · happy path', () => {
  it('returns ok=true with trimmed text on 200', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('  hello world  ', { status: 200 }),
    );
    const r = await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'en' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe('hello world');
  });

  it('sends Authorization Bearer header with the key', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('hi', { status: 200 }),
    );
    await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'en' });
    const init = fetchSpy.mock.calls[0]![1];
    const auth = (init?.headers as Record<string, string> | undefined)?.['Authorization'];
    expect(auth).toBe('Bearer fake-openai-key');
  });

  it('uses POST method', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('hi', { status: 200 }),
    );
    await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'en' });
    expect(fetchSpy.mock.calls[0]![1]?.method).toBe('POST');
  });
});

describe('whisperTranscribe · lang mapping (zh-CN / zh-HK → zh)', () => {
  it('maps zh-CN → "zh" in language field', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('hi', { status: 200 }),
    );
    await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'zh-CN' });
    const form = fetchSpy.mock.calls[0]![1]?.body as FormData;
    expect(form.get('language')).toBe('zh');
  });

  it('maps zh-HK → "zh"', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('hi', { status: 200 }),
    );
    await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'zh-HK' });
    const form = fetchSpy.mock.calls[0]![1]?.body as FormData;
    expect(form.get('language')).toBe('zh');
  });

  it('passes en through unchanged', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('hi', { status: 200 }),
    );
    await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'en' });
    const form = fetchSpy.mock.calls[0]![1]?.body as FormData;
    expect(form.get('language')).toBe('en');
  });

  it('passes ja through unchanged', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('hi', { status: 200 }),
    );
    await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'ja' });
    const form = fetchSpy.mock.calls[0]![1]?.body as FormData;
    expect(form.get('language')).toBe('ja');
  });
});

describe('whisperTranscribe · filename extension by mimeType', () => {
  it('uses audio.webm for webm mimeType', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('hi', { status: 200 }),
    );
    await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'en' });
    const form = fetchSpy.mock.calls[0]![1]?.body as FormData;
    const file = form.get('file') as File;
    expect(file.name).toBe('audio.webm');
  });

  it('uses audio.mp3 for non-webm mimeType', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('hi', { status: 200 }),
    );
    await whisperTranscribe({ audio, mimeType: 'audio/mp4', lang: 'en' });
    const form = fetchSpy.mock.calls[0]![1]?.body as FormData;
    const file = form.get('file') as File;
    expect(file.name).toBe('audio.mp3');
  });
});

describe('whisperTranscribe · request body invariants', () => {
  it('always sets model=whisper-1', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('hi', { status: 200 }),
    );
    await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'en' });
    const form = fetchSpy.mock.calls[0]![1]?.body as FormData;
    expect(form.get('model')).toBe('whisper-1');
  });

  it('always sets response_format=text (avoids JSON parse layer)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('hi', { status: 200 }),
    );
    await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'en' });
    const form = fetchSpy.mock.calls[0]![1]?.body as FormData;
    expect(form.get('response_format')).toBe('text');
  });
});

describe('whisperTranscribe · HTTP error classification', () => {
  it('returns disabled when OPENAI_API_KEY missing', async () => {
    delete process.env.OPENAI_API_KEY;
    const r = await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'en' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('disabled');
      expect(r.message).toMatch(/OPENAI_API_KEY/);
    }
  });

  it('classifies 429 as overload (跌落 Gemini 关键路径)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('rate limited', { status: 429 }));
    const r = await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'en' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('overload');
  });

  it('classifies 503 as overload', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('unavailable', { status: 503 }));
    const r = await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'en' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('overload');
  });

  it('classifies 401 as fatal', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('unauthorized', { status: 401 }));
    const r = await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'en' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('fatal');
  });

  it('classifies 400 as fatal (malformed audio)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('bad request', { status: 400 }));
    const r = await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'en' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('fatal');
  });

  it('includes status + body excerpt in error message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('detailed reason', { status: 500 }));
    const r = await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'en' });
    if (!r.ok) {
      expect(r.message).toMatch(/Whisper 500/);
      expect(r.message).toMatch(/detailed reason/);
    }
  });

  it('truncates very long error bodies (300 chars)', async () => {
    const long = 'X'.repeat(2000);
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(long, { status: 500 }));
    const r = await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'en' });
    if (!r.ok) expect(r.message.length).toBeLessThanOrEqual(400); // 含 prefix
  });
});

describe('whisperTranscribe · empty response', () => {
  it('returns fatal "Empty response from Whisper" on empty body', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    const r = await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'en' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('fatal');
      expect(r.message).toMatch(/empty/i);
    }
  });

  it('returns fatal on whitespace-only body', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('   \n  ', { status: 200 }));
    const r = await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'en' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('fatal');
  });
});

describe('whisperTranscribe · timeout / abort', () => {
  it('classifies AbortError as overload (timeout)', async () => {
    const abortErr = new Error('Aborted');
    abortErr.name = 'AbortError';
    vi.spyOn(global, 'fetch').mockRejectedValue(abortErr);
    const r = await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'en' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('overload');
      expect(r.message).toMatch(/timeout/i);
    }
  });

  it('classifies generic network error as fatal', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    const r = await whisperTranscribe({ audio, mimeType: 'audio/webm', lang: 'en' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('fatal');
      expect(r.message).toContain('ECONNREFUSED');
    }
  });
});
