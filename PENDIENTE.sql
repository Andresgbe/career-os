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
-- 1b. CHAT — cola de mensajes entre NEXUS y el worker de tu PC
--     Escribís desde el teléfono, queda en "pending", y el worker
--     lo responde cuando tu computadora esté encendida.
-- ------------------------------------------------------------

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'error')),
  session_id text,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_pending_idx
  on chat_messages (user_id, status) where status = 'pending';

alter table chat_messages enable row level security;

drop policy if exists "select own chat_messages" on chat_messages;
drop policy if exists "insert own chat_messages" on chat_messages;
drop policy if exists "update own chat_messages" on chat_messages;
drop policy if exists "delete own chat_messages" on chat_messages;

create policy "select own chat_messages" on chat_messages
  for select using (auth.uid() = user_id);
create policy "insert own chat_messages" on chat_messages
  for insert with check (auth.uid() = user_id);
create policy "update own chat_messages" on chat_messages
  for update using (auth.uid() = user_id);
create policy "delete own chat_messages" on chat_messages
  for delete using (auth.uid() = user_id);

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


-- ============================================================
-- BLOQUE 2 — FOTOS EN EL CHAT
-- Corre esto también. Permite adjuntar una imagen a un mensaje
-- del chat para que Claude la archive donde corresponda.
-- ============================================================

-- Ruta del archivo adjunto dentro del bucket chat-files
alter table chat_messages
  add column if not exists image_path text;

-- Bucket PRIVADO: una foto de un examen médico no debe quedar
-- accesible con solo tener el link.
insert into storage.buckets (id, name, public)
values ('chat-files', 'chat-files', false)
on conflict (id) do update set public = false;

drop policy if exists "chat-files select own" on storage.objects;
drop policy if exists "chat-files insert own" on storage.objects;
drop policy if exists "chat-files delete own" on storage.objects;

create policy "chat-files select own"
  on storage.objects for select
  using (
    bucket_id = 'chat-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "chat-files insert own"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "chat-files delete own"
  on storage.objects for delete
  using (
    bucket_id = 'chat-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ============================================
-- BLOQUE 3 — PROYECTOS SIN PRESUPUESTO NI ESTADO DE PAGO
-- Los proyectos ya no llevan budget ni payment_status. Igual que con
-- status: acá solo se vuelven opcionales, para que la app vieja que
-- todavía esté desplegada no se rompa. Las columnas se borran de verdad
-- en la PARTE FINAL, después de hacer push.
-- ============================================

alter table personal_projects alter column budget drop not null;
alter table personal_projects alter column payment_status drop not null;

-- Y en la PARTE FINAL, junto con las otras:
--
--   alter table personal_projects drop column if exists budget;
--   alter table personal_projects drop column if exists payment_status;


-- ============================================
-- BLOQUE 4 — PANEL DE ADMINISTRADOR Y PERMISOS POR MÓDULO
--
-- Hasta ahora toda tabla decía "solo el dueño ve sus filas"
-- (auth.uid() = user_id). A partir de acá:
--   · Andrés es admin y sigue viendo y haciendo todo.
--   · Cualquier otra cuenta no ve NADA hasta que él la habilite,
--     módulo por módulo, con permiso de ver y/o editar.
--   · En Project Management, además, hay que elegir qué proyectos
--     puede ver cada invitado.
--   · BORRAR datos de Andrés es solo de Andrés. "Editar" no incluye
--     borrar, a propósito.
--
-- Es idempotente: se puede correr las veces que haga falta.
-- ============================================

-- ------------------------------------------------------------
-- 4.1 Perfiles: quién es admin, quién es invitado, quién está activo
-- ------------------------------------------------------------

create table if not exists app_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  role text not null default 'member' check (role in ('admin', 'member')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Cuando se crea una cuenta en Supabase, se le crea el perfil solo.
-- Nace como 'member' e inactivo en la práctica: sin permisos no ve nada.
create or replace function public.nexus_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into app_profiles (user_id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (user_id) do nothing;
  return new;
end;
$fn$;

drop trigger if exists nexus_on_auth_user_created on auth.users;
create trigger nexus_on_auth_user_created
  after insert on auth.users
  for each row execute function public.nexus_handle_new_user();

-- Perfiles para las cuentas que ya existían
insert into app_profiles (user_id, email)
select id, coalesce(email, '') from auth.users
on conflict (user_id) do nothing;

-- El admin. Si algún día cambia el correo, se cambia acá.
update app_profiles
set role = 'admin', active = true
where email = 'andresgilbe2021@gmail.com';

-- ------------------------------------------------------------
-- 4.2 Permisos
-- ------------------------------------------------------------

create table if not exists app_module_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module text not null,
  can_view boolean not null default false,
  can_edit boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, module)
);

create table if not exists app_project_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references personal_projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, project_id)
);

