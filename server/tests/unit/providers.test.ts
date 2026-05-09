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

// Mock @google/genai SDK at module level so geminiProvider sees a stub.
// Use vi.hoisted because vi.mock factory is hoisted ABOVE imports — without
// hoisted(), `generateContentMock` is undefined when the factory runs.
const { generateContentMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
}));

vi.mock('@google/genai', () => {
  // class wrapper — `new GoogleGenAI(...)` 必须返回有 .models 的对象。
  // 之前用 vi.fn().mockImplementation(() => ({...})) 调 `new` 时 vitest 把
  // 实现函数本身当成构造结果返回，导致 ai.models.generateContent 是源代码字符串。
  class MockGoogleGenAI {
    models = { generateContent: generateContentMock };
  }
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: {
      OBJECT: 'object',
      STRING: 'string',
      ARRAY: 'array',
    },
  };
});

import { deepseekProvider, geminiProvider, kimiProvider } from '../../src/lib/providers.js';

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
  // 默认 3 个 key 都有，每个 case 自己 unset 可以测 disabled 路径
  process.env.KIMI_API_KEY = 'fake-kimi-key';
  process.env.DEEPSEEK_API_KEY = 'fake-deepseek-key';
  process.env.GEMINI_API_KEY = 'fake-gemini-key';
  generateContentMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.KIMI_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.GEMINI_API_KEY;
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

// ───────────────────────────────────────────
// Gemini (uses @google/genai SDK, mocked at module level)
// ───────────────────────────────────────────
describe('geminiProvider', () => {
  it('returns ok=true with rawText when SDK returns valid response', async () => {
    generateContentMock.mockResolvedValue({ text: '{"selectedProducts":["CRM"],"rationale":{}}' });
    const r = await geminiProvider.generate('gemini-2.5-flash', baseArgs);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rawText).toContain('selectedProducts');
  });

  it('returns fatal "Empty response" when SDK returns text=""', async () => {
    generateContentMock.mockResolvedValue({ text: '' });
    const r = await geminiProvider.generate('gemini-2.5-flash', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('fatal');
      expect(r.message).toMatch(/empty/i);
    }
  });

  it('returns fatal when SDK returns text=undefined', async () => {
    generateContentMock.mockResolvedValue({ text: undefined });
    const r = await geminiProvider.generate('gemini-2.5-flash', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('fatal');
  });

  it('classifies "503 UNAVAILABLE" SDK error as overload (上海场关键)', async () => {
    generateContentMock.mockRejectedValue(new Error('[GoogleGenAIError]: 503 UNAVAILABLE'));
    const r = await geminiProvider.generate('gemini-2.5-flash', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('overload');
  });

  it('classifies "429 RESOURCE_EXHAUSTED" as overload', async () => {
    generateContentMock.mockRejectedValue(
      new Error('[GoogleGenAIError]: 429 RESOURCE_EXHAUSTED quota exceeded'),
    );
    const r = await geminiProvider.generate('gemini-2.5-flash', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('overload');
  });

  it('classifies "high demand" message as overload (Vercel iad1 常见)', async () => {
    generateContentMock.mockRejectedValue(new Error('Server is under high demand, retry later'));
    const r = await geminiProvider.generate('gemini-2.5-flash', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('overload');
  });

  it('classifies "quota" message as overload', async () => {
    generateContentMock.mockRejectedValue(new Error('Daily quota exceeded for project'));
    const r = await geminiProvider.generate('gemini-2.5-flash', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('overload');
  });

  it('classifies generic SDK error as fatal (auth / config / 4xx)', async () => {
    generateContentMock.mockRejectedValue(new Error('API key not valid'));
    const r = await geminiProvider.generate('gemini-2.5-flash', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('fatal');
  });

  it('classifies TimeoutError (raceWithTimeout) as overload', async () => {
    // raceWithTimeout 包装 SDK 调用：如果 SDK 超过 GENERATE_TIMEOUT_MS 不返回，
    // 抛 TimeoutError。geminiProvider 必须把它分到 overload 让 chain 继续。
    // 用 fake timer 把 15s 真实超时压成 ms 级测试。
    vi.useFakeTimers();
    try {
      generateContentMock.mockImplementation(() => new Promise(() => {})); // never resolves
      const promise = geminiProvider.generate('gemini-2.5-flash', baseArgs);
      // 推进时间到 GENERATE_TIMEOUT_MS（15s）后让 raceWithTimeout 触发 reject
      await vi.advanceTimersByTimeAsync(15_000);
      const r = await promise;
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.kind).toBe('overload');
    } finally {
      vi.useRealTimers();
    }
  });

  it('passes through model name + temperature to SDK', async () => {
    generateContentMock.mockResolvedValue({ text: '{}' });
    await geminiProvider.generate('gemini-2.5-pro', { ...baseArgs, temperature: 0.2 });
    const call = generateContentMock.mock.calls[0][0];
    expect(call.model).toBe('gemini-2.5-pro');
    expect(call.config.temperature).toBe(0.2);
  });

  it('builds responseSchema with one rationale property per active product id', async () => {
    generateContentMock.mockResolvedValue({ text: '{}' });
    await geminiProvider.generate('gemini-2.5-flash', baseArgs);
    const call = generateContentMock.mock.calls[0][0];
    const schema = call.config.responseSchema;
    expect(schema.properties.rationale.properties).toHaveProperty('CRM');
    expect(schema.properties.rationale.properties).toHaveProperty('CLM');
    expect(schema.properties.rationale.properties).toHaveProperty('OMS');
    // selectedProducts 必须 minItems=3, maxItems=3 锁推荐数量契约
    expect(schema.properties.selectedProducts.minItems).toBe('3');
    expect(schema.properties.selectedProducts.maxItems).toBe('3');
  });

  it('isConfigured reflects GEMINI_API_KEY presence', () => {
    expect(geminiProvider.isConfigured()).toBe(true);
    delete process.env.GEMINI_API_KEY;
    expect(geminiProvider.isConfigured()).toBe(false);
  });
});
