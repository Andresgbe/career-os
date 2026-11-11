


-- ============================================
-- BLOQUE 13 — LINKS PRIVADOS DE PROYECTO
-- ============================================
-- La sección "Privada" de la pestaña Links. Igual que las credenciales
-- privadas: tabla propia, cada fila la ve solo quien la creó.
create table if not exists project_private_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references personal_projects(id) on delete cascade,
  label text not null default '',
  url text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists project_private_links_project_idx
  on project_private_links (user_id, project_id, sort_order);

alter table project_private_links enable row level security;

drop policy if exists "nexus read" on project_private_links;
drop policy if exists "nexus insert" on project_private_links;
drop policy if exists "nexus update" on project_private_links;
drop policy if exists "nexus delete" on project_private_links;
create policy "nexus read" on project_private_links for select using (auth.uid() = user_id);
create policy "nexus insert" on project_private_links for insert with check (auth.uid() = user_id);
create policy "nexus update" on project_private_links for update using (auth.uid() = user_id);
create policy "nexus delete" on project_private_links for delete using (auth.uid() = user_id);


-- ============================================================
-- BLOQUE 14 — EXPEDIENTE DEL PROYECTO (contratos, documentos, notas y pagos)
--
-- Bloques que crea el admin dentro de cada proyecto. Cada uno tiene su propio
-- interruptor visible_to_client. Mientras esté apagado, el cliente no recibe
-- ni la fila de la base de datos.
--
-- Solo el admin escribe, aunque el cliente tenga permiso de editar el
-- proyecto. El cliente únicamente lee lo que se le muestre.
--
-- El bucket es PRIVADO: un contrato no debe quedar accesible con solo tener
-- el link. Los archivos se bajan con una URL firmada que vence enseguida.
--
-- Sin bloques DO: en este editor no se ejecutan.
-- ============================================================

create table if not exists project_dossier_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references personal_projects(id) on delete cascade,
  title text not null default '',
  kind text not null default 'content' check (kind in ('content', 'payments')),
  body text not null default '',
  files jsonb not null default '[]'::jsonb,
  visible_to_client boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists project_dossier_sections_project_idx
  on project_dossier_sections (project_id, sort_order);

create table if not exists project_dossier_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  section_id uuid not null references project_dossier_sections(id) on delete cascade,
  concept text not null default '',
  amount numeric not null default 0,
  currency text not null default 'USD',
  date date,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists project_dossier_payments_section_idx
  on project_dossier_payments (section_id, date);

alter table project_dossier_sections enable row level security;
alter table project_dossier_payments enable row level security;

drop policy if exists "nexus read" on project_dossier_sections;
drop policy if exists "nexus insert" on project_dossier_sections;
drop policy if exists "nexus update" on project_dossier_sections;
drop policy if exists "nexus delete" on project_dossier_sections;
create policy "nexus read" on project_dossier_sections for select
  using (
    public.nexus_is_admin()
    or (visible_to_client and public.nexus_can_view('projects') and public.nexus_can_see_project(project_id))
  );
create policy "nexus insert" on project_dossier_sections for insert
  with check (user_id = auth.uid() and public.nexus_is_admin());
create policy "nexus update" on project_dossier_sections for update
  using (public.nexus_is_admin());
create policy "nexus delete" on project_dossier_sections for delete
  using (public.nexus_is_admin());

drop policy if exists "nexus read" on project_dossier_payments;
drop policy if exists "nexus insert" on project_dossier_payments;
drop policy if exists "nexus update" on project_dossier_payments;
drop policy if exists "nexus delete" on project_dossier_payments;
create policy "nexus read" on project_dossier_payments for select
  using (
    public.nexus_is_admin()
    or exists (
      select 1 from project_dossier_sections s
      where s.id = section_id
        and s.visible_to_client
        and public.nexus_can_view('projects')
        and public.nexus_can_see_project(s.project_id)
    )
  );