-- ------------------------------------------------------------
-- 4.3 Funciones de permiso
--
-- security definer a propósito: leen app_profiles y app_*_permissions
-- saltándose RLS. Si no, una política que pregunta "¿sos admin?" tendría
-- que leer app_profiles, cuya política pregunta "¿sos admin?", y entra en
-- recursión infinita.
-- ------------------------------------------------------------

create or replace function public.nexus_is_admin()
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from app_profiles
    where user_id = auth.uid() and role = 'admin' and active
  );
$fn$;

create or replace function public.nexus_can_view(p_module text)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.nexus_is_admin() or exists (
    select 1
    from app_module_permissions mp
    join app_profiles p on p.user_id = mp.user_id
    where mp.user_id = auth.uid()
      and p.active
      and mp.module = p_module
      and mp.can_view
  );
$fn$;

create or replace function public.nexus_can_edit(p_module text)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.nexus_is_admin() or exists (
    select 1
    from app_module_permissions mp
    join app_profiles p on p.user_id = mp.user_id
    where mp.user_id = auth.uid()
      and p.active
      and mp.module = p_module
      and mp.can_edit
  );
$fn$;

create or replace function public.nexus_can_see_project(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.nexus_is_admin() or exists (
    select 1
    from app_project_permissions pp
    join app_profiles p on p.user_id = pp.user_id
    where pp.user_id = auth.uid()
      and p.active
      and pp.project_id = p_project
  );
$fn$;

-- ------------------------------------------------------------
-- 4.4 RLS de las tablas del panel
-- ------------------------------------------------------------

alter table app_profiles enable row level security;
alter table app_module_permissions enable row level security;
alter table app_project_permissions enable row level security;

do $do$
declare
  t text;
  pol record;
begin
  foreach t in array array['app_profiles', 'app_module_permissions', 'app_project_permissions']
  loop
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;

    -- Cada quien ve lo suyo (necesita saber qué puede abrir); el admin ve todo
    execute format(
      'create policy "nexus read" on public.%I for select using (user_id = auth.uid() or public.nexus_is_admin())', t);
    -- Escribir permisos y perfiles es solo del admin
    execute format(
      'create policy "nexus insert" on public.%I for insert with check (public.nexus_is_admin())', t);
    execute format(
      'create policy "nexus update" on public.%I for update using (public.nexus_is_admin())', t);
    execute format(
      'create policy "nexus delete" on public.%I for delete using (public.nexus_is_admin())', t);
  end loop;
end
$do$;

-- ------------------------------------------------------------
-- 4.5 RLS de las tablas de datos
--
-- Se borran TODAS las políticas viejas de cada tabla (tienen nombres
-- distintos según cuándo se crearon) y se ponen cuatro nuevas con el
-- mismo nombre en todas, para que esto se pueda volver a correr.
-- ------------------------------------------------------------

do $do$
declare
  t record;
  pol record;
begin
  for t in
    select * from (values
      ('tobuy_categories',          'tasks'),
      ('tobuy_items',               'tasks'),
      ('motorcycle_info',           'motorcycle'),
      ('oil_changes',               'motorcycle'),
      ('motorcycle_to_buy',         'motorcycle'),
      ('motorcycle_audit_log',      'motorcycle'),
      ('motorcycle_attachments',    'motorcycle'),
      ('medical_history',           'medical'),
      ('medical_history_files',     'medical'),
      ('medical_exams',             'medical'),
      ('medical_contacts',          'medical'),
      ('content_categories',        'content'),
      ('content_ideas',             'content'),
      ('grades_subjects',           'grades'),
      ('grades_evaluations',        'grades'),
      ('grades_schedule_blocks',    'grades'),
      ('grades_schedule_people',    'grades'),
      ('grades_curriculum_progress','grades'),
      ('grades_curriculum_stats',   'grades'),
      ('grades_payment_plans',      'grades'),
      ('grades_shortcuts',          'grades'),
      ('programming_resources',     'programming'),
      ('programming_shortcuts',     'programming'),
      ('insurance_policies',        'insurance'),
      ('finance_monthly_budget',    'finance'),
      ('finance_bills',             'finance'),
      ('site_credentials',          'passwords'),
      ('knowledge_folders',         'knowledge'),
      ('knowledge_docs',            'knowledge')
    ) as x(tbl, module)
  loop
    if to_regclass('public.' || t.tbl) is null then
      raise notice 'salto %, no existe', t.tbl;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t.tbl);

    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = t.tbl
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t.tbl);
    end loop;

    execute format(
      'create policy "nexus read" on public.%I for select using (user_id = auth.uid() or public.nexus_can_view(%L))',
      t.tbl, t.module);
    execute format(
      'create policy "nexus insert" on public.%I for insert with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit(%L)))',
      t.tbl, t.module);
    execute format(
      'create policy "nexus update" on public.%I for update using (user_id = auth.uid() or public.nexus_can_edit(%L))',
      t.tbl, t.module);
    -- Borrar datos ajenos: nunca. Cada quien borra lo propio.
    execute format(
      'create policy "nexus delete" on public.%I for delete using (user_id = auth.uid())',
      t.tbl);
  end loop;
