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
      ('finance_categories',       'finance'),
      ('finance_rates',            'finance'),
      ('finance_transactions',     'finance'),
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


-- ============================================
-- BLOQUE 5 — FINANZAS: INGRESOS Y GASTOS
--
-- Cada transacción se guarda en la moneda en la que pasó, con la tasa que
-- se usó ese día, y además su equivalente en dólares BCV ya calculado.
-- El equivalente se guarda, no se recalcula: un gasto de hace tres meses
-- no debe cambiar de valor porque hoy se movió la tasa.
--
-- Regla única de conversión:
--   rate_per_usd = cuántas unidades de esa moneda equivalen a 1 USD BCV
--   amount_usd   = amount / rate_per_usd
-- Para USD la tasa es 1. Para bolívares a 36,50 es 36.50. Para euros a
-- 0,925 € por dólar es 0.925.
-- ============================================

-- ------------------------------------------------------------
-- 5.1 Categorías
-- ------------------------------------------------------------

create table if not exists finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'expense' check (kind in ('income', 'expense', 'both')),
  color text not null default '#8b5cf6',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ------------------------------------------------------------
-- 5.2 Tasas de cambio guardadas
--
-- per_usd queda en null a propósito hasta que Andrés las cargue: una tasa
-- inventada convertiría mal sin avisar.
-- ------------------------------------------------------------

create table if not exists finance_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  label text not null default '',
  currency text not null default 'VES',
  per_usd numeric check (per_usd is null or per_usd > 0),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, code)
);

-- ------------------------------------------------------------
-- 5.3 Transacciones
-- ------------------------------------------------------------

create table if not exists finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  occurred_on date not null default current_date,
  description text not null default '',
  place text not null default '',
  category_id uuid references finance_categories(id) on delete set null,
  amount numeric not null check (amount > 0),
  currency text not null default 'USD',
  rate_per_usd numeric not null default 1 check (rate_per_usd > 0),
  rate_label text not null default '',
  amount_usd numeric not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists finance_transactions_month_idx
  on finance_transactions (user_id, occurred_on desc);

-- ------------------------------------------------------------
-- 5.4 Semilla: categorías y tasas para la cuenta de Andrés
-- ------------------------------------------------------------

insert into finance_categories (user_id, name, kind, color, sort_order)
select u.id, c.name, c.kind, c.color, c.ord
from auth.users u
cross join (values
  ('Supermercado',    'expense', '#10b981', 0),
  ('Comida fuera',    'expense', '#f59e0b', 1),
  ('Transporte',      'expense', '#06b6d4', 2),
  ('Gasolina',        'expense', '#ef4444', 3),
  ('Moto',            'expense', '#f97316', 4),
  ('Universidad',     'expense', '#8b5cf6', 5),
  ('Salud',           'expense', '#ec4899', 6),
  ('Servicios',       'expense', '#3b82f6', 7),
  ('Suscripciones',   'expense', '#a855f7', 8),
  ('Casa',            'expense', '#14b8a6', 9),
  ('Ocio',            'expense', '#eab308', 10),
  ('Otros gastos',    'expense', '#64748b', 11),
  ('Agencia',         'income',  '#22c55e', 12),
  ('Freelance',       'income',  '#84cc16', 13),
  ('Otros ingresos',  'income',  '#64748b', 14)
) as c(name, kind, color, ord)
where u.email = 'andresgilbe2021@gmail.com'
on conflict (user_id, name) do nothing;

insert into finance_rates (user_id, code, label, currency, per_usd)
select u.id, r.code, r.label, r.currency, null
from auth.users u
cross join (values
  ('BCV',      'Bolívar BCV',       'VES'),
  ('PARALELO', 'Bolívar paralelo',  'VES'),
  ('EUR',      'Euro',              'EUR')
) as r(code, label, currency)
where u.email = 'andresgilbe2021@gmail.com'
on conflict (user_id, code) do nothing;

-- ------------------------------------------------------------
-- 5.5 RLS — mismas cuatro políticas que el resto del módulo finance
-- ------------------------------------------------------------

do $do$
declare
  t text;
  pol record;
begin
  foreach t in array array['finance_categories', 'finance_rates', 'finance_transactions']
  loop
    execute format('alter table public.%I enable row level security', t);

    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
  end loop;
end
$do$;

create policy "nexus read" on finance_categories for select
  using (user_id = auth.uid() or public.nexus_can_view('finance'));
create policy "nexus insert" on finance_categories for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('finance')));
create policy "nexus update" on finance_categories for update
  using (user_id = auth.uid() or public.nexus_can_edit('finance'));
create policy "nexus delete" on finance_categories for delete
  using (user_id = auth.uid());

create policy "nexus read" on finance_rates for select
  using (user_id = auth.uid() or public.nexus_can_view('finance'));
create policy "nexus insert" on finance_rates for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('finance')));
create policy "nexus update" on finance_rates for update
  using (user_id = auth.uid() or public.nexus_can_edit('finance'));
create policy "nexus delete" on finance_rates for delete
  using (user_id = auth.uid());

create policy "nexus read" on finance_transactions for select
  using (user_id = auth.uid() or public.nexus_can_view('finance'));
create policy "nexus insert" on finance_transactions for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('finance')));
create policy "nexus update" on finance_transactions for update
  using (user_id = auth.uid() or public.nexus_can_edit('finance'));
create policy "nexus delete" on finance_transactions for delete
  using (user_id = auth.uid());


-- ============================================
-- BLOQUE 6 — HISTORIAL DE CHATS
--
-- Hasta ahora el chat era una sola conversación infinita. Ahora hay varias:
-- cada una con su título y su sesión de Claude propia, así empezar una
-- nueva arranca de cero en vez de arrastrar todo el contexto anterior.
--
-- El chat sigue siendo privado de cada cuenta: estas tablas NO se comparten
-- con los invitados, y por eso las políticas son las de siempre
-- (auth.uid() = user_id), no las de permisos por módulo.
-- ============================================

create table if not exists chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nueva conversación',
  -- La sesión de Claude Code de ESTA conversación. Cada una tiene la suya:
  -- es lo que hace que empezar una nueva empiece de verdad de cero.
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_conversations_recent_idx
  on chat_conversations (user_id, updated_at desc);

alter table chat_messages
  add column if not exists conversation_id uuid
    references chat_conversations(id) on delete cascade;

create index if not exists chat_messages_conversation_idx
  on chat_messages (conversation_id, created_at);

-- Lo que ya existía pasa a una conversación llamada "Historial", para no
-- perder nada. Solo corre si hay mensajes sueltos.
do $do$
declare
  u record;
  conv uuid;
begin
  for u in
    select distinct user_id from chat_messages where conversation_id is null
  loop
    insert into chat_conversations (user_id, title, created_at, updated_at)
    values (u.user_id, 'Historial', now(), now())
    returning id into conv;

    update chat_messages
    set conversation_id = conv
    where user_id = u.user_id and conversation_id is null;
  end loop;
end
$do$;

alter table chat_conversations enable row level security;

drop policy if exists "select own chat_conversations" on chat_conversations;
drop policy if exists "insert own chat_conversations" on chat_conversations;
drop policy if exists "update own chat_conversations" on chat_conversations;
drop policy if exists "delete own chat_conversations" on chat_conversations;

