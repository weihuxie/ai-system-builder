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

  // ───────────────────────────────────────────
  // schemaHint 拼接 (杀 L118-127 的 StringLiteral mutants)
  // ───────────────────────────────────────────
  it('fullPrompt contains "OUTPUT FORMAT" header (kills L120 StringLiteral)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(ok200('{"x":1}'));
    await kimiProvider.generate('kimi-k2.6', baseArgs);
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    const userMsg = body.messages[0].content as string;
    expect(userMsg).toContain('OUTPUT FORMAT');
  });

  it('fullPrompt embeds the activeProductIds set verbatim', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(ok200('{"x":1}'));
    await kimiProvider.generate('kimi-k2.6', baseArgs);
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    const userMsg = body.messages[0].content as string;
    // L122 把每个 id 包进 "ID" 形式 + join。空 array mutation 会丢这些
    expect(userMsg).toContain('"CRM"');
    expect(userMsg).toContain('"CLM"');
    expect(userMsg).toContain('"OMS"');
  });

  it('fullPrompt has selectedProducts contract phrase (kills L122 StringLiteral)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(ok200('{"x":1}'));
    await kimiProvider.generate('kimi-k2.6', baseArgs);
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    expect((body.messages[0].content as string)).toContain('"selectedProducts"');
    expect((body.messages[0].content as string)).toContain('exactly 3 product IDs');
  });

  it('fullPrompt has rationale contract phrase + JSON-only directive', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(ok200('{"x":1}'));
    await kimiProvider.generate('kimi-k2.6', baseArgs);
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    const userMsg = body.messages[0].content as string;
    expect(userMsg).toContain('"rationale"');
    expect(userMsg).toMatch(/JSON only/i);
    expect(userMsg).toMatch(/Do NOT include/i);
  });

  it('fullPrompt example shape JSON snippet present (kills L125 StringLiteral)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(ok200('{"x":1}'));
    await kimiProvider.generate('kimi-k2.6', baseArgs);
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    const userMsg = body.messages[0].content as string;
    // example 字面量 — 帮 LLM 锚定 JSON 形状
    expect(userMsg).toContain('Example shape');
    expect(userMsg).toMatch(/\{"selectedProducts":\["A","B","C"\]/);
  });

  it('user prompt prefix preserved (orig prompt + \\n + schemaHint)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(ok200('{"x":1}'));
    await kimiProvider.generate('kimi-k2.6', baseArgs);
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    const userMsg = body.messages[0].content as string;
    // 原 prompt 在前，schemaHint 在后；起始必须是 baseArgs.prompt 内容
    expect(userMsg.startsWith(baseArgs.prompt)).toBe(true);
  });

  // ───────────────────────────────────────────
  // OptionalChaining 边界 (杀 L157)
  // ───────────────────────────────────────────
  it('handles choices=[{}] (no .message field) — fatal Empty', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{}] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const r = await kimiProvider.generate('kimi-k2.6', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('fatal');
  });

  it('handles choices=[{message:{}}] (no content) — fatal Empty', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: {} }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const r = await kimiProvider.generate('kimi-k2.6', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('fatal');
  });

  it('handles missing choices field — fatal Empty', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const r = await kimiProvider.generate('kimi-k2.6', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('fatal');
  });

  // ───────────────────────────────────────────
  // body.slice(0, 300) 截断 (杀 L151 MethodExpression)
  // ───────────────────────────────────────────
  it('truncates very long error body to 300 chars in error message', async () => {
    const long = 'X'.repeat(2000);
    vi.spyOn(global, 'fetch').mockResolvedValue(error(500, long));
    const r = await kimiProvider.generate('kimi-k2.6', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // 完整 body 2000 chars + "Kimi 500: " prefix；slice 后应该 ≤ 300 + prefix
      // 用 X 精确数：300 个 X 在 message 里，2000 个 X 不在
      const xCount = (r.message.match(/X/g) ?? []).length;
      expect(xCount).toBe(300);
    }
  });

  // ───────────────────────────────────────────
  // isConfigured arrow function 杀 L110
  // ───────────────────────────────────────────
  it('isConfigured returns true when KIMI_API_KEY set', () => {
    expect(kimiProvider.isConfigured()).toBe(true);
  });

  it('isConfigured returns false when KIMI_API_KEY missing', () => {
    delete process.env.KIMI_API_KEY;
    expect(kimiProvider.isConfigured()).toBe(false);
  });

  it('isConfigured returns boolean type, never undefined', () => {
    // 杀 L110 ArrowFunction → "() => undefined" mutation
    expect(typeof kimiProvider.isConfigured()).toBe('boolean');
  });

  it('provider id is "kimi" (kills id StringLiteral mutation)', () => {
    expect(kimiProvider.id).toBe('kimi');
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

  it('isConfigured returns boolean (kills L180 ArrowFunction → undefined)', () => {
    expect(typeof deepseekProvider.isConfigured()).toBe('boolean');
    expect(deepseekProvider.isConfigured()).toBe(true);
    delete process.env.DEEPSEEK_API_KEY;
    expect(deepseekProvider.isConfigured()).toBe(false);
  });

  it('provider id is "deepseek"', () => {
    expect(deepseekProvider.id).toBe('deepseek');
  });

  it('truncates error body to 300 chars (kills L218 body.slice MethodExpression)', async () => {
    const long = 'Y'.repeat(2000);
    vi.spyOn(global, 'fetch').mockResolvedValue(error(500, long));
    const r = await deepseekProvider.generate('deepseek-chat', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const yCount = (r.message.match(/Y/g) ?? []).length;
      expect(yCount).toBe(300);
    }
  });

  it('handles choices=[] empty array — fatal', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const r = await deepseekProvider.generate('deepseek-chat', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('fatal');
  });

  it('classifies fetch network error as fatal with custom message fallback', async () => {
    // 杀 L228 LogicalOperator: `(e as Error).message || 'DeepSeek fetch failed'`
    // 改 `&&` 后空 message 不会被 fallback 到默认字符串
    const noMessageErr = new Error('');
    vi.spyOn(global, 'fetch').mockRejectedValue(noMessageErr);
    const r = await deepseekProvider.generate('deepseek-chat', baseArgs);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // empty err.message → fallback 到 'DeepSeek fetch failed'
      expect(r.message).toBe('DeepSeek fetch failed');
    }
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

  it('isConfigured returns boolean (kills L67 ArrowFunction → undefined)', () => {
    expect(typeof geminiProvider.isConfigured()).toBe('boolean');
  });

  it('schema selectedProducts has type=ARRAY of strings (kills schema StringLiteral)', async () => {
    generateContentMock.mockResolvedValue({ text: '{}' });
    await geminiProvider.generate('gemini-2.5-flash', baseArgs);
    const schema = generateContentMock.mock.calls[0][0].config.responseSchema;
    expect(schema.properties.selectedProducts.type).toBe('array');
    expect(schema.properties.selectedProducts.items.type).toBe('string');
  });

  it('schema rationale property descriptions reference each id (kills L42 StringLiteral)', async () => {
    generateContentMock.mockResolvedValue({ text: '{}' });
    await geminiProvider.generate('gemini-2.5-flash', baseArgs);
    const schema = generateContentMock.mock.calls[0][0].config.responseSchema;
    // L42 描述字符串里包含 ${id}，每个 id 一个描述
    expect(schema.properties.rationale.properties.CRM.description).toMatch(/CRM/);
    expect(schema.properties.rationale.properties.CRM.description).toMatch(/2-3 sentence/);
  });

  it('schema required field includes both selectedProducts and rationale (kills L61 ArrayDeclaration)', async () => {
    generateContentMock.mockResolvedValue({ text: '{}' });
    await geminiProvider.generate('gemini-2.5-flash', baseArgs);
    const schema = generateContentMock.mock.calls[0][0].config.responseSchema;
    // L61 [] mutation 把 required 改成空数组，让 schema 不强制 fields
    expect(schema.required).toEqual(['selectedProducts', 'rationale']);
  });

  it('schema selectedProducts description present (kills L53 StringLiteral)', async () => {
    generateContentMock.mockResolvedValue({ text: '{}' });
    await geminiProvider.generate('gemini-2.5-flash', baseArgs);
    const schema = generateContentMock.mock.calls[0][0].config.responseSchema;
    expect(schema.properties.selectedProducts.description).toMatch(/3 product IDs/);
  });

  it('schema rationale obj-level description present (kills L58 StringLiteral)', async () => {
    generateContentMock.mockResolvedValue({ text: '{}' });
    await geminiProvider.generate('gemini-2.5-flash', baseArgs);
    const schema = generateContentMock.mock.calls[0][0].config.responseSchema;
    expect(schema.properties.rationale.description).toMatch(/productId/);
  });

  it('config sets responseMimeType=application/json (locks JSON contract)', async () => {
    generateContentMock.mockResolvedValue({ text: '{}' });
    await geminiProvider.generate('gemini-2.5-flash', baseArgs);
    const config = generateContentMock.mock.calls[0][0].config;
    expect(config.responseMimeType).toBe('application/json');
  });

  it('contents arg is the prompt string verbatim', async () => {
    generateContentMock.mockResolvedValue({ text: '{}' });
    const customPrompt = 'TEST-PROMPT-MARKER';
    await geminiProvider.generate('gemini-2.5-flash', { ...baseArgs, prompt: customPrompt });
    expect(generateContentMock.mock.calls[0][0].contents).toBe(customPrompt);
  });
});