create policy "nexus insert" on project_dossier_payments for insert
  with check (user_id = auth.uid() and public.nexus_is_admin());
create policy "nexus update" on project_dossier_payments for update
  using (public.nexus_is_admin());
create policy "nexus delete" on project_dossier_payments for delete
  using (public.nexus_is_admin());

-- Archivos: <project_id>/<section_id>/<archivo>
insert into storage.buckets (id, name, public)
values ('project-dossier', 'project-dossier', false)
on conflict (id) do update set public = false;

drop policy if exists "project-dossier read" on storage.objects;
drop policy if exists "project-dossier insert" on storage.objects;
drop policy if exists "project-dossier update" on storage.objects;
drop policy if exists "project-dossier delete" on storage.objects;
create policy "project-dossier read" on storage.objects for select
  using (
    bucket_id = 'project-dossier'
    and (
      public.nexus_is_admin()
      or exists (
        select 1 from public.project_dossier_sections s
        where s.id::text = (storage.foldername(name))[2]
          and s.visible_to_client
          and public.nexus_can_view('projects')
          and public.nexus_can_see_project(s.project_id)
      )
    )
  );
create policy "project-dossier insert" on storage.objects for insert
  with check (bucket_id = 'project-dossier' and public.nexus_is_admin());
create policy "project-dossier update" on storage.objects for update
  using (bucket_id = 'project-dossier' and public.nexus_is_admin());
create policy "project-dossier delete" on storage.objects for delete
  using (bucket_id = 'project-dossier' and public.nexus_is_admin());


-- ============================================================
-- BLOQUE 15 — INTERRUPTOR GENERAL DEL EXPEDIENTE
--
-- Muestra u oculta la pestaña completa por proyecto. El cliente ve un bloque
-- solo si este interruptor está encendido Y ese bloque también lo está.
-- Sin fila = oculto.
--
-- Va en su propia tabla y no en personal_projects porque un cliente con
-- permiso de editar puede modificar la fila del proyecto. Esta solo la
-- escribe el admin.
-- ============================================================

