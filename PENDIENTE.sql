


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