create policy "select own chat_conversations" on chat_conversations
  for select using (auth.uid() = user_id);
create policy "insert own chat_conversations" on chat_conversations
  for insert with check (auth.uid() = user_id);
create policy "update own chat_conversations" on chat_conversations
  for update using (auth.uid() = user_id);
create policy "delete own chat_conversations" on chat_conversations
  for delete using (auth.uid() = user_id);

-- ============================================
-- BLOQUE 7 — LAS POLÍTICAS DEL BLOQUE 4, SIN BLOQUES "DO"
--
-- En el BLOQUE 4 estas políticas estaban dentro de bucles DO $$...$$ y esos
-- bucles no se ejecutaron en el editor: quedaron las tablas y las funciones,
-- pero las políticas no. Resultado: un invitado con permiso de ver un módulo
-- igual no veía nada, porque la tabla seguía con su política vieja
-- (auth.uid() = user_id).
--
-- Acá va todo escrito una por una. Es idempotente: se puede correr de nuevo.
-- Necesita que el BLOQUE 4 ya haya creado las funciones nexus_*.
-- ============================================

-- tobuy_categories (módulo tasks)
alter table tobuy_categories enable row level security;
drop policy if exists "select own tobuy_categories" on tobuy_categories;
drop policy if exists "insert own tobuy_categories" on tobuy_categories;
drop policy if exists "update own tobuy_categories" on tobuy_categories;
drop policy if exists "delete own tobuy_categories" on tobuy_categories;
drop policy if exists "tobuy_categories select own" on tobuy_categories;
drop policy if exists "tobuy_categories insert own" on tobuy_categories;
drop policy if exists "tobuy_categories update own" on tobuy_categories;
drop policy if exists "tobuy_categories delete own" on tobuy_categories;
drop policy if exists "nexus read" on tobuy_categories;
drop policy if exists "nexus insert" on tobuy_categories;
drop policy if exists "nexus update" on tobuy_categories;
drop policy if exists "nexus delete" on tobuy_categories;
create policy "nexus read" on tobuy_categories for select
  using (user_id = auth.uid() or public.nexus_can_view('tasks'));
create policy "nexus insert" on tobuy_categories for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('tasks')));
create policy "nexus update" on tobuy_categories for update
  using (user_id = auth.uid() or public.nexus_can_edit('tasks'));
create policy "nexus delete" on tobuy_categories for delete
  using (user_id = auth.uid());

-- tobuy_items (módulo tasks)
alter table tobuy_items enable row level security;
drop policy if exists "select own tobuy_items" on tobuy_items;
drop policy if exists "insert own tobuy_items" on tobuy_items;
drop policy if exists "update own tobuy_items" on tobuy_items;
drop policy if exists "delete own tobuy_items" on tobuy_items;
drop policy if exists "tobuy_items select own" on tobuy_items;
drop policy if exists "tobuy_items insert own" on tobuy_items;
drop policy if exists "tobuy_items update own" on tobuy_items;
drop policy if exists "tobuy_items delete own" on tobuy_items;
drop policy if exists "nexus read" on tobuy_items;
drop policy if exists "nexus insert" on tobuy_items;
drop policy if exists "nexus update" on tobuy_items;
drop policy if exists "nexus delete" on tobuy_items;
create policy "nexus read" on tobuy_items for select
  using (user_id = auth.uid() or public.nexus_can_view('tasks'));
create policy "nexus insert" on tobuy_items for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('tasks')));
create policy "nexus update" on tobuy_items for update
  using (user_id = auth.uid() or public.nexus_can_edit('tasks'));
create policy "nexus delete" on tobuy_items for delete
  using (user_id = auth.uid());

-- motorcycle_info (módulo motorcycle)
alter table motorcycle_info enable row level security;
drop policy if exists "select own motorcycle_info" on motorcycle_info;
drop policy if exists "insert own motorcycle_info" on motorcycle_info;
drop policy if exists "update own motorcycle_info" on motorcycle_info;
drop policy if exists "delete own motorcycle_info" on motorcycle_info;
drop policy if exists "motorcycle_info select own" on motorcycle_info;
drop policy if exists "motorcycle_info insert own" on motorcycle_info;
drop policy if exists "motorcycle_info update own" on motorcycle_info;
drop policy if exists "motorcycle_info delete own" on motorcycle_info;
drop policy if exists "nexus read" on motorcycle_info;
drop policy if exists "nexus insert" on motorcycle_info;
drop policy if exists "nexus update" on motorcycle_info;
drop policy if exists "nexus delete" on motorcycle_info;
create policy "nexus read" on motorcycle_info for select
  using (user_id = auth.uid() or public.nexus_can_view('motorcycle'));
create policy "nexus insert" on motorcycle_info for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('motorcycle')));
create policy "nexus update" on motorcycle_info for update
  using (user_id = auth.uid() or public.nexus_can_edit('motorcycle'));
create policy "nexus delete" on motorcycle_info for delete
  using (user_id = auth.uid());

-- oil_changes (módulo motorcycle)
alter table oil_changes enable row level security;
drop policy if exists "select own oil_changes" on oil_changes;
drop policy if exists "insert own oil_changes" on oil_changes;
drop policy if exists "update own oil_changes" on oil_changes;
drop policy if exists "delete own oil_changes" on oil_changes;
drop policy if exists "oil_changes select own" on oil_changes;
drop policy if exists "oil_changes insert own" on oil_changes;
drop policy if exists "oil_changes update own" on oil_changes;
drop policy if exists "oil_changes delete own" on oil_changes;
drop policy if exists "nexus read" on oil_changes;
drop policy if exists "nexus insert" on oil_changes;
drop policy if exists "nexus update" on oil_changes;
drop policy if exists "nexus delete" on oil_changes;
create policy "nexus read" on oil_changes for select
  using (user_id = auth.uid() or public.nexus_can_view('motorcycle'));
create policy "nexus insert" on oil_changes for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('motorcycle')));
create policy "nexus update" on oil_changes for update
  using (user_id = auth.uid() or public.nexus_can_edit('motorcycle'));
create policy "nexus delete" on oil_changes for delete
  using (user_id = auth.uid());

-- motorcycle_to_buy (módulo motorcycle)
alter table motorcycle_to_buy enable row level security;
drop policy if exists "select own motorcycle_to_buy" on motorcycle_to_buy;
drop policy if exists "insert own motorcycle_to_buy" on motorcycle_to_buy;
drop policy if exists "update own motorcycle_to_buy" on motorcycle_to_buy;
drop policy if exists "delete own motorcycle_to_buy" on motorcycle_to_buy;
drop policy if exists "motorcycle_to_buy select own" on motorcycle_to_buy;
drop policy if exists "motorcycle_to_buy insert own" on motorcycle_to_buy;
drop policy if exists "motorcycle_to_buy update own" on motorcycle_to_buy;
drop policy if exists "motorcycle_to_buy delete own" on motorcycle_to_buy;
drop policy if exists "nexus read" on motorcycle_to_buy;
drop policy if exists "nexus insert" on motorcycle_to_buy;
drop policy if exists "nexus update" on motorcycle_to_buy;
drop policy if exists "nexus delete" on motorcycle_to_buy;
create policy "nexus read" on motorcycle_to_buy for select
  using (user_id = auth.uid() or public.nexus_can_view('motorcycle'));
