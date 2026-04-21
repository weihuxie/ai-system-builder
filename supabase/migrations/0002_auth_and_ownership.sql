-- ─────────────────────────────────────────────────────────────
-- 0002_auth_and_ownership.sql — Supabase Auth + 产品所有权
--
-- 升级单密码 JWT → Google OAuth + admin_users 白名单 + 产品 owner_id。
-- 详见 docs/auth-upgrade-plan.md §3.
--
-- 执行顺序：
--   1. 新表 admin_users（白名单，pk=email）
--   2. 首次登录自动激活 trigger（auth.users → admin_users.user_id）
--   3. products 加 owner_id（legacy rows = NULL = 孤儿池，选项 A）
--   4. RLS policies（authenticated 角色，defense-in-depth）
--   5. admin_users 进 Realtime publication
-- ─────────────────────────────────────────────────────────────

-- ───────────────────────────────
-- 1. admin_users 白名单
-- ───────────────────────────────
create table if not exists public.admin_users (
  email        text primary key,
  user_id      uuid references auth.users(id) on delete set null,
  role         text not null check (role in ('editor', 'super_admin')),
  invited_at   timestamptz not null default now(),
  activated_at timestamptz,
  invited_by   uuid references auth.users(id) on delete set null
);

create index if not exists admin_users_user_id_idx on public.admin_users(user_id);

-- ───────────────────────────────
-- 2. 首次登录自动关联 user_id
-- Supabase auth 创建用户 → 如果 email 在白名单里 & user_id 为 null，填上并记激活时间
-- ───────────────────────────────
create or replace function public.activate_admin_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.admin_users
    set user_id = new.id,
        activated_at = now()
    where email = new.email
      and user_id is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.activate_admin_on_signup();

-- ───────────────────────────────
-- 3. products.owner_id
-- on delete set null: 用户被 delete 时产品保留，变孤儿池，super_admin 重新分配
-- ───────────────────────────────
alter table public.products
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

create index if not exists products_owner_id_idx on public.products(owner_id);

-- ───────────────────────────────
-- 4. RLS — 新增 authenticated 策略（defense-in-depth）
-- service_role 策略不动，Express 仍然是主要授权层。
-- 这些策略保证：即使客户端直连 Supabase，RLS 也会兜底。
-- ───────────────────────────────

-- products: authenticated
drop policy if exists "products: authenticated read" on public.products;
drop policy if exists "products: authenticated insert" on public.products;
drop policy if exists "products: authenticated update" on public.products;
drop policy if exists "products: authenticated delete" on public.products;

create policy "products: authenticated read"
  on public.products for select
  to authenticated
  using (
    exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin')
    or owner_id = auth.uid()
    or is_participating = true
  );

create policy "products: authenticated insert"
  on public.products for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    or exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin')
  );

create policy "products: authenticated update"
  on public.products for update
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin')
  )
  with check (
    owner_id = auth.uid()
    or exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin')
  );

create policy "products: authenticated delete"
  on public.products for delete
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin')
  );

-- global_config: 只有 super_admin 能 update
drop policy if exists "global_config: authenticated super_admin write" on public.global_config;

create policy "global_config: authenticated super_admin write"
  on public.global_config for update
  to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin'))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin'));

-- admin_users: 启用 RLS + policies
alter table public.admin_users enable row level security;

drop policy if exists "admin_users: self read" on public.admin_users;
drop policy if exists "admin_users: super_admin all" on public.admin_users;
drop policy if exists "admin_users: service_role all" on public.admin_users;

create policy "admin_users: self read"
  on public.admin_users for select
  to authenticated
  using (user_id = auth.uid());

create policy "admin_users: super_admin all"
  on public.admin_users for all
  to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid() and au.role = 'super_admin'))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid() and au.role = 'super_admin'));

create policy "admin_users: service_role all"
  on public.admin_users for all
  to service_role
  using (true) with check (true);

-- ───────────────────────────────
-- 5. Realtime
-- ───────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_users'
  ) then
    alter publication supabase_realtime add table public.admin_users;
  end if;
end $$;

-- ───────────────────────────────
-- 6. updated_at trigger 不需要 admin_users（invited_at / activated_at 是状态不是更新时间）
-- ───────────────────────────────

-- ───────────────────────────────
-- 7. 种子 super_admin
-- 由用户在 Supabase Dashboard SQL Editor 里单独执行（避免把邮箱写进迁移文件）:
--
--   insert into public.admin_users (email, role)
--   values ('weih.xie@gmail.com', 'super_admin')
--   on conflict (email) do update set role = 'super_admin';
--
-- 首次用该 gmail 登录时 trigger 会自动填 user_id + activated_at。
-- ───────────────────────────────
