-- ─────────────────────────────────────────────────────────────
-- test-setup.sql —  一键 paste：给新创建的 test Supabase 项目建 schema
--
-- 用法：
--   1. Supabase Dashboard → 新建 project (免费层即可，名字建议 ai-system-builder-test)
--   2. 左栏 SQL Editor → New query → 把本文件整坨 paste 进去 → Run
--   3. 等待 "Success. No rows returned"（约 3-5 秒）
--
-- 全幂等：重复跑不会炸，已有表 / 列 / policy 会跳过或重建。
--
-- 内容 = supabase/migrations/0001 + 0002 + 0003 依序拼接。
-- 改动 migration 文件后记得同步这里。
-- ─────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════
-- ── 0001_init.sql ──
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.products (
  id               text primary key,
  name             jsonb not null,
  description      jsonb not null,
  audience         jsonb not null,
  url              jsonb not null default '{}'::jsonb,
  is_participating boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists products_is_participating_idx
  on public.products (is_participating);

create table if not exists public.global_config (
  id         int primary key check (id = 1),
  brand      text not null default 'google' check (brand in ('google', 'aws')),
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into public.global_config (id, brand)
values (1, 'google')
on conflict (id) do nothing;

alter table public.products enable row level security;
alter table public.global_config enable row level security;

drop policy if exists "products: anon read participating" on public.products;
drop policy if exists "products: service_role all" on public.products;
drop policy if exists "global_config: anon read" on public.global_config;
drop policy if exists "global_config: service_role all" on public.global_config;

create policy "products: anon read participating"
  on public.products for select to anon
  using (is_participating = true);

create policy "products: service_role all"
  on public.products for all to service_role
  using (true) with check (true);

create policy "global_config: anon read"
  on public.global_config for select to anon
  using (true);

create policy "global_config: service_role all"
  on public.global_config for all to service_role
  using (true) with check (true);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute procedure public.touch_updated_at();

drop trigger if exists global_config_touch_updated_at on public.global_config;
create trigger global_config_touch_updated_at
  before update on public.global_config
  for each row execute procedure public.touch_updated_at();

-- Realtime publication (幂等加表)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='products'
  ) then alter publication supabase_realtime add table public.products;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='global_config'
  ) then alter publication supabase_realtime add table public.global_config;
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- ── 0002_auth_and_ownership.sql ──
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.admin_users (
  email        text primary key,
  user_id      uuid references auth.users(id) on delete set null,
  role         text not null check (role in ('editor', 'super_admin')),
  invited_at   timestamptz not null default now(),
  activated_at timestamptz,
  invited_by   uuid references auth.users(id) on delete set null
);

create index if not exists admin_users_user_id_idx on public.admin_users(user_id);

create or replace function public.activate_admin_on_signup()
returns trigger language plpgsql security definer
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

alter table public.products
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

create index if not exists products_owner_id_idx on public.products(owner_id);

drop policy if exists "products: authenticated read" on public.products;
drop policy if exists "products: authenticated insert" on public.products;
drop policy if exists "products: authenticated update" on public.products;
drop policy if exists "products: authenticated delete" on public.products;

create policy "products: authenticated read"
  on public.products for select to authenticated
  using (
    exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin')
    or owner_id = auth.uid()
    or is_participating = true
  );

create policy "products: authenticated insert"
  on public.products for insert to authenticated
  with check (
    owner_id = auth.uid()
    or exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin')
  );

create policy "products: authenticated update"
  on public.products for update to authenticated
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin')
  )
  with check (
    owner_id = auth.uid()
    or exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin')
  );

create policy "products: authenticated delete"
  on public.products for delete to authenticated
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin')
  );

drop policy if exists "global_config: authenticated super_admin write" on public.global_config;
create policy "global_config: authenticated super_admin write"
  on public.global_config for update to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin'))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'super_admin'));

alter table public.admin_users enable row level security;

drop policy if exists "admin_users: self read" on public.admin_users;
drop policy if exists "admin_users: super_admin all" on public.admin_users;
drop policy if exists "admin_users: service_role all" on public.admin_users;

create policy "admin_users: self read"
  on public.admin_users for select to authenticated
  using (user_id = auth.uid());

create policy "admin_users: super_admin all"
  on public.admin_users for all to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid() and au.role = 'super_admin'))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid() and au.role = 'super_admin'));

create policy "admin_users: service_role all"
  on public.admin_users for all to service_role
  using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_users'
  ) then
    alter publication supabase_realtime add table public.admin_users;
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- ── 0003_llm_chain.sql ──
-- ═══════════════════════════════════════════════════════════════

alter table public.global_config
  add column if not exists llm_chain  jsonb,
  add column if not exists temperature real;


-- ═══════════════════════════════════════════════════════════════
-- ── 0004_quick_scenarios.sql ──
-- ═══════════════════════════════════════════════════════════════

alter table public.global_config
  add column if not exists quick_scenarios jsonb;


-- ═══════════════════════════════════════════════════════════════
-- ── 完成 ──
-- 下一步：在本地 repo 根目录创建 .env.test（见 README / .env.test.example），
-- 填上这个项目的 URL / service key / JWT secret / anon key。
-- ═══════════════════════════════════════════════════════════════