end
$do$;

-- ------------------------------------------------------------
-- 4.6 Project Management: además del módulo, proyecto por proyecto
-- ------------------------------------------------------------

do $do$
declare
  pol record;
  t text;
begin
  foreach t in array array['personal_projects', 'project_entries', 'project_design_entries', 'tasks']
  loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
  end loop;
end
$do$;

create policy "nexus read" on personal_projects for select
  using (
    user_id = auth.uid()
    or (public.nexus_can_view('projects') and public.nexus_can_see_project(id))
  );
create policy "nexus insert" on personal_projects for insert
  with check (user_id = auth.uid() and public.nexus_is_admin());
create policy "nexus update" on personal_projects for update
  using (
    user_id = auth.uid()
    or (public.nexus_can_edit('projects') and public.nexus_can_see_project(id))
  );
create policy "nexus delete" on personal_projects for delete
  using (user_id = auth.uid());

create policy "nexus read" on project_entries for select
  using (
    user_id = auth.uid()
    or (public.nexus_can_view('projects') and public.nexus_can_see_project(project_id))
  );
create policy "nexus insert" on project_entries for insert
  with check (
    user_id = auth.uid()
    and (public.nexus_is_admin() or (public.nexus_can_edit('projects') and public.nexus_can_see_project(project_id)))
  );
create policy "nexus update" on project_entries for update
  using (
    user_id = auth.uid()
    or (public.nexus_can_edit('projects') and public.nexus_can_see_project(project_id))
  );
create policy "nexus delete" on project_entries for delete
  using (user_id = auth.uid());

create policy "nexus read" on project_design_entries for select
  using (
    user_id = auth.uid()
    or (public.nexus_can_view('projects') and public.nexus_can_see_project(project_id))
  );
create policy "nexus insert" on project_design_entries for insert
  with check (
    user_id = auth.uid()
    and (public.nexus_is_admin() or (public.nexus_can_edit('projects') and public.nexus_can_see_project(project_id)))
  );
create policy "nexus update" on project_design_entries for update
  using (
    user_id = auth.uid()
    or (public.nexus_can_edit('projects') and public.nexus_can_see_project(project_id))
  );
create policy "nexus delete" on project_design_entries for delete
  using (user_id = auth.uid());

-- Las tareas sin proyecto son la lista personal (módulo Pending); las que
-- tienen proyecto siguen el permiso de ESE proyecto.
create policy "nexus read" on tasks for select
  using (
    user_id = auth.uid()
    or (project_id is null and public.nexus_can_view('tasks'))
    or (project_id is not null and public.nexus_can_view('projects')
        and public.nexus_can_see_project(project_id))
  );
create policy "nexus insert" on tasks for insert
  with check (
    user_id = auth.uid()
    and (
      public.nexus_is_admin()
      or (project_id is null and public.nexus_can_edit('tasks'))
      or (project_id is not null and public.nexus_can_edit('projects')
          and public.nexus_can_see_project(project_id))
    )
  );
create policy "nexus update" on tasks for update
  using (
    user_id = auth.uid()
    or (project_id is null and public.nexus_can_edit('tasks'))
    or (project_id is not null and public.nexus_can_edit('projects')
        and public.nexus_can_see_project(project_id))
  );
create policy "nexus delete" on tasks for delete
  using (user_id = auth.uid());

-- ------------------------------------------------------------
-- 4.7 Lo que sigue siendo privado de cada cuenta
--
-- El tablero del dashboard, los accesos directos, las pastillas, las notas
-- de sección y el chat NO se comparten: cada cuenta tiene los suyos.
-- Sus políticas viejas (auth.uid() = user_id) ya hacen exactamente eso,
-- así que no se tocan.
-- ------------------------------------------------------------
