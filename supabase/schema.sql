-- Run this in your Supabase SQL editor

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

-- Enable Row Level Security
alter table furniture_items enable row level security;

-- Public read access
create policy "Public read" on furniture_items
  for select using (true);

-- Only service role can write (used by admin API)
create policy "Service role write" on furniture_items
  for all using (auth.role() = 'service_role');