create policy "nexus insert" on motorcycle_to_buy for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('motorcycle')));
create policy "nexus update" on motorcycle_to_buy for update
  using (user_id = auth.uid() or public.nexus_can_edit('motorcycle'));
create policy "nexus delete" on motorcycle_to_buy for delete
  using (user_id = auth.uid());

-- motorcycle_audit_log (módulo motorcycle)
alter table motorcycle_audit_log enable row level security;
drop policy if exists "select own motorcycle_audit_log" on motorcycle_audit_log;
drop policy if exists "insert own motorcycle_audit_log" on motorcycle_audit_log;
drop policy if exists "update own motorcycle_audit_log" on motorcycle_audit_log;
drop policy if exists "delete own motorcycle_audit_log" on motorcycle_audit_log;
drop policy if exists "motorcycle_audit_log select own" on motorcycle_audit_log;
drop policy if exists "motorcycle_audit_log insert own" on motorcycle_audit_log;
drop policy if exists "motorcycle_audit_log update own" on motorcycle_audit_log;
drop policy if exists "motorcycle_audit_log delete own" on motorcycle_audit_log;
drop policy if exists "nexus read" on motorcycle_audit_log;
drop policy if exists "nexus insert" on motorcycle_audit_log;
drop policy if exists "nexus update" on motorcycle_audit_log;
drop policy if exists "nexus delete" on motorcycle_audit_log;
create policy "nexus read" on motorcycle_audit_log for select
  using (user_id = auth.uid() or public.nexus_can_view('motorcycle'));
create policy "nexus insert" on motorcycle_audit_log for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('motorcycle')));
create policy "nexus update" on motorcycle_audit_log for update
  using (user_id = auth.uid() or public.nexus_can_edit('motorcycle'));
create policy "nexus delete" on motorcycle_audit_log for delete
  using (user_id = auth.uid());

-- motorcycle_attachments (módulo motorcycle)
alter table motorcycle_attachments enable row level security;
drop policy if exists "select own motorcycle_attachments" on motorcycle_attachments;
drop policy if exists "insert own motorcycle_attachments" on motorcycle_attachments;
drop policy if exists "update own motorcycle_attachments" on motorcycle_attachments;
drop policy if exists "delete own motorcycle_attachments" on motorcycle_attachments;
drop policy if exists "motorcycle_attachments select own" on motorcycle_attachments;
drop policy if exists "motorcycle_attachments insert own" on motorcycle_attachments;
drop policy if exists "motorcycle_attachments update own" on motorcycle_attachments;
drop policy if exists "motorcycle_attachments delete own" on motorcycle_attachments;
drop policy if exists "nexus read" on motorcycle_attachments;
drop policy if exists "nexus insert" on motorcycle_attachments;
drop policy if exists "nexus update" on motorcycle_attachments;
drop policy if exists "nexus delete" on motorcycle_attachments;
create policy "nexus read" on motorcycle_attachments for select
  using (user_id = auth.uid() or public.nexus_can_view('motorcycle'));
create policy "nexus insert" on motorcycle_attachments for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('motorcycle')));
create policy "nexus update" on motorcycle_attachments for update
  using (user_id = auth.uid() or public.nexus_can_edit('motorcycle'));
create policy "nexus delete" on motorcycle_attachments for delete
  using (user_id = auth.uid());

-- medical_history (módulo medical)
alter table medical_history enable row level security;
drop policy if exists "select own medical_history" on medical_history;
drop policy if exists "insert own medical_history" on medical_history;
drop policy if exists "update own medical_history" on medical_history;
drop policy if exists "delete own medical_history" on medical_history;
drop policy if exists "medical_history select own" on medical_history;
drop policy if exists "medical_history insert own" on medical_history;
drop policy if exists "medical_history update own" on medical_history;
drop policy if exists "medical_history delete own" on medical_history;
drop policy if exists "nexus read" on medical_history;
drop policy if exists "nexus insert" on medical_history;
drop policy if exists "nexus update" on medical_history;
drop policy if exists "nexus delete" on medical_history;
create policy "nexus read" on medical_history for select
  using (user_id = auth.uid() or public.nexus_can_view('medical'));
create policy "nexus insert" on medical_history for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('medical')));
create policy "nexus update" on medical_history for update
  using (user_id = auth.uid() or public.nexus_can_edit('medical'));
create policy "nexus delete" on medical_history for delete
  using (user_id = auth.uid());

-- medical_history_files (módulo medical)
alter table medical_history_files enable row level security;
drop policy if exists "select own medical_history_files" on medical_history_files;
drop policy if exists "insert own medical_history_files" on medical_history_files;
drop policy if exists "update own medical_history_files" on medical_history_files;
drop policy if exists "delete own medical_history_files" on medical_history_files;
drop policy if exists "medical_history_files select own" on medical_history_files;
drop policy if exists "medical_history_files insert own" on medical_history_files;
drop policy if exists "medical_history_files update own" on medical_history_files;
drop policy if exists "medical_history_files delete own" on medical_history_files;
drop policy if exists "nexus read" on medical_history_files;
drop policy if exists "nexus insert" on medical_history_files;
drop policy if exists "nexus update" on medical_history_files;
drop policy if exists "nexus delete" on medical_history_files;
create policy "nexus read" on medical_history_files for select
  using (user_id = auth.uid() or public.nexus_can_view('medical'));
create policy "nexus insert" on medical_history_files for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('medical')));
create policy "nexus update" on medical_history_files for update
  using (user_id = auth.uid() or public.nexus_can_edit('medical'));
create policy "nexus delete" on medical_history_files for delete
  using (user_id = auth.uid());

-- medical_exams (módulo medical)
alter table medical_exams enable row level security;
drop policy if exists "select own medical_exams" on medical_exams;
drop policy if exists "insert own medical_exams" on medical_exams;
drop policy if exists "update own medical_exams" on medical_exams;
drop policy if exists "delete own medical_exams" on medical_exams;
drop policy if exists "medical_exams select own" on medical_exams;
drop policy if exists "medical_exams insert own" on medical_exams;
drop policy if exists "medical_exams update own" on medical_exams;
drop policy if exists "medical_exams delete own" on medical_exams;
drop policy if exists "nexus read" on medical_exams;
drop policy if exists "nexus insert" on medical_exams;
drop policy if exists "nexus update" on medical_exams;
drop policy if exists "nexus delete" on medical_exams;
create policy "nexus read" on medical_exams for select
  using (user_id = auth.uid() or public.nexus_can_view('medical'));
create policy "nexus insert" on medical_exams for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('medical')));
create policy "nexus update" on medical_exams for update
  using (user_id = auth.uid() or public.nexus_can_edit('medical'));
create policy "nexus delete" on medical_exams for delete
  using (user_id = auth.uid());

