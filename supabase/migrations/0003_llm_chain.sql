-- ─────────────────────────────────────────────────────────────
-- 0003_llm_chain.sql — 补齐 global_config 的 LLM 配置列
--
-- 历史遗留：生产 Supabase 上这两列是手动 Dashboard 加的，没进 migration。
-- 新环境（test / preview / 重建）走 migration 0001+0002 缺这两列 →
-- /api/llm-chain 500 / e2e 挂。
--
-- 幂等（IF NOT EXISTS）：重复跑到生产也不会炸。
-- ─────────────────────────────────────────────────────────────

alter table public.global_config
  add column if not exists llm_chain  jsonb,
  add column if not exists temperature real;

-- 不设 DB 默认值：routes/generate.ts + routes/llm.ts 里已经做了 code-level fallback
-- （temperature ?? 0.7，chain 解析失败用单 gemini 链），DB null 是合法状态。
