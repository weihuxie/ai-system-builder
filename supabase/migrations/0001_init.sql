-- ─────────────────────────────────────────────────────────────
-- 0001_init.sql — AI System Builder v4 schema
-- Design doc §4.3, §4.4
--
-- Tables:
--   products       — shared catalog (Google + AWS reuse the same rows)
--   global_config  — singleton row (id = 1), holds current brand
--
-- Auth model:
--   Anon key (client): SELECT only. Writes go through backend w/ service key.
--   Service key (Cloud Run): bypasses RLS.
-- ─────────────────────────────────────────────────────────────

-- ───────────────────────────────
-- Extensions
-- ───────────────────────────────
-- (supabase already has pgcrypto / uuid-ossp; nothing extra needed for v1)

-- ───────────────────────────────
-- Tables
-- ───────────────────────────────
create table if not exists public.products (
  id               text primary key,
  -- 4-language maps; shape enforced by server Zod (ProductItemSchema)
  name             jsonb not null,
  description      jsonb not null,
  audience         jsonb not null,
  -- per-brand URL: { google: "...", aws: "..." }
  url              jsonb not null default '{}'::jsonb,
  is_participating boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- cheap filter used by /api/generate and admin list
create index if not exists products_is_participating_idx
  on public.products (is_participating);

create table if not exists public.global_config (
  id         int primary key check (id = 1),  -- singleton
  brand      text not null default 'google' check (brand in ('google', 'aws')),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Ensure the singleton row exists (idempotent on re-run)
insert into public.global_config (id, brand)
values (1, 'google')
on conflict (id) do nothing;

-- ───────────────────────────────
-- RLS
-- ───────────────────────────────
alter table public.products enable row level security;
alter table public.global_config enable row level security;

-- Drop old policies if the migration is being re-applied in-place.
-- (Supabase migrations are append-only in prod, but local dev often re-runs.)
drop policy if exists "products: anon read participating" on public.products;
drop policy if exists "products: service_role all" on public.products;
drop policy if exists "global_config: anon read" on public.global_config;
drop policy if exists "global_config: service_role all" on public.global_config;

-- Anon: read only participating products (keeps retired SKUs out of public view).
-- Admin UI uses the backend (service key), so it can still list everything.
create policy "products: anon read participating"
  on public.products
  for select
  to anon
  using (is_participating = true);

-- Service role: full access (bypasses RLS via auth, but explicit policy keeps
-- behavior consistent if someone ever proxies through a non-service JWT).
create policy "products: service_role all"
  on public.products
  for all
  to service_role
  using (true)
  with check (true);

create policy "global_config: anon read"
  on public.global_config
  for select
  to anon
  using (true);

create policy "global_config: service_role all"
  on public.global_config
  for all
  to service_role
  using (true)
  with check (true);

-- ───────────────────────────────
-- updated_at auto-touch
-- ───────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
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

-- ───────────────────────────────
-- Realtime
-- ───────────────────────────────
-- Supabase Realtime requires the table to be in the supabase_realtime publication.
-- Design doc §4.4 + CLAUDE.md §4.3: this is the #1 "why isn't sync working" pitfall.
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.global_config;