-- medical_contacts (módulo medical)
alter table medical_contacts enable row level security;
drop policy if exists "select own medical_contacts" on medical_contacts;
drop policy if exists "insert own medical_contacts" on medical_contacts;
drop policy if exists "update own medical_contacts" on medical_contacts;
drop policy if exists "delete own medical_contacts" on medical_contacts;
drop policy if exists "medical_contacts select own" on medical_contacts;
drop policy if exists "medical_contacts insert own" on medical_contacts;
drop policy if exists "medical_contacts update own" on medical_contacts;
drop policy if exists "medical_contacts delete own" on medical_contacts;
drop policy if exists "nexus read" on medical_contacts;
drop policy if exists "nexus insert" on medical_contacts;
drop policy if exists "nexus update" on medical_contacts;
drop policy if exists "nexus delete" on medical_contacts;
create policy "nexus read" on medical_contacts for select
  using (user_id = auth.uid() or public.nexus_can_view('medical'));
create policy "nexus insert" on medical_contacts for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('medical')));
create policy "nexus update" on medical_contacts for update
  using (user_id = auth.uid() or public.nexus_can_edit('medical'));
create policy "nexus delete" on medical_contacts for delete
  using (user_id = auth.uid());

-- content_categories (módulo content)
alter table content_categories enable row level security;
drop policy if exists "select own content_categories" on content_categories;
drop policy if exists "insert own content_categories" on content_categories;
drop policy if exists "update own content_categories" on content_categories;
drop policy if exists "delete own content_categories" on content_categories;
drop policy if exists "content_categories select own" on content_categories;
drop policy if exists "content_categories insert own" on content_categories;
drop policy if exists "content_categories update own" on content_categories;
drop policy if exists "content_categories delete own" on content_categories;
drop policy if exists "nexus read" on content_categories;
drop policy if exists "nexus insert" on content_categories;
drop policy if exists "nexus update" on content_categories;
drop policy if exists "nexus delete" on content_categories;
create policy "nexus read" on content_categories for select
  using (user_id = auth.uid() or public.nexus_can_view('content'));
create policy "nexus insert" on content_categories for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('content')));
create policy "nexus update" on content_categories for update
  using (user_id = auth.uid() or public.nexus_can_edit('content'));
create policy "nexus delete" on content_categories for delete
  using (user_id = auth.uid());

-- content_ideas (módulo content)
alter table content_ideas enable row level security;
drop policy if exists "select own content_ideas" on content_ideas;
drop policy if exists "insert own content_ideas" on content_ideas;
drop policy if exists "update own content_ideas" on content_ideas;
drop policy if exists "delete own content_ideas" on content_ideas;
drop policy if exists "content_ideas select own" on content_ideas;
drop policy if exists "content_ideas insert own" on content_ideas;
drop policy if exists "content_ideas update own" on content_ideas;
drop policy if exists "content_ideas delete own" on content_ideas;
drop policy if exists "nexus read" on content_ideas;
drop policy if exists "nexus insert" on content_ideas;
drop policy if exists "nexus update" on content_ideas;
drop policy if exists "nexus delete" on content_ideas;
create policy "nexus read" on content_ideas for select
  using (user_id = auth.uid() or public.nexus_can_view('content'));
create policy "nexus insert" on content_ideas for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('content')));
create policy "nexus update" on content_ideas for update
  using (user_id = auth.uid() or public.nexus_can_edit('content'));
create policy "nexus delete" on content_ideas for delete
  using (user_id = auth.uid());

-- grades_subjects (módulo grades)
alter table grades_subjects enable row level security;
drop policy if exists "select own grades_subjects" on grades_subjects;
drop policy if exists "insert own grades_subjects" on grades_subjects;
drop policy if exists "update own grades_subjects" on grades_subjects;
drop policy if exists "delete own grades_subjects" on grades_subjects;
drop policy if exists "grades_subjects select own" on grades_subjects;
drop policy if exists "grades_subjects insert own" on grades_subjects;
drop policy if exists "grades_subjects update own" on grades_subjects;
drop policy if exists "grades_subjects delete own" on grades_subjects;
drop policy if exists "nexus read" on grades_subjects;
drop policy if exists "nexus insert" on grades_subjects;
drop policy if exists "nexus update" on grades_subjects;
drop policy if exists "nexus delete" on grades_subjects;
create policy "nexus read" on grades_subjects for select
  using (user_id = auth.uid() or public.nexus_can_view('grades'));
create policy "nexus insert" on grades_subjects for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('grades')));
create policy "nexus update" on grades_subjects for update
  using (user_id = auth.uid() or public.nexus_can_edit('grades'));
create policy "nexus delete" on grades_subjects for delete
  using (user_id = auth.uid());

-- grades_evaluations (módulo grades)
alter table grades_evaluations enable row level security;
drop policy if exists "select own grades_evaluations" on grades_evaluations;
drop policy if exists "insert own grades_evaluations" on grades_evaluations;
drop policy if exists "update own grades_evaluations" on grades_evaluations;
drop policy if exists "delete own grades_evaluations" on grades_evaluations;
drop policy if exists "grades_evaluations select own" on grades_evaluations;
drop policy if exists "grades_evaluations insert own" on grades_evaluations;
drop policy if exists "grades_evaluations update own" on grades_evaluations;
drop policy if exists "grades_evaluations delete own" on grades_evaluations;
drop policy if exists "nexus read" on grades_evaluations;
drop policy if exists "nexus insert" on grades_evaluations;
drop policy if exists "nexus update" on grades_evaluations;
drop policy if exists "nexus delete" on grades_evaluations;
create policy "nexus read" on grades_evaluations for select
  using (user_id = auth.uid() or public.nexus_can_view('grades'));
create policy "nexus insert" on grades_evaluations for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('grades')));
create policy "nexus update" on grades_evaluations for update
  using (user_id = auth.uid() or public.nexus_can_edit('grades'));
create policy "nexus delete" on grades_evaluations for delete
  using (user_id = auth.uid());

-- grades_schedule_blocks (módulo grades)
alter table grades_schedule_blocks enable row level security;
drop policy if exists "select own grades_schedule_blocks" on grades_schedule_blocks;
drop policy if exists "insert own grades_schedule_blocks" on grades_schedule_blocks;
drop policy if exists "update own grades_schedule_blocks" on grades_schedule_blocks;
drop policy if exists "delete own grades_schedule_blocks" on grades_schedule_blocks;
drop policy if exists "grades_schedule_blocks select own" on grades_schedule_blocks;
drop policy if exists "grades_schedule_blocks insert own" on grades_schedule_blocks;
drop policy if exists "grades_schedule_blocks update own" on grades_schedule_blocks;
drop policy if exists "grades_schedule_blocks delete own" on grades_schedule_blocks;
drop policy if exists "nexus read" on grades_schedule_blocks;
drop policy if exists "nexus insert" on grades_schedule_blocks;
drop policy if exists "nexus update" on grades_schedule_blocks;
drop policy if exists "nexus delete" on grades_schedule_blocks;
create policy "nexus read" on grades_schedule_blocks for select
  using (user_id = auth.uid() or public.nexus_can_view('grades'));
create policy "nexus insert" on grades_schedule_blocks for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('grades')));
create policy "nexus update" on grades_schedule_blocks for update
  using (user_id = auth.uid() or public.nexus_can_edit('grades'));
