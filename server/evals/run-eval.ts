// ───────────────────────────────────────────
// LLM Golden-set eval —— 现场 demo 前的 sanity check
//
// 用途：
//   在动过 prompt / 加 lang / 换 model / 改 catalog 后，手动跑一遍，
//   看哪些 (brand, lang, userInput) 组合还能稳定产出期望 product。
//
// 不在 CI 跑的原因：
//   - 真实 LLM 调用有成本 + 非确定性
//   - 结果不是 pass/fail 硬指标，靠人眼判断是否 "够好"
//
// 跑法：
//   GEMINI_API_KEY=... npm --workspace server run eval
//
// 可选开关：
//   EVAL_LIMIT=3 npm ... run eval    # 只跑前 3 条，调试用
//   EVAL_TEMPERATURE=0.2 npm ... run eval  # 降低随机性复核
//
// 输出：
//   - 终端：每 case 一行简报 + 末尾汇总
//   - eval-result.json：完整 trace，审阅/对账用
// ───────────────────────────────────────────

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import type { Brand, Lang } from '@asb/shared';
import { DEFAULT_PRODUCTS, SolutionSchema } from '@asb/shared';

import { geminiProvider } from '../src/lib/providers.js';
import { buildRecommendationPrompt } from '../src/lib/prompt.js';

interface GoldenCase {
  id: string;
  brand: Brand;
  lang: Lang;
  userInput: string;
  /** Product IDs we expect to see in selectedProducts. Empty = no hard expectation. */
  expectContains?: string[];
}

