-- ─────────────────────────────────────────────────────────────
-- 0005_product_industries.sql — products 加 industries 标签字段
--
-- 背景: ProductBottomList 角色筛选已经做完，用户反馈想再按"行业"筛。
-- 现有 schema 没有 industry 字段（audience 是角色，不等同行业）。
--
-- 选型:
--   - 不新建 m2m 表（10 行业 × 50 产品规模太小，多一张表运维成本高）
--   - jsonb array of string IDs（如 ["manufacturing","fintech"]）
--     消费侧从 shared/industries.ts 字典查 i18n 显示名
--   - default '[]' = "适用所有行业"，过滤时被视为 wildcard，最大化命中概率
--
-- 幂等（IF NOT EXISTS）：重跑安全，老数据自动拿到 [] 默认值
-- ─────────────────────────────────────────────────────────────

alter table public.products
  add column if not exists industries jsonb not null default '[]'::jsonb;