create policy "nexus delete" on grades_schedule_blocks for delete
  using (user_id = auth.uid());

-- grades_schedule_people (módulo grades)
alter table grades_schedule_people enable row level security;
drop policy if exists "select own grades_schedule_people" on grades_schedule_people;
drop policy if exists "insert own grades_schedule_people" on grades_schedule_people;
drop policy if exists "update own grades_schedule_people" on grades_schedule_people;
drop policy if exists "delete own grades_schedule_people" on grades_schedule_people;
drop policy if exists "grades_schedule_people select own" on grades_schedule_people;
drop policy if exists "grades_schedule_people insert own" on grades_schedule_people;
drop policy if exists "grades_schedule_people update own" on grades_schedule_people;
drop policy if exists "grades_schedule_people delete own" on grades_schedule_people;
drop policy if exists "nexus read" on grades_schedule_people;
drop policy if exists "nexus insert" on grades_schedule_people;
drop policy if exists "nexus update" on grades_schedule_people;
drop policy if exists "nexus delete" on grades_schedule_people;
create policy "nexus read" on grades_schedule_people for select
  using (user_id = auth.uid() or public.nexus_can_view('grades'));
create policy "nexus insert" on grades_schedule_people for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('grades')));
create policy "nexus update" on grades_schedule_people for update
  using (user_id = auth.uid() or public.nexus_can_edit('grades'));
create policy "nexus delete" on grades_schedule_people for delete
  using (user_id = auth.uid());

-- grades_curriculum_progress (módulo grades)
alter table grades_curriculum_progress enable row level security;
drop policy if exists "select own grades_curriculum_progress" on grades_curriculum_progress;
drop policy if exists "insert own grades_curriculum_progress" on grades_curriculum_progress;
drop policy if exists "update own grades_curriculum_progress" on grades_curriculum_progress;
drop policy if exists "delete own grades_curriculum_progress" on grades_curriculum_progress;
drop policy if exists "grades_curriculum_progress select own" on grades_curriculum_progress;
drop policy if exists "grades_curriculum_progress insert own" on grades_curriculum_progress;
drop policy if exists "grades_curriculum_progress update own" on grades_curriculum_progress;
drop policy if exists "grades_curriculum_progress delete own" on grades_curriculum_progress;
drop policy if exists "nexus read" on grades_curriculum_progress;
drop policy if exists "nexus insert" on grades_curriculum_progress;
drop policy if exists "nexus update" on grades_curriculum_progress;
drop policy if exists "nexus delete" on grades_curriculum_progress;
create policy "nexus read" on grades_curriculum_progress for select
  using (user_id = auth.uid() or public.nexus_can_view('grades'));
create policy "nexus insert" on grades_curriculum_progress for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('grades')));
create policy "nexus update" on grades_curriculum_progress for update
  using (user_id = auth.uid() or public.nexus_can_edit('grades'));
create policy "nexus delete" on grades_curriculum_progress for delete
  using (user_id = auth.uid());

-- grades_curriculum_stats (módulo grades)
alter table grades_curriculum_stats enable row level security;
drop policy if exists "select own grades_curriculum_stats" on grades_curriculum_stats;
drop policy if exists "insert own grades_curriculum_stats" on grades_curriculum_stats;
drop policy if exists "update own grades_curriculum_stats" on grades_curriculum_stats;
drop policy if exists "delete own grades_curriculum_stats" on grades_curriculum_stats;
drop policy if exists "grades_curriculum_stats select own" on grades_curriculum_stats;
drop policy if exists "grades_curriculum_stats insert own" on grades_curriculum_stats;
drop policy if exists "grades_curriculum_stats update own" on grades_curriculum_stats;
drop policy if exists "grades_curriculum_stats delete own" on grades_curriculum_stats;
drop policy if exists "nexus read" on grades_curriculum_stats;
drop policy if exists "nexus insert" on grades_curriculum_stats;
drop policy if exists "nexus update" on grades_curriculum_stats;
drop policy if exists "nexus delete" on grades_curriculum_stats;
create policy "nexus read" on grades_curriculum_stats for select
  using (user_id = auth.uid() or public.nexus_can_view('grades'));
create policy "nexus insert" on grades_curriculum_stats for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('grades')));
create policy "nexus update" on grades_curriculum_stats for update
  using (user_id = auth.uid() or public.nexus_can_edit('grades'));
create policy "nexus delete" on grades_curriculum_stats for delete
  using (user_id = auth.uid());

-- grades_payment_plans (módulo grades)
alter table grades_payment_plans enable row level security;
drop policy if exists "select own grades_payment_plans" on grades_payment_plans;
drop policy if exists "insert own grades_payment_plans" on grades_payment_plans;
drop policy if exists "update own grades_payment_plans" on grades_payment_plans;
drop policy if exists "delete own grades_payment_plans" on grades_payment_plans;
drop policy if exists "grades_payment_plans select own" on grades_payment_plans;
drop policy if exists "grades_payment_plans insert own" on grades_payment_plans;
drop policy if exists "grades_payment_plans update own" on grades_payment_plans;
drop policy if exists "grades_payment_plans delete own" on grades_payment_plans;
drop policy if exists "nexus read" on grades_payment_plans;
drop policy if exists "nexus insert" on grades_payment_plans;
drop policy if exists "nexus update" on grades_payment_plans;
drop policy if exists "nexus delete" on grades_payment_plans;
create policy "nexus read" on grades_payment_plans for select
  using (user_id = auth.uid() or public.nexus_can_view('grades'));
create policy "nexus insert" on grades_payment_plans for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('grades')));
create policy "nexus update" on grades_payment_plans for update
  using (user_id = auth.uid() or public.nexus_can_edit('grades'));
create policy "nexus delete" on grades_payment_plans for delete
  using (user_id = auth.uid());

-- grades_shortcuts (módulo grades)
alter table grades_shortcuts enable row level security;
drop policy if exists "select own grades_shortcuts" on grades_shortcuts;
drop policy if exists "insert own grades_shortcuts" on grades_shortcuts;
drop policy if exists "update own grades_shortcuts" on grades_shortcuts;
drop policy if exists "delete own grades_shortcuts" on grades_shortcuts;
drop policy if exists "grades_shortcuts select own" on grades_shortcuts;
drop policy if exists "grades_shortcuts insert own" on grades_shortcuts;
drop policy if exists "grades_shortcuts update own" on grades_shortcuts;
drop policy if exists "grades_shortcuts delete own" on grades_shortcuts;
drop policy if exists "nexus read" on grades_shortcuts;
drop policy if exists "nexus insert" on grades_shortcuts;
drop policy if exists "nexus update" on grades_shortcuts;
drop policy if exists "nexus delete" on grades_shortcuts;
create policy "nexus read" on grades_shortcuts for select
  using (user_id = auth.uid() or public.nexus_can_view('grades'));
create policy "nexus insert" on grades_shortcuts for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('grades')));
create policy "nexus update" on grades_shortcuts for update
  using (user_id = auth.uid() or public.nexus_can_edit('grades'));
create policy "nexus delete" on grades_shortcuts for delete
  using (user_id = auth.uid());