interface CaseResult {
  id: string;
  brand: Brand;
  lang: Lang;
  latencyMs: number;
  outcome: 'pass' | 'partial' | 'fail' | 'error';
  selectedProducts?: string[];
  missingExpected?: string[];
  langMatch?: boolean;
  error?: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = resolve(__dirname, 'golden.json');
const OUTPUT_PATH = resolve(__dirname, 'eval-result.json');

const MODEL = process.env.EVAL_MODEL ?? 'gemini-2.5-flash';
const TEMPERATURE = Number(process.env.EVAL_TEMPERATURE ?? '0.7');
const LIMIT = Number(process.env.EVAL_LIMIT ?? '0');

// Rough per-lang heuristic: does the rationale text look like the requested lang?
// Not watertight — just catches the "Gemini replied in English when lang=ja" class of regression.
function looksLikeLang(text: string, lang: Lang): boolean {
  const hasCJK = /[\u3040-\u30ff\u4e00-\u9fff]/.test(text);
  switch (lang) {
    case 'en':
      return !hasCJK;
    case 'ja':
      // Hiragana + Katakana range; kanji alone isn't enough (could be zh)
      return /[\u3040-\u309f\u30a0-\u30ff]/.test(text);
    case 'zh-CN':
    case 'zh-HK':
      // Han chars present, no Japanese kana
      return hasCJK && !/[\u3040-\u309f\u30a0-\u30ff]/.test(text);
    default:
      return true;
  }
}

async function runCase(c: GoldenCase): Promise<CaseResult> {
  const products = DEFAULT_PRODUCTS;
  const activeProductIds = products.map((p) => p.id);
  const prompt = buildRecommendationPrompt({
    products,
    userInput: c.userInput,
    lang: c.lang,
    brand: c.brand,
  });
  const startedAt = performance.now();
  let selectedProducts: string[] | undefined;
  let rationaleText = '';
  try {
    const r = await geminiProvider.generate(MODEL, {
      prompt,
      activeProductIds,
      temperature: TEMPERATURE,
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    if (!r.ok) {
      return { id: c.id, brand: c.brand, lang: c.lang, latencyMs, outcome: 'error', error: r.message };
    }
    const parsed = SolutionSchema.safeParse(JSON.parse(r.rawText));
    if (!parsed.success) {
      return {
        id: c.id,
        brand: c.brand,
        lang: c.lang,
        latencyMs,
        outcome: 'error',
        error: `schema mismatch: ${parsed.error.issues[0]?.message ?? 'unknown'}`,
      };
    }
    selectedProducts = parsed.data.selectedProducts;
    rationaleText = Object.values(parsed.data.rationale).join(' ');

    const active = new Set(activeProductIds);
    const invalidIds = selectedProducts.filter((id) => !active.has(id));
    if (invalidIds.length > 0) {
      return {
        id: c.id,
        brand: c.brand,
        lang: c.lang,
        latencyMs,
        outcome: 'fail',
        selectedProducts,
        error: `hallucinated ids: ${invalidIds.join(',')}`,
      };
    }

    const langMatch = looksLikeLang(rationaleText, c.lang);
    const expected = c.expectContains ?? [];
    const missingExpected = expected.filter((id) => !selectedProducts!.includes(id));

    let outcome: CaseResult['outcome'];
    if (missingExpected.length === 0 && langMatch) outcome = 'pass';
    else if (missingExpected.length < expected.length && langMatch) outcome = 'partial';
    else outcome = 'fail';

    return {
      id: c.id,
      brand: c.brand,
      lang: c.lang,
      latencyMs,
      outcome,
      selectedProducts,
      missingExpected: missingExpected.length ? missingExpected : undefined,
      langMatch,
    };
  } catch (e) {
    const latencyMs = Math.round(performance.now() - startedAt);
    return {
      id: c.id,
      brand: c.brand,
      lang: c.lang,
      latencyMs,
      outcome: 'error',
      error: (e as Error).message,
    };
  }
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.log('[eval] GEMINI_API_KEY not set — nothing to run.');
    console.log('[eval]   Set it and re-run: GEMINI_API_KEY=... npm --workspace server run eval');
    process.exit(0);
  }

  const raw = await readFile(GOLDEN_PATH, 'utf8');
  let cases = JSON.parse(raw) as GoldenCase[];
  if (LIMIT > 0) cases = cases.slice(0, LIMIT);

  console.log(`[eval] running ${cases.length} cases against ${MODEL} (temp=${TEMPERATURE})`);
  console.log('');

  const results: CaseResult[] = [];
  for (const c of cases) {
    const r = await runCase(c);
    results.push(r);
    const mark = r.outcome === 'pass' ? '✓' : r.outcome === 'partial' ? '~' : '✗';
    const hint =
      r.outcome === 'error'
        ? ` error=${r.error}`
        : r.missingExpected
          ? ` missing=[${r.missingExpected.join(',')}]`
          : '';
    const langFlag = r.langMatch === false ? ' lang✗' : '';
    console.log(
      `${mark} ${c.id.padEnd(40)} ${String(r.latencyMs).padStart(5)}ms  ids=${
        r.selectedProducts?.join(',') ?? '—'
      }${hint}${langFlag}`,
    );
  }

  const summary = {
    total: results.length,
    pass: results.filter((r) => r.outcome === 'pass').length,
    partial: results.filter((r) => r.outcome === 'partial').length,
    fail: results.filter((r) => r.outcome === 'fail').length,
    error: results.filter((r) => r.outcome === 'error').length,
    avgLatencyMs: Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length),
    p95LatencyMs: [...results]
      .sort((a, b) => a.latencyMs - b.latencyMs)
      [Math.floor(results.length * 0.95)]?.latencyMs,
  };
  console.log('');
  console.log('[eval] summary:', summary);

  await writeFile(
    OUTPUT_PATH,
    JSON.stringify(
      { ts: new Date().toISOString(), model: MODEL, temperature: TEMPERATURE, summary, results },
      null,
      2,
    ),
  );
  console.log(`[eval] full trace → ${OUTPUT_PATH}`);

  // Non-zero exit if anything failed or errored — CI (if we wire one) can gate on this.
  if (summary.fail > 0 || summary.error > 0) process.exit(2);
}

main().catch((e) => {
  console.error('[eval] fatal:', e);
  process.exit(1);
});
