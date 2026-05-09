// ───────────────────────────────────────────
// Provider HTTP-layer unit tests (Kimi + DeepSeek)
//
// 为什么补这个：8-dim audit Top-2 短板 — providers.ts:147,214 的
// `resp.status === 429 || resp.status === 503` 错误分类逻辑零真实测试。
// chainFailover.test.ts 在 mock 层注入 ProviderResult，绕过这段正则；
// 上海场 Kimi 真返 429 时本应跌落到 DeepSeek 但被分到 fatal 直接没下一家
// 这种 bug 现有测试发现不了。
//
// 这层测试用 `vi.spyOn(global, 'fetch')` 直接 mock fetch，在 providers.ts
// 内部 happen，能验：
//   - HTTP 状态分类：429/503 → overload, 4xx/5xx 其它 → fatal
//   - 缺 key → disabled
//   - 空 response → fatal "Empty response"
//   - timeout → overload
//   - 网络错误 → fatal
//
// 不测：
//   - Gemini provider — 用 @google/genai SDK，mock 复杂；chainFailover
//     端到端集成已经覆盖
//   - Prompt schema injection — 那是 prompt.test.ts 的事
//
// 跑：npm --workspace server run test:unit
// ───────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deepseekProvider, kimiProvider } from '../../src/lib/providers.js';

const baseArgs = {
  prompt: 'You are a helpful assistant. Recommend products.',
  activeProductIds: ['CRM', 'CLM', 'OMS'] as readonly string[],
  temperature: 0.7,
};

const ok200 = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const error = (status: number, body = 'error body') =>
  new Response(body, { status });

beforeEach(() => {
  // 默认两个 key 都有，每个 case 自己 unset 可以测 disabled 路径
  process.env.KIMI_API_KEY = 'fake-kimi-key';
  process.env.DEEPSEEK_API_KEY = 'fake-deepseek-key';
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.KIMI_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
});

// ───────────────────────────────────────────
// Kimi
// ───────────────────────────────────────────
describe('kimiProvider', () => {
  it('returns ok=true with rawText on 200', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      ok200('{"selectedProducts":["CRM"],"rationale":{"CRM":"r"}}'),
    );
    const r = await kimiProvider.generate('kimi-k2.6', baseArgs);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rawText).toContain('selectedProducts');
    }
  });

  it('classifies 429 as overload (上海场跌落 DeepSeek 关键路径)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(error(429, 'rate limited'));
    const r = await kimiProvider.generate('kimi-k2.6', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('overload');
  });

  it('classifies 503 as overload', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(error(503, 'service unavailable'));
    const r = await kimiProvider.generate('kimi-k2.6', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('overload');
  });

  it('classifies 401 as fatal (auth fail = no point retrying chain)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(error(401, 'unauthorized'));
    const r = await kimiProvider.generate('kimi-k2.6', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('fatal');
  });

  it('classifies 500 as fatal (not in 429/503 set)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(error(500, 'internal error'));
    const r = await kimiProvider.generate('kimi-k2.6', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('fatal');
  });

  it('classifies 400 as fatal (malformed request)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(error(400, 'bad request'));
    const r = await kimiProvider.generate('kimi-k2.6', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('fatal');
  });

  it('returns disabled when KIMI_API_KEY not set', async () => {
    delete process.env.KIMI_API_KEY;
    const r = await kimiProvider.generate('kimi-k2.6', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('disabled');
      expect(r.message).toMatch(/KIMI_API_KEY/);
    }
  });

  it('returns fatal "Empty response" when choices is empty array', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const r = await kimiProvider.generate('kimi-k2.6', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('fatal');
      expect(r.message).toMatch(/empty/i);
    }
  });

  it('returns fatal "Empty response" when content is empty string', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(ok200(''));
    const r = await kimiProvider.generate('kimi-k2.6', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('fatal');
  });

  it('classifies fetch network error as fatal', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    const r = await kimiProvider.generate('kimi-k2.6', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('fatal');
      expect(r.message).toContain('ECONNREFUSED');
    }
  });

  it('classifies AbortError (timeout) as overload', async () => {
    const abortErr = new Error('Aborted');
    abortErr.name = 'AbortError';
    vi.spyOn(global, 'fetch').mockRejectedValue(abortErr);
    const r = await kimiProvider.generate('kimi-k2.6', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('overload');
      expect(r.message).toMatch(/timeout/i);
    }
  });

  it('sends Authorization Bearer header with the API key', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(ok200('{"x":1}'));
    await kimiProvider.generate('kimi-k2.6', baseArgs);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, init] = fetchSpy.mock.calls[0]!;
    const auth = (init?.headers as Record<string, string> | undefined)?.['Authorization'];
    expect(auth).toBe('Bearer fake-kimi-key');
  });

  it('sets response_format=json_object (Kimi JSON mode)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(ok200('{"x":1}'));
    await kimiProvider.generate('kimi-k2.6', baseArgs);
    const init = fetchSpy.mock.calls[0]![1];
    const body = JSON.parse(String(init?.body));
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('passes through model name to API request', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(ok200('{"x":1}'));
    await kimiProvider.generate('moonshot-v1-32k', baseArgs);
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    expect(body.model).toBe('moonshot-v1-32k');
  });

  it('passes through temperature', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(ok200('{"x":1}'));
    await kimiProvider.generate('kimi-k2.6', { ...baseArgs, temperature: 0.2 });
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    expect(body.temperature).toBe(0.2);
  });
});

// ───────────────────────────────────────────
// DeepSeek (same HTTP shape as Kimi — pin parity)
// ───────────────────────────────────────────
describe('deepseekProvider', () => {
  it('returns ok=true with rawText on 200', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(ok200('{"x":1}'));
    const r = await deepseekProvider.generate('deepseek-chat', baseArgs);
    expect(r.ok).toBe(true);
  });

  it('classifies 429 as overload', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(error(429));
    const r = await deepseekProvider.generate('deepseek-chat', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('overload');
  });

  it('classifies 503 as overload', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(error(503));
    const r = await deepseekProvider.generate('deepseek-chat', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('overload');
  });

  it('classifies 401 as fatal', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(error(401));
    const r = await deepseekProvider.generate('deepseek-chat', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('fatal');
  });

  it('returns disabled when DEEPSEEK_API_KEY not set', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const r = await deepseekProvider.generate('deepseek-chat', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('disabled');
  });

  it('classifies AbortError as overload (timeout)', async () => {
    const abortErr = new Error('Aborted');
    abortErr.name = 'AbortError';
    vi.spyOn(global, 'fetch').mockRejectedValue(abortErr);
    const r = await deepseekProvider.generate('deepseek-chat', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('overload');
  });
});