-- programming_resources (módulo programming)
alter table programming_resources enable row level security;
drop policy if exists "select own programming_resources" on programming_resources;
drop policy if exists "insert own programming_resources" on programming_resources;
drop policy if exists "update own programming_resources" on programming_resources;
drop policy if exists "delete own programming_resources" on programming_resources;
drop policy if exists "programming_resources select own" on programming_resources;
drop policy if exists "programming_resources insert own" on programming_resources;
drop policy if exists "programming_resources update own" on programming_resources;
drop policy if exists "programming_resources delete own" on programming_resources;
drop policy if exists "nexus read" on programming_resources;
drop policy if exists "nexus insert" on programming_resources;
drop policy if exists "nexus update" on programming_resources;
drop policy if exists "nexus delete" on programming_resources;
create policy "nexus read" on programming_resources for select
  using (user_id = auth.uid() or public.nexus_can_view('programming'));
create policy "nexus insert" on programming_resources for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('programming')));
create policy "nexus update" on programming_resources for update
  using (user_id = auth.uid() or public.nexus_can_edit('programming'));
create policy "nexus delete" on programming_resources for delete
  using (user_id = auth.uid());

-- programming_shortcuts (módulo programming)
alter table programming_shortcuts enable row level security;
drop policy if exists "select own programming_shortcuts" on programming_shortcuts;
drop policy if exists "insert own programming_shortcuts" on programming_shortcuts;
drop policy if exists "update own programming_shortcuts" on programming_shortcuts;
drop policy if exists "delete own programming_shortcuts" on programming_shortcuts;
drop policy if exists "programming_shortcuts select own" on programming_shortcuts;
drop policy if exists "programming_shortcuts insert own" on programming_shortcuts;
drop policy if exists "programming_shortcuts update own" on programming_shortcuts;
drop policy if exists "programming_shortcuts delete own" on programming_shortcuts;
drop policy if exists "nexus read" on programming_shortcuts;
drop policy if exists "nexus insert" on programming_shortcuts;
drop policy if exists "nexus update" on programming_shortcuts;
drop policy if exists "nexus delete" on programming_shortcuts;
create policy "nexus read" on programming_shortcuts for select
  using (user_id = auth.uid() or public.nexus_can_view('programming'));
create policy "nexus insert" on programming_shortcuts for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('programming')));
create policy "nexus update" on programming_shortcuts for update
  using (user_id = auth.uid() or public.nexus_can_edit('programming'));
create policy "nexus delete" on programming_shortcuts for delete
  using (user_id = auth.uid());

-- insurance_policies (módulo insurance)
alter table insurance_policies enable row level security;
drop policy if exists "select own insurance_policies" on insurance_policies;
drop policy if exists "insert own insurance_policies" on insurance_policies;
drop policy if exists "update own insurance_policies" on insurance_policies;
drop policy if exists "delete own insurance_policies" on insurance_policies;
drop policy if exists "insurance_policies select own" on insurance_policies;
drop policy if exists "insurance_policies insert own" on insurance_policies;
drop policy if exists "insurance_policies update own" on insurance_policies;
drop policy if exists "insurance_policies delete own" on insurance_policies;
drop policy if exists "nexus read" on insurance_policies;
drop policy if exists "nexus insert" on insurance_policies;
drop policy if exists "nexus update" on insurance_policies;
drop policy if exists "nexus delete" on insurance_policies;
create policy "nexus read" on insurance_policies for select
  using (user_id = auth.uid() or public.nexus_can_view('insurance'));
create policy "nexus insert" on insurance_policies for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('insurance')));
create policy "nexus update" on insurance_policies for update
  using (user_id = auth.uid() or public.nexus_can_edit('insurance'));
create policy "nexus delete" on insurance_policies for delete
  using (user_id = auth.uid());

-- finance_monthly_budget (módulo finance)
alter table finance_monthly_budget enable row level security;
drop policy if exists "select own finance_monthly_budget" on finance_monthly_budget;
drop policy if exists "insert own finance_monthly_budget" on finance_monthly_budget;
drop policy if exists "update own finance_monthly_budget" on finance_monthly_budget;
drop policy if exists "delete own finance_monthly_budget" on finance_monthly_budget;
drop policy if exists "finance_monthly_budget select own" on finance_monthly_budget;
drop policy if exists "finance_monthly_budget insert own" on finance_monthly_budget;
drop policy if exists "finance_monthly_budget update own" on finance_monthly_budget;
drop policy if exists "finance_monthly_budget delete own" on finance_monthly_budget;
drop policy if exists "nexus read" on finance_monthly_budget;
drop policy if exists "nexus insert" on finance_monthly_budget;
drop policy if exists "nexus update" on finance_monthly_budget;
drop policy if exists "nexus delete" on finance_monthly_budget;
create policy "nexus read" on finance_monthly_budget for select
  using (user_id = auth.uid() or public.nexus_can_view('finance'));
create policy "nexus insert" on finance_monthly_budget for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('finance')));
create policy "nexus update" on finance_monthly_budget for update
  using (user_id = auth.uid() or public.nexus_can_edit('finance'));
create policy "nexus delete" on finance_monthly_budget for delete
  using (user_id = auth.uid());

-- finance_bills (módulo finance)
alter table finance_bills enable row level security;
drop policy if exists "select own finance_bills" on finance_bills;
drop policy if exists "insert own finance_bills" on finance_bills;
drop policy if exists "update own finance_bills" on finance_bills;
drop policy if exists "delete own finance_bills" on finance_bills;
drop policy if exists "finance_bills select own" on finance_bills;
drop policy if exists "finance_bills insert own" on finance_bills;
drop policy if exists "finance_bills update own" on finance_bills;
drop policy if exists "finance_bills delete own" on finance_bills;
drop policy if exists "nexus read" on finance_bills;
drop policy if exists "nexus insert" on finance_bills;
drop policy if exists "nexus update" on finance_bills;
drop policy if exists "nexus delete" on finance_bills;
create policy "nexus read" on finance_bills for select
  using (user_id = auth.uid() or public.nexus_can_view('finance'));
create policy "nexus insert" on finance_bills for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('finance')));
create policy "nexus update" on finance_bills for update
  using (user_id = auth.uid() or public.nexus_can_edit('finance'));
create policy "nexus delete" on finance_bills for delete
  using (user_id = auth.uid());

-- finance_categories (módulo finance)
alter table finance_categories enable row level security;
drop policy if exists "select own finance_categories" on finance_categories;
drop policy if exists "insert own finance_categories" on finance_categories;
drop policy if exists "update own finance_categories" on finance_categories;
drop policy if exists "delete own finance_categories" on finance_categories;
drop policy if exists "finance_categories select own" on finance_categories;
drop policy if exists "finance_categories insert own" on finance_categories;
drop policy if exists "finance_categories update own" on finance_categories;
drop policy if exists "finance_categories delete own" on finance_categories;
drop policy if exists "nexus read" on finance_categories;
drop policy if exists "nexus insert" on finance_categories;
drop policy if exists "nexus update" on finance_categories;
drop policy if exists "nexus delete" on finance_categories;
create policy "nexus read" on finance_categories for select
  using (user_id = auth.uid() or public.nexus_can_view('finance'));
