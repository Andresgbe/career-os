-- New "Horarios" sub-tab in University: a weekly Monday-Friday class
-- schedule for the user, plus one schedule per tracked friend, so they can
-- compare free time (e.g. "who can give me a ride").
-- Run this once in the Supabase SQL editor for project dmhlbgdakispkgbucgmq,
-- then it can be deleted.

create table grades_schedule_people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#8b5cf6',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table grades_schedule_people enable row level security;

create policy "select own grades_schedule_people" on grades_schedule_people
  for select using (auth.uid() = user_id);
create policy "insert own grades_schedule_people" on grades_schedule_people
  for insert with check (auth.uid() = user_id);
create policy "update own grades_schedule_people" on grades_schedule_people
  for update using (auth.uid() = user_id);
create policy "delete own grades_schedule_people" on grades_schedule_people
  for delete using (auth.uid() = user_id);

create table grades_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- null person_id = the user's own schedule; otherwise a friend's.
  person_id uuid references grades_schedule_people(id) on delete cascade,
  day smallint not null check (day between 0 and 4), -- 0=Mon .. 4=Fri
  start_time text not null, -- "HH:MM", 24h
  end_time text not null,   -- "HH:MM", 24h
  subject text not null,
  color text not null default '#8b5cf6',
  created_at timestamptz not null default now()
);

alter table grades_schedule_blocks enable row level security;

create policy "select own grades_schedule_blocks" on grades_schedule_blocks
  for select using (auth.uid() = user_id);
create policy "insert own grades_schedule_blocks" on grades_schedule_blocks
  for insert with check (auth.uid() = user_id);
create policy "update own grades_schedule_blocks" on grades_schedule_blocks
  for update using (auth.uid() = user_id);
create policy "delete own grades_schedule_blocks" on grades_schedule_blocks
  for delete using (auth.uid() = user_id);