create table if not exists project_dossier_settings (
  project_id uuid primary key references personal_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  visible boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table project_dossier_settings enable row level security;

drop policy if exists "nexus read" on project_dossier_settings;
drop policy if exists "nexus insert" on project_dossier_settings;
drop policy if exists "nexus update" on project_dossier_settings;
drop policy if exists "nexus delete" on project_dossier_settings;
create policy "nexus read" on project_dossier_settings for select
  using (
    public.nexus_is_admin()
    or (public.nexus_can_view('projects') and public.nexus_can_see_project(project_id))
  );
create policy "nexus insert" on project_dossier_settings for insert
  with check (user_id = auth.uid() and public.nexus_is_admin());
create policy "nexus update" on project_dossier_settings for update
  using (public.nexus_is_admin());
create policy "nexus delete" on project_dossier_settings for delete
  using (public.nexus_is_admin());

drop policy if exists "nexus read" on project_dossier_sections;
create policy "nexus read" on project_dossier_sections for select
  using (
    public.nexus_is_admin()
    or (
      visible_to_client
      and public.nexus_can_view('projects')
      and public.nexus_can_see_project(project_id)
      and exists (
        select 1 from project_dossier_settings c
        where c.project_id = project_dossier_sections.project_id and c.visible
      )
    )
  );

drop policy if exists "nexus read" on project_dossier_payments;
create policy "nexus read" on project_dossier_payments for select
  using (
    public.nexus_is_admin()
    or exists (
      select 1 from project_dossier_sections s
      join project_dossier_settings c on c.project_id = s.project_id
      where s.id = section_id
        and c.visible
        and s.visible_to_client
        and public.nexus_can_view('projects')
        and public.nexus_can_see_project(s.project_id)
    )
  );

drop policy if exists "project-dossier read" on storage.objects;
create policy "project-dossier read" on storage.objects for select
  using (
    bucket_id = 'project-dossier'
    and (
      public.nexus_is_admin()
      or exists (
        select 1 from public.project_dossier_sections s
        join public.project_dossier_settings c on c.project_id = s.project_id
        where s.id::text = (storage.foldername(name))[2]
          and c.visible
          and s.visible_to_client
          and public.nexus_can_view('projects')
          and public.nexus_can_see_project(s.project_id)
      )
    )
  );


-- ============================================================
-- BLOQUE 16 — COMPROBANTES EN LOS PAGOS DEL EXPEDIENTE
--
-- Cada pago puede llevar archivos adjuntos, en el mismo bucket privado y con
-- las mismas reglas de lectura que el resto del bloque.
-- La columna status queda sin usar: la app ya no la lee ni la escribe.
-- ============================================================

alter table project_dossier_payments
  add column if not exists files jsonb not null default '[]'::jsonb;


-- ============================================================
-- BLOQUE 17 — MONTO TOTAL EN LOS BLOQUES DE PAGOS DEL EXPEDIENTE
--
-- El admin pone cuánto vale el proyecto; lo pendiente no se guarda, se
-- calcula restando los pagos registrados en esa misma moneda.
-- ============================================================

alter table project_dossier_sections
  add column if not exists total_amount numeric,
  add column if not exists total_currency text not null default 'USD';


-- ============================================================
-- BLOQUE 18 — CONTENT STUDIO: PLANNER SEMANAL
--
-- Cada idea de contenido puede tener un día de publicación
-- (scheduled_date). La semana ISO a la que pertenece se calcula de esa
-- fecha, así que no hay FK a la semana: mover una pieza de día es cambiar
-- solo la fecha. Sin fecha = queda en el banco de ideas.
--
-- content_weeks guarda el plan de cada semana (tema, brief para la IA,
-- estado borrador / aprobada / completada). Una fila por usuario y semana;
-- se crea la primera vez que tocas algo de esa semana.
-- ============================================================

alter table content_ideas
  add column if not exists hook text not null default '',
  add column if not exists format text not null default '',
  add column if not exists scheduled_date date,
  add column if not exists schedule_order integer not null default 0;

create index if not exists content_ideas_scheduled_idx
  on content_ideas (user_id, scheduled_date);

create table if not exists content_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_key text not null check (week_key ~ '^\d{4}-W\d{2}$'),
  title text not null default '',
  goal text not null default '',
  notes text not null default '',
  status text not null default 'draft' check (status in ('draft', 'approved', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_key)
);

alter table content_weeks enable row level security;

drop policy if exists "nexus read" on content_weeks;
drop policy if exists "nexus insert" on content_weeks;
drop policy if exists "nexus update" on content_weeks;
drop policy if exists "nexus delete" on content_weeks;
create policy "nexus read" on content_weeks for select
  using (user_id = auth.uid() or public.nexus_can_view('content'));
create policy "nexus insert" on content_weeks for insert
  with check (user_id = auth.uid() and (public.nexus_is_admin() or public.nexus_can_edit('content')));
create policy "nexus update" on content_weeks for update
  using (user_id = auth.uid() or public.nexus_can_edit('content'));
create policy "nexus delete" on content_weeks for delete
  using (user_id = auth.uid());


-- ============================================================
-- BLOQUE 19 — CONTEXTO IA POR MÓDULO (pestaña "Contexto IA" de Content)
--
-- Las carpetas y documentos markdown de Knowledge ahora tienen un ámbito:
-- section = '' es la base general (página Knowledge); section = '<módulo>'
-- son las carpetas de contexto de ese módulo (hoy: 'content'). Misma tabla,
-- mismas policies; la IA las lee con get_content_context por MCP.
-- ============================================================

alter table knowledge_folders
  add column if not exists section text not null default '';

alter table knowledge_docs
  add column if not exists section text not null default '';

create index if not exists knowledge_folders_section_idx
  on knowledge_folders (user_id, section);
create index if not exists knowledge_docs_section_idx
  on knowledge_docs (user_id, section);
