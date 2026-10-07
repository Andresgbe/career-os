-- ============================================================
-- TODO LO PENDIENTE DE NEXUS, EN UN SOLO BLOQUE
-- Pégalo completo en el SQL editor de Supabase (proyecto
-- dmhlbgdakispkgbucgmq) y dale Run.
--
-- Es idempotente: puedes correrlo las veces que quieras sin romper nada.
-- Cada política se borra antes de crearse, porque Postgres no soporta
-- "create policy if not exists" y el editor revierte TODO el bloque si
-- una sola línea falla.
-- ============================================================

-- ------------------------------------------------------------
-- 1. TAREAS — to-do list simple, sin estados
--    Se cambia el sistema de estados por un simple "hecha / no hecha",
--    y cada tarea puede pertenecer a un proyecto (o a ninguno, que es
--    tu lista personal).
-- ------------------------------------------------------------

alter table tasks
  add column if not exists project_id uuid
    references personal_projects(id) on delete set null;

alter table tasks
  add column if not exists done boolean not null default false;

-- Quién es responsable de la tarea (texto libre, vacío = nadie)
alter table tasks
  add column if not exists assignee text not null default '';

-- Las tareas que ya estaban en un estado "terminado" quedan marcadas hechas
update tasks
set done = true
where done = false
  and status_id in (select id from task_statuses where is_done);

-- status_id deja de usarse; se vuelve opcional para que las altas nuevas
-- no lo necesiten. La columna y la tabla task_statuses se pueden borrar
-- en la PARTE FINAL de abajo, después de hacer push.
alter table tasks alter column status_id drop not null;

-- Los proyectos ya no tienen status. Igual que arriba: se deja nullable
-- ahora y se borra al final, después de desplegar.
alter table personal_projects alter column status drop not null;

-- ------------------------------------------------------------
-- 2. KNOWLEDGE — carpetas y documentos markdown de contexto
-- ------------------------------------------------------------

create table if not exists knowledge_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#8b5cf6',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table knowledge_folders enable row level security;

drop policy if exists "select own knowledge_folders" on knowledge_folders;
drop policy if exists "insert own knowledge_folders" on knowledge_folders;
drop policy if exists "update own knowledge_folders" on knowledge_folders;
drop policy if exists "delete own knowledge_folders" on knowledge_folders;

create policy "select own knowledge_folders" on knowledge_folders
  for select using (auth.uid() = user_id);
create policy "insert own knowledge_folders" on knowledge_folders
  for insert with check (auth.uid() = user_id);
create policy "update own knowledge_folders" on knowledge_folders
  for update using (auth.uid() = user_id);
create policy "delete own knowledge_folders" on knowledge_folders
  for delete using (auth.uid() = user_id);

create table if not exists knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references knowledge_folders(id) on delete set null,
  title text not null,
  content text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table knowledge_docs enable row level security;

drop policy if exists "select own knowledge_docs" on knowledge_docs;
drop policy if exists "insert own knowledge_docs" on knowledge_docs;
drop policy if exists "update own knowledge_docs" on knowledge_docs;
drop policy if exists "delete own knowledge_docs" on knowledge_docs;

create policy "select own knowledge_docs" on knowledge_docs
  for select using (auth.uid() = user_id);
create policy "insert own knowledge_docs" on knowledge_docs
  for insert with check (auth.uid() = user_id);
create policy "update own knowledge_docs" on knowledge_docs
  for update using (auth.uid() = user_id);
create policy "delete own knowledge_docs" on knowledge_docs
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. TO BUY — la lista de compras (módulo que hoy está roto)
-- ------------------------------------------------------------

create table if not exists tobuy_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#8b5cf6',
  sort_order integer not null default 0,
  collapsed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table tobuy_categories enable row level security;

drop policy if exists "select own tobuy_categories" on tobuy_categories;
drop policy if exists "insert own tobuy_categories" on tobuy_categories;
drop policy if exists "update own tobuy_categories" on tobuy_categories;
drop policy if exists "delete own tobuy_categories" on tobuy_categories;

create policy "select own tobuy_categories" on tobuy_categories
  for select using (auth.uid() = user_id);
create policy "insert own tobuy_categories" on tobuy_categories
  for insert with check (auth.uid() = user_id);
create policy "update own tobuy_categories" on tobuy_categories
  for update using (auth.uid() = user_id);
create policy "delete own tobuy_categories" on tobuy_categories
  for delete using (auth.uid() = user_id);

create table if not exists tobuy_items (
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

drop policy if exists "select own tobuy_items" on tobuy_items;
drop policy if exists "insert own tobuy_items" on tobuy_items;
drop policy if exists "update own tobuy_items" on tobuy_items;
drop policy if exists "delete own tobuy_items" on tobuy_items;

create policy "select own tobuy_items" on tobuy_items
  for select using (auth.uid() = user_id);
create policy "insert own tobuy_items" on tobuy_items
  for insert with check (auth.uid() = user_id);
create policy "update own tobuy_items" on tobuy_items
  for update using (auth.uid() = user_id);
create policy "delete own tobuy_items" on tobuy_items
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4. BUCKET grades-files — fotos del plan de evaluación
--    Las políticas ya existían de un intento anterior, por eso
--    se borran primero.
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('grades-files', 'grades-files', true)
on conflict (id) do update set public = true;

drop policy if exists "grades-files public read" on storage.objects;
drop policy if exists "grades-files insert own" on storage.objects;
drop policy if exists "grades-files update own" on storage.objects;
drop policy if exists "grades-files delete own" on storage.objects;

create policy "grades-files public read"
  on storage.objects for select
  using (bucket_id = 'grades-files');

create policy "grades-files insert own"
  on storage.objects for insert
  with check (
    bucket_id = 'grades-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "grades-files update own"
  on storage.objects for update
  using (
    bucket_id = 'grades-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "grades-files delete own"
  on storage.objects for delete
  using (
    bucket_id = 'grades-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ============================================================
-- PARTE FINAL — CORRE ESTO APARTE, DESPUÉS DE HACER PUSH
--
-- Borra de verdad la columna de status. Si la corres ANTES de que
-- Vercel tenga la versión nueva, la app desplegada se rompe en la
-- página de proyectos, porque el código viejo todavía la lee.
--
--   alter table personal_projects drop column if exists status;
--   alter table tasks drop column if exists status_id;
--   alter table tasks drop column if exists project;
--   drop table if exists task_statuses;
--
-- ============================================================
