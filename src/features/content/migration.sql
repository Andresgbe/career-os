-- Content module redesign: categories become Kanban board columns,
-- ideas belong to a single category (or none) with a per-column sort_order,
-- and the platform tags (Instagram Reel, TikTok Video, ...) are removed.
-- Run this once in the Supabase SQL editor for project dmhlbgdakispkgbucgmq,
-- then it can be deleted.

-- 1. content_categories: add board-column bookkeeping
alter table content_categories
  add column if not exists sort_order integer not null default 0,
  add column if not exists collapsed boolean not null default false;

-- backfill sort_order by creation order, per user
with ranked as (
  select id, row_number() over (partition by user_id order by created_at) - 1 as rn
  from content_categories
)
update content_categories c
set sort_order = ranked.rn
from ranked
where ranked.id = c.id;

-- 2. content_ideas: single category_id + per-column sort_order
alter table content_ideas
  add column if not exists category_id uuid references content_categories(id) on delete set null,
  add column if not exists sort_order integer not null default 0;

-- backfill category_id from the first tag in the old category_ids array
update content_ideas
set category_id = (category_ids->>0)::uuid
where category_id is null
  and jsonb_typeof(category_ids) = 'array'
  and jsonb_array_length(category_ids) > 0;

-- backfill sort_order by creation order, per (user, category)
with ranked as (
  select id, row_number() over (
    partition by user_id, category_id order by created_at
  ) - 1 as rn
  from content_ideas
)
update content_ideas i
set sort_order = ranked.rn
from ranked
where ranked.id = i.id;

-- 3. drop the old multi-tag / platform columns now that data is migrated
alter table content_ideas
  drop column if exists category_ids,
  drop column if exists platforms;
