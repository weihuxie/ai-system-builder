-- ─────────────────────────────────────────────────────────────
-- 0007_brand_huawei.sql — global_config.brand check 加 'huawei'
--
-- 背景: 0001 migration 把 brand 列约束为 check (brand in ('google', 'aws'))。
-- 现在新增 huawei brand，PUT /api/brand 写 huawei 会被这个 check 拒绝。
-- 必须先放开 check 才能让前端的 BrandSwitch 切到 huawei。
--
-- Postgres 不支持直接修改 check 约束，要 drop + add。原约束没显式命名
-- (匿名 check)，先查 catalog 拿 constraint name 再 drop。幂等做法：用 DO
-- block 包起来，找到任何 brand 上的 check 都 drop，再 add 新 check。
-- ─────────────────────────────────────────────────────────────

do $$
declare
  cname text;
begin
  -- 找 global_config.brand 列上现有的 check 约束（可能是 0001 创建的匿名 check）
  for cname in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'global_config'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%brand%'
  loop
    execute format('alter table public.global_config drop constraint %I', cname);
  end loop;
end $$;

-- 加新 check 接受 3 个 brand。重跑安全（IF NOT EXISTS 不适用 check，但前面
-- DO block 已经清掉所有 brand check，重跑也是 drop 后 add）。
alter table public.global_config
  add constraint global_config_brand_check
  check (brand in ('google', 'aws', 'huawei'));
