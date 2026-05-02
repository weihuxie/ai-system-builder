#!/usr/bin/env node
// ───────────────────────────────────────────
// F9 eval baseline runner —— 通过 prod /api/generate 跑 golden 12-case
//
// 为什么不直跑 server/evals/run-eval.ts：
//   - 那个直接打 Gemini API。从 CN 开发机跑会 400 "User location not
//     supported"（CLAUDE.md §4.4 的同一个坑）。Gemini 的限制看的是
//     billing account 所在地，套 Tokyo/Korea proxy 也不灵
//   - 此 runner 走 prod /api/generate，请求路径是 CN → Vercel(iad1) → LLM。
//     Vercel 在美国，对 Gemini 没限制，且失败时还能自动 fallback 到
//     Kimi/DeepSeek（user-facing 场景就是这样）
//
// 取舍：
//   - 测的是"用户实际看到的 LLM chain 输出"，不是"Gemini 单家能力"。
//     对 Summit baseline 用途反而更合适：我们 care 的是 demo 出的产品
//     推荐质量，至于哪家 provider 接的不重要
//   - brand 不在 request body —— 它从 server global_config 读。所以
//     golden.json 里 4 个 brand=aws 的 case 实际会走 prod 当前 brand
//     （通常是 google）。结果文件里标注下，知道这 4 条精度打折
//
// 跑法：
//   node scripts/eval-via-prod.mjs
//   PROD_URL=https://summit-xxx.vercel.app node scripts/eval-via-prod.mjs  # 测 preview
//   EVAL_LIMIT=3 node scripts/eval-via-prod.mjs                            # 调试用，只跑前 3
//
// 输出：
//   - 终端：每 case 一行 + 末尾 summary
//   - server/evals/eval-result-prod.json：完整 trace，存 repo 之外
// ───────────────────────────────────────────

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const GOLDEN_PATH = resolve(REPO_ROOT, 'server/evals/golden.json');
const OUTPUT_PATH = resolve(REPO_ROOT, 'server/evals/eval-result-prod.json');

const PROD_URL = process.env.PROD_URL ?? 'https://summit.aiverygen.ai';
// Sleep between cases. Rate limit on /api/generate is 10/min/IP — 7s = 8.5/min,
// safe margin.
const SLEEP_MS = Number(process.env.EVAL_SLEEP_MS ?? 7000);
const LIMIT = Number(process.env.EVAL_LIMIT ?? 0);

function looksLikeLang(text, lang) {
  const hasCJK = /[぀-ヿ一-鿿]/.test(text);
  switch (lang) {
    case 'en':
      return !hasCJK;
    case 'ja':
      return /[぀-ゟ゠-ヿ]/.test(text);
    case 'zh-CN':
    case 'zh-HK':
      return hasCJK && !/[぀-ゟ゠-ヿ]/.test(text);
    default:
      return true;
  }
}

async function runCase(c) {
  const startedAt = performance.now();
  try {
    const r = await fetch(`${PROD_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInput: c.userInput, lang: c.lang }),
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    const body = await r.json().catch(() => ({}));

    if (!r.ok) {
      return {
        id: c.id,
        brand: c.brand,
        lang: c.lang,
        latencyMs,
        outcome: 'error',
        httpStatus: r.status,
        error: body?.code ? `${body.code}: ${body.message}` : `HTTP ${r.status}`,
      };
    }

    const selectedProducts = body?.selectedProducts ?? [];
    const rationaleText = Object.values(body?.rationale ?? {}).join(' ');
    const provider = body?.provider;
    const model = body?.model;

    const expected = c.expectContains ?? [];
    const missingExpected = expected.filter((id) => !selectedProducts.includes(id));
    const langMatch = looksLikeLang(rationaleText, c.lang);

    let outcome;
    if (missingExpected.length === 0 && langMatch) outcome = 'pass';
    else if (missingExpected.length < expected.length && langMatch) outcome = 'partial';
    else outcome = 'fail';

    return {
      id: c.id,
      brand: c.brand,
      lang: c.lang,
      latencyMs,
      outcome,
      provider,
      model,
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
      error: e.message,
    };
  }
}

async function main() {
  const raw = await readFile(GOLDEN_PATH, 'utf8');
  let cases = JSON.parse(raw);
  if (LIMIT > 0) cases = cases.slice(0, LIMIT);

  console.log(`[eval-prod] ${cases.length} cases against ${PROD_URL}`);
  console.log(`[eval-prod] sleep=${SLEEP_MS}ms (rate limit 10/min)`);
  console.log('');

  // Detect prod brand once for awareness.
  const brandResp = await fetch(`${PROD_URL}/api/brand`).catch(() => null);
  const prodBrand = brandResp?.ok ? (await brandResp.json())?.brand : 'unknown';
  console.log(`[eval-prod] prod brand currently: ${prodBrand}`);
  console.log('');

  const results = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    if (i > 0) await new Promise((r) => setTimeout(r, SLEEP_MS));
    const r = await runCase(c);
    results.push(r);
    const mark = r.outcome === 'pass' ? '✓' : r.outcome === 'partial' ? '~' : '✗';
    const provInfo = r.provider ? ` [${r.provider}]` : '';
    const hint =
      r.outcome === 'error'
        ? ` error=${(r.error ?? '').slice(0, 80)}`
        : r.missingExpected
          ? ` missing=[${r.missingExpected.join(',')}]`
          : '';
    const langFlag = r.langMatch === false ? ' lang✗' : '';
    const brandWarn = c.brand !== prodBrand ? ` (req=${c.brand}, prod=${prodBrand})` : '';
    console.log(
      `${mark} ${c.id.padEnd(40)} ${String(r.latencyMs).padStart(5)}ms${provInfo}  ids=${
        r.selectedProducts?.join(',') ?? '—'
      }${hint}${langFlag}${brandWarn}`,
    );
  }

  const summary = {
    total: results.length,
    pass: results.filter((r) => r.outcome === 'pass').length,
    partial: results.filter((r) => r.outcome === 'partial').length,
    fail: results.filter((r) => r.outcome === 'fail').length,
    error: results.filter((r) => r.outcome === 'error').length,
    avgLatencyMs: Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length),
    p95LatencyMs: [...results].sort((a, b) => a.latencyMs - b.latencyMs)[
      Math.floor(results.length * 0.95)
    ]?.latencyMs,
    providersHit: [...new Set(results.map((r) => r.provider).filter(Boolean))],
  };
  console.log('');
  console.log('[eval-prod] summary:', summary);

  await writeFile(
    OUTPUT_PATH,
    JSON.stringify(
      {
        ts: new Date().toISOString(),
        prodUrl: PROD_URL,
        prodBrand,
        summary,
        results,
        notes: [
          'Hit prod /api/generate (Vercel iad1). LLM picked by chain (gemini→kimi→deepseek per global_config).',
          `brand mismatch in 4 cases (golden requires aws but prod=${prodBrand}); affects rationale tone, not product selection`,
        ],
      },
      null,
      2,
    ),
  );
  console.log(`[eval-prod] full trace → ${OUTPUT_PATH}`);

  if (summary.fail > 0 || summary.error > 0) process.exit(2);
}

main().catch((e) => {
  console.error('[eval-prod] fatal:', e);
  process.exit(1);
});
