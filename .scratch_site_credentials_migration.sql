create table public.site_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_name text not null default '',
  url text not null default '',
  username text not null default '',
  password text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table public.site_credentials enable row level security;

create policy "Users can view their own site credentials"
  on public.site_credentials for select
  using (auth.uid() = user_id);

create policy "Users can insert their own site credentials"
  on public.site_credentials for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own site credentials"
  on public.site_credentials for update
  using (auth.uid() = user_id);

create policy "Users can delete their own site credentials"
  on public.site_credentials for delete
  using (auth.uid() = user_id);
