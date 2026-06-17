-- Run this in your Supabase SQL editor
-- This script is idempotent — safe to run multiple times

-- ── Tenants (işletmeler) ─────────────────────────────────────────────
create table if not exists tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  logo_url   text,
  created_at timestamptz default now()
);

alter table tenants enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='tenants' and policyname='Public read tenants') then
    execute 'create policy "Public read tenants" on tenants for select using (true)';
  end if;
end $$;

-- ── Furniture items ──────────────────────────────────────────────────
create table if not exists furniture_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  image_url   text not null,
  product_url text,
  category    text,
  price       text,
  description text,
  tenant_id   uuid,
  source_id   uuid,
  created_at  timestamptz default now()
);

alter table furniture_items enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='furniture_items' and policyname='Public read furniture') then
    execute 'create policy "Public read furniture" on furniture_items for select using (true)';
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='furniture_items' and policyname='Service role write') then
    execute 'create policy "Service role write" on furniture_items for all using (auth.role() = ''service_role'')';
  end if;
end $$;
