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

-- ── Credits (kontör) ─────────────────────────────────────────────────
alter table tenants add column if not exists credits integer not null default 0;

-- Seed: 500 credits for all existing tenants (run once after migration)
-- UPDATE tenants SET credits = 500;
-- or for a specific tenant:
-- UPDATE tenants SET credits = 500 WHERE slug = 'your-slug';

-- Atomic credit deduction: returns {ok, remaining, reason}
-- Uses FOR UPDATE row lock so concurrent requests can't double-spend.
create or replace function deduct_tenant_credit(p_slug text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_id      uuid;
  v_credits integer;
begin
  select id, credits into v_id, v_credits
  from tenants where slug = p_slug
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'tenant_not_found', 'remaining', 0);
  end if;

  if v_credits <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_credits', 'remaining', 0);
  end if;

  update tenants set credits = credits - 1 where id = v_id;
  return jsonb_build_object('ok', true, 'remaining', v_credits - 1);
end;
$$;
