-- ─────────────────────────────────────────────────────────────
-- 0006_soft_delete.sql — products 软删除
--
-- 背景: DELETE /api/products/:id 之前是物理硬删（from('products').delete()），
-- 误删无法恢复。产品数据重建成本高（4 lang × name/desc/audience + 8 URL 槽 +
-- industries），admin 一手滑就丢一条。
--
-- 方案: 加 deleted_at 时间戳列做软删除。
--   - NULL       = live product（正常显示）
--   - non-NULL   = 在回收站，从 public catalog + AI 推荐过滤掉，可恢复
--   - DELETE 改成 UPDATE deleted_at = now()
--   - 新 POST /:id/restore 把 deleted_at 清回 NULL
--   - admin 回收站视图: GET /admin?deleted=true
--
-- index: 几乎所有查询都带 deleted_at IS NULL 过滤，建 partial-ish index 加速。
--
-- 幂等（IF NOT EXISTS）：重跑安全，老数据 deleted_at 默认 NULL = live。
-- ─────────────────────────────────────────────────────────────

alter table public.products
  add column if not exists deleted_at timestamptz;

create index if not exists products_deleted_at_idx
  on public.products (deleted_at);
