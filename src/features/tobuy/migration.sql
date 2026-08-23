-- New "To Buy" module: shopping list grouped into categories (Kanban
-- columns), same shape as the Content module's category board.
-- Run this once in the Supabase SQL editor for project dmhlbgdakispkgbucgmq,
-- then it can be deleted.

create table tobuy_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#8b5cf6',
  sort_order integer not null default 0,
  collapsed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table tobuy_categories enable row level security;

create policy "select own tobuy_categories" on tobuy_categories
  for select using (auth.uid() = user_id);
create policy "insert own tobuy_categories" on tobuy_categories
  for insert with check (auth.uid() = user_id);
create policy "update own tobuy_categories" on tobuy_categories
  for update using (auth.uid() = user_id);
create policy "delete own tobuy_categories" on tobuy_categories
  for delete using (auth.uid() = user_id);

create table tobuy_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  checked boolean not null default false,
  category_id uuid references tobuy_categories(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tobuy_items enable row level security;

create policy "select own tobuy_items" on tobuy_items
  for select using (auth.uid() = user_id);
create policy "insert own tobuy_items" on tobuy_items
  for insert with check (auth.uid() = user_id);
create policy "update own tobuy_items" on tobuy_items
  for update using (auth.uid() = user_id);
create policy "delete own tobuy_items" on tobuy_items
  for delete using (auth.uid() = user_id);