create policy "nexus insert" on finance_categories for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('finance')));
create policy "nexus update" on finance_categories for update
  using (user_id = auth.uid() or public.nexus_can_edit('finance'));
create policy "nexus delete" on finance_categories for delete
  using (user_id = auth.uid());

-- finance_rates (módulo finance)
alter table finance_rates enable row level security;
drop policy if exists "select own finance_rates" on finance_rates;
drop policy if exists "insert own finance_rates" on finance_rates;
drop policy if exists "update own finance_rates" on finance_rates;
drop policy if exists "delete own finance_rates" on finance_rates;
drop policy if exists "finance_rates select own" on finance_rates;
drop policy if exists "finance_rates insert own" on finance_rates;
drop policy if exists "finance_rates update own" on finance_rates;
drop policy if exists "finance_rates delete own" on finance_rates;
drop policy if exists "nexus read" on finance_rates;
drop policy if exists "nexus insert" on finance_rates;
drop policy if exists "nexus update" on finance_rates;
drop policy if exists "nexus delete" on finance_rates;
create policy "nexus read" on finance_rates for select
  using (user_id = auth.uid() or public.nexus_can_view('finance'));
create policy "nexus insert" on finance_rates for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('finance')));
create policy "nexus update" on finance_rates for update
  using (user_id = auth.uid() or public.nexus_can_edit('finance'));
create policy "nexus delete" on finance_rates for delete
  using (user_id = auth.uid());

-- finance_transactions (módulo finance)
alter table finance_transactions enable row level security;
drop policy if exists "select own finance_transactions" on finance_transactions;
drop policy if exists "insert own finance_transactions" on finance_transactions;
drop policy if exists "update own finance_transactions" on finance_transactions;
drop policy if exists "delete own finance_transactions" on finance_transactions;
drop policy if exists "finance_transactions select own" on finance_transactions;
drop policy if exists "finance_transactions insert own" on finance_transactions;
drop policy if exists "finance_transactions update own" on finance_transactions;
drop policy if exists "finance_transactions delete own" on finance_transactions;
drop policy if exists "nexus read" on finance_transactions;
drop policy if exists "nexus insert" on finance_transactions;
drop policy if exists "nexus update" on finance_transactions;
drop policy if exists "nexus delete" on finance_transactions;
create policy "nexus read" on finance_transactions for select
  using (user_id = auth.uid() or public.nexus_can_view('finance'));
create policy "nexus insert" on finance_transactions for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('finance')));
create policy "nexus update" on finance_transactions for update
  using (user_id = auth.uid() or public.nexus_can_edit('finance'));
create policy "nexus delete" on finance_transactions for delete
  using (user_id = auth.uid());

-- site_credentials (módulo passwords)
alter table site_credentials enable row level security;
drop policy if exists "select own site_credentials" on site_credentials;
drop policy if exists "insert own site_credentials" on site_credentials;
drop policy if exists "update own site_credentials" on site_credentials;
drop policy if exists "delete own site_credentials" on site_credentials;
drop policy if exists "site_credentials select own" on site_credentials;
drop policy if exists "site_credentials insert own" on site_credentials;
drop policy if exists "site_credentials update own" on site_credentials;
drop policy if exists "site_credentials delete own" on site_credentials;
drop policy if exists "nexus read" on site_credentials;
drop policy if exists "nexus insert" on site_credentials;
drop policy if exists "nexus update" on site_credentials;
drop policy if exists "nexus delete" on site_credentials;
create policy "nexus read" on site_credentials for select
  using (user_id = auth.uid() or public.nexus_can_view('passwords'));
create policy "nexus insert" on site_credentials for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('passwords')));
create policy "nexus update" on site_credentials for update
  using (user_id = auth.uid() or public.nexus_can_edit('passwords'));
create policy "nexus delete" on site_credentials for delete
  using (user_id = auth.uid());

-- knowledge_folders (módulo knowledge)
alter table knowledge_folders enable row level security;
drop policy if exists "select own knowledge_folders" on knowledge_folders;
drop policy if exists "insert own knowledge_folders" on knowledge_folders;
drop policy if exists "update own knowledge_folders" on knowledge_folders;
drop policy if exists "delete own knowledge_folders" on knowledge_folders;
drop policy if exists "knowledge_folders select own" on knowledge_folders;
drop policy if exists "knowledge_folders insert own" on knowledge_folders;
drop policy if exists "knowledge_folders update own" on knowledge_folders;
drop policy if exists "knowledge_folders delete own" on knowledge_folders;
drop policy if exists "nexus read" on knowledge_folders;
drop policy if exists "nexus insert" on knowledge_folders;
drop policy if exists "nexus update" on knowledge_folders;
drop policy if exists "nexus delete" on knowledge_folders;
create policy "nexus read" on knowledge_folders for select
  using (user_id = auth.uid() or public.nexus_can_view('knowledge'));
create policy "nexus insert" on knowledge_folders for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('knowledge')));
create policy "nexus update" on knowledge_folders for update
  using (user_id = auth.uid() or public.nexus_can_edit('knowledge'));
create policy "nexus delete" on knowledge_folders for delete
  using (user_id = auth.uid());

-- knowledge_docs (módulo knowledge)
alter table knowledge_docs enable row level security;
drop policy if exists "select own knowledge_docs" on knowledge_docs;
drop policy if exists "insert own knowledge_docs" on knowledge_docs;
drop policy if exists "update own knowledge_docs" on knowledge_docs;
drop policy if exists "delete own knowledge_docs" on knowledge_docs;
drop policy if exists "knowledge_docs select own" on knowledge_docs;
drop policy if exists "knowledge_docs insert own" on knowledge_docs;
drop policy if exists "knowledge_docs update own" on knowledge_docs;
drop policy if exists "knowledge_docs delete own" on knowledge_docs;
drop policy if exists "nexus read" on knowledge_docs;
drop policy if exists "nexus insert" on knowledge_docs;
drop policy if exists "nexus update" on knowledge_docs;
drop policy if exists "nexus delete" on knowledge_docs;
create policy "nexus read" on knowledge_docs for select
  using (user_id = auth.uid() or public.nexus_can_view('knowledge'));
create policy "nexus insert" on knowledge_docs for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('knowledge')));
create policy "nexus update" on knowledge_docs for update
  using (user_id = auth.uid() or public.nexus_can_edit('knowledge'));
create policy "nexus delete" on knowledge_docs for delete
  using (user_id = auth.uid());

-- ------------------------------------------------------------
-- Project Management: además del permiso del módulo, proyecto por proyecto
-- ------------------------------------------------------------

-- personal_projects
alter table personal_projects enable row level security;
drop policy if exists "select own personal_projects" on personal_projects;
drop policy if exists "insert own personal_projects" on personal_projects;
drop policy if exists "update own personal_projects" on personal_projects;
drop policy if exists "delete own personal_projects" on personal_projects;
drop policy if exists "personal_projects select own" on personal_projects;
drop policy if exists "personal_projects insert own" on personal_projects;
drop policy if exists "personal_projects update own" on personal_projects;
drop policy if exists "personal_projects delete own" on personal_projects;
drop policy if exists "nexus read" on personal_projects;
drop policy if exists "nexus insert" on personal_projects;
drop policy if exists "nexus update" on personal_projects;
drop policy if exists "nexus delete" on personal_projects;
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

-- project_entries
alter table project_entries enable row level security;
drop policy if exists "select own project_entries" on project_entries;
drop policy if exists "insert own project_entries" on project_entries;
drop policy if exists "update own project_entries" on project_entries;
drop policy if exists "delete own project_entries" on project_entries;
drop policy if exists "project_entries select own" on project_entries;
drop policy if exists "project_entries insert own" on project_entries;
drop policy if exists "project_entries update own" on project_entries;
drop policy if exists "project_entries delete own" on project_entries;
drop policy if exists "nexus read" on project_entries;
drop policy if exists "nexus insert" on project_entries;
drop policy if exists "nexus update" on project_entries;
drop policy if exists "nexus delete" on project_entries;
create policy "nexus read" on project_entries for select
  using (
    user_id = auth.uid()
    or (public.nexus_can_view('projects') and public.nexus_can_see_project(project_id))
  );
create policy "nexus insert" on project_entries for insert
  with check (user_id = auth.uid()
    and (
      public.nexus_is_admin()
      or (public.nexus_can_edit('projects') and public.nexus_can_see_project(project_id))
    ));
create policy "nexus update" on project_entries for update
  using (
    user_id = auth.uid()
    or (public.nexus_can_edit('projects') and public.nexus_can_see_project(project_id))
  );
create policy "nexus delete" on project_entries for delete
  using (user_id = auth.uid());

-- project_design_entries
alter table project_design_entries enable row level security;
drop policy if exists "select own project_design_entries" on project_design_entries;
drop policy if exists "insert own project_design_entries" on project_design_entries;
drop policy if exists "update own project_design_entries" on project_design_entries;
drop policy if exists "delete own project_design_entries" on project_design_entries;
drop policy if exists "project_design_entries select own" on project_design_entries;
drop policy if exists "project_design_entries insert own" on project_design_entries;
drop policy if exists "project_design_entries update own" on project_design_entries;
drop policy if exists "project_design_entries delete own" on project_design_entries;
drop policy if exists "nexus read" on project_design_entries;
drop policy if exists "nexus insert" on project_design_entries;
drop policy if exists "nexus update" on project_design_entries;
drop policy if exists "nexus delete" on project_design_entries;
create policy "nexus read" on project_design_entries for select
  using (
    user_id = auth.uid()
    or (public.nexus_can_view('projects') and public.nexus_can_see_project(project_id))
  );
create policy "nexus insert" on project_design_entries for insert
  with check (user_id = auth.uid()
    and (
      public.nexus_is_admin()
      or (public.nexus_can_edit('projects') and public.nexus_can_see_project(project_id))
    ));
create policy "nexus update" on project_design_entries for update
  using (
    user_id = auth.uid()
    or (public.nexus_can_edit('projects') and public.nexus_can_see_project(project_id))
  );
create policy "nexus delete" on project_design_entries for delete
  using (user_id = auth.uid());

-- tasks: sin project_id es la lista personal (módulo Pending);
-- con project_id sigue el permiso de ESE proyecto.
alter table tasks enable row level security;
drop policy if exists "select own tasks" on tasks;
drop policy if exists "insert own tasks" on tasks;
drop policy if exists "update own tasks" on tasks;
drop policy if exists "delete own tasks" on tasks;
drop policy if exists "tasks select own" on tasks;
drop policy if exists "tasks insert own" on tasks;
drop policy if exists "tasks update own" on tasks;
drop policy if exists "tasks delete own" on tasks;
drop policy if exists "nexus read" on tasks;
drop policy if exists "nexus insert" on tasks;
drop policy if exists "nexus update" on tasks;
drop policy if exists "nexus delete" on tasks;
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
-- Comprobación: después de correr esto, cada tabla debe tener sus cuatro
-- políticas "nexus *". Si alguna sale con menos de 4, algo no corrió.
-- ------------------------------------------------------------
-- select tablename, count(*) as politicas
-- from pg_policies
-- where schemaname = 'public' and policyname like 'nexus %'
-- group by tablename
-- order by politicas, tablename;


-- ============================================
-- BLOQUE 8 — FORMAS DE PAGO (efectivo, USDT) EN FINANZAS
--
-- No es solo la moneda: 50 $ en efectivo o en USDT valen MÁS que 50 $ BCV,
-- porque se cambian a otra tasa. finance_rates ya servía para esto —
-- "cuántas unidades de X equivalen a 1 USD BCV"—, solo le faltaban filas
-- para el efectivo y el USDT. Para dólares, per_usd queda bajo 1 (valen
-- más que el BCV, hace falta menos para llegar a 1 dólar BCV).
--
-- Se quita además "paralelo": Andrés no la usa, todo se registra a BCV.
-- ============================================

delete from finance_rates where code = 'PARALELO';

update finance_rates set label = 'Bolívares (Bs)' where code = 'BCV';

insert into finance_rates (user_id, code, label, currency, per_usd)
select u.id, r.code, r.label, r.currency, null
from auth.users u
cross join (values
  ('CASH', 'Dólar efectivo', 'USD'),
  ('USDT', 'USDT',           'USD')
) as r(code, label, currency)
where u.email = 'andresgilbe2021@gmail.com'
on conflict (user_id, code) do nothing;


-- ============================================================
-- BLOQUE 9 — SEMANAS POR MATERIA (University)
--
-- Carpetas de las 16 semanas de clase de cada materia: temas, apuntes,
-- código y archivos. Reusa el bucket "grades-files" que ya existe (las
-- fotos pasan por compresión del lado del navegador antes de subir).
--
-- Sin bloques DO: en este editor no se ejecutan (ya pasó dos veces con
-- BLOQUE 4). Todo queda escrito en sentencias sueltas.
-- ============================================================

create table if not exists grades_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references grades_subjects(id) on delete cascade,
  week_number integer not null,
  start_date date,
  end_date date,
  topics jsonb not null default '[]'::jsonb,
  notes text not null default '',
  code text not null default '',
  resources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, week_number)
);

create index if not exists grades_weeks_subject_idx
  on grades_weeks (subject_id, week_number);

alter table grades_weeks enable row level security;

drop policy if exists "nexus read" on grades_weeks;
drop policy if exists "nexus insert" on grades_weeks;
drop policy if exists "nexus update" on grades_weeks;
drop policy if exists "nexus delete" on grades_weeks;

create policy "nexus read" on grades_weeks for select
  using (user_id = auth.uid() or public.nexus_can_view('grades'));
create policy "nexus insert" on grades_weeks for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('grades')));
create policy "nexus update" on grades_weeks for update
  using (user_id = auth.uid() or public.nexus_can_edit('grades'));
create policy "nexus delete" on grades_weeks for delete
  using (user_id = auth.uid());

-- ------------------------------------------------------------
-- Comprobación: tiene que devolver 4 filas.
-- ------------------------------------------------------------
-- select policyname from pg_policies
-- where schemaname = 'public' and tablename = 'grades_weeks';
