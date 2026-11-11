


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



-- ============================================================
-- BLOQUE 20 — CONTEXTO AG EN EL CONTEXTO IA DE CONTENT
--
-- Requiere el BLOQUE 19. Crea la carpeta "Proyecto AG" (la primera de la
-- pestaña Contexto IA de Content) con el documento maestro "CONTEXTO AG".
-- Se puede volver a correr: si el documento ya existe, solo reemplaza su
-- contenido. El dueño es la cuenta admin de app_profiles.
-- ============================================================

insert into knowledge_folders (user_id, name, color, sort_order, section)
select p.user_id, 'Proyecto AG', '#E8703A', -1, 'content'
from app_profiles p
where p.role = 'admin' and p.active
  and not exists (
    select 1 from knowledge_folders f
    where f.user_id = p.user_id and f.section = 'content' and f.name = 'Proyecto AG'
  )
order by p.created_at
limit 1;

with owner as (
  select user_id from app_profiles
  where role = 'admin' and active
  order by created_at
  limit 1
),
folder as (
  select f.id, f.user_id from knowledge_folders f
  join owner o on o.user_id = f.user_id
  where f.section = 'content' and f.name = 'Proyecto AG'
  limit 1
),
body as (
  select $ctx$# CONTEXTO AG — leer antes de hacer cualquier cosa

Contexto completo del proyecto AG de Andrés Gil, para cualquier agente o herramienta que produzca material para él: documentos, posts, videos editados y videos animados. Si una instrucción directa de Andrés contradice este archivo, manda la instrucción de Andrés.

Última actualización: 11 nov 2026.

---

## 1. Quién es y qué es AG

- **Andrés Gil**, desarrollador de software en Caracas (Venezuela). Estudia Ingeniería Informática y trabaja a la vez.
- **AG Software Agency** es su agencia de software y automatización, a su nombre: es su marca personal.
- **Servicios:** automatización de flujos (n8n, Make), integraciones con APIs, sistemas de contenido con IA, plataformas web y sistemas a medida.
- **Clientes típicos:** negocios pequeños y medianos de sectores tradicionales (seguros, alimentos, educación, trading). No suelen ser técnicos.
- **Idioma:** español neutro (Venezuela/LatAm). A Andrés se le responde en español.

### Proyectos activos

| Proyecto | Qué es |
|---|---|
| Contenido propio de AG | Posts de LinkedIn/Instagram y videos para la marca de Andrés. Sistema de publicación automática con n8n + Supabase (`ag-publicacion`). |
| Campaña de LinkedIn (cliente: Gonzalo Trujillo) | Flujo que genera ideas de post, arma la imagen, pide aprobación por Telegram y publica. Migrándose de Make a n8n en Render. Objetivo: reclutar agentes de seguros. Propuesta COT-2026-SP01. |
| Centro de producción de alimentos (cliente) | Sistema de control para una cocina central: inventario por almacén/cava, recepción de mercancía, requisiciones cocina→almacén, calculadora de recetas, producción y despachos por destino. Jerarquía de usuarios: chef ejecutivo, subchef, jefes de cocina. Se empieza por el control global y se agregan funciones poco a poco. |

---

## 2. Marca (obligatoria en TODO lo de AG)

### Paleta oficial

| Rol | Hex | Uso |
|---|---|---|
| Fondo | `#F7F5F1` | Crema. Fondo de páginas, posts y escenas claras |
| Texto / oscuro | `#0F2E36` | Texto principal, títulos, portadas y fondos oscuros |
| Acento primario | `#4C7C82` | Líneas, bordes destacados, viñetas |
| Acento secundario | `#E8703A` | Naranja. Totales, etiquetas, botones, acentos |

Derivados en uso: superficie `#FFFFFF`, borde `#E4E0D8`, texto secundario `#5A6B6E`, primario oscuro `#3D666B`, fila suave `#EEF3F3`, naranja para texto grande sobre claro `#B4541F`. En videos animados se permite el amarillo `#ffd166` como acento.

**No usar otras paletas para AG.**

### Reglas de contraste

- `#E8703A` nunca como texto pequeño sobre fondo claro; solo rellenos, etiquetas y texto muy grande. Sobre fondo oscuro sí funciona como texto.
- Texto sobre relleno naranja en documentos: `#0F2E36`.
- `#4C7C82` sobre crema solo para títulos grandes o gráficos; para texto chico usar `#3D666B`.

### Tipografía

- **Títulos:** Manrope 800.
- **Cuerpo:** Inter 400/600.
- **Datos técnicos:** monoespaciada (JetBrains Mono / IBM Plex Mono).
- Disponibles en Google Fonts o npm (`@fontsource/manrope`, `@fontsource/inter`).

### Marca gráfica

- Aún no hay logo definitivo. Se usa: cuadrado naranja + "AG SOFTWARE AGENCY", o un recuadro crema redondeado con "AG" (la G en naranja).
- Cierre de videos: fondo `#0F2E36`, recuadro "AG", "ANDRÉS GIL", "IA y tecnología, sin complicaciones", botón naranja "SÍGUEME →".

### Tono

- Claro antes que técnico: se explica lo que hace, no cómo se llama.
- Concreto: entregables y precios exactos; nada de "soluciones innovadoras de vanguardia".
- Cercano pero profesional; se tutea.
- Honesto con los límites: lo que no incluye el alcance se dice.

---

## 3. Documentos (propuestas, briefs, reportes)

- Formato A4, fondo crema, plano y limpio (sin degradados ni sombras), entrega en PDF.
- **Propuestas:** máximo 2 páginas, **sin tiempos estimados** (hitos por entregable y criterio de aprobación), **sin líneas de firma** (solo casilla de aceptación con el total). Numeración `COT-AAAA-XXNN`, validez 15 días. La mensualidad puede ir como "A acordar".
- Estructura de propuesta: portada oscura con metadatos (cliente · n.º · fecha · validez) → Lo que ganas (4 beneficios) → Cómo funciona (4–5 pasos en tarjetas) → Alcance (tabla con precios, fila de total en naranja) → Hitos de entrega → Lo que necesitamos de ti | Condiciones (incluye qué NO incluye) → Próximos pasos → Aceptación.
- Otros formatos: brief de proyecto, plan de sprint, reporte de entrega/avance.
- Los PDF se generan desde HTML con Chromium/Playwright (`format: 'A4', printBackground: true`), con las fuentes cargadas localmente.

---

## 4. Posts para redes (LinkedIn e Instagram)

- Formato vertical 1080×1350 (4:5). Limpio y minimalista; se entiende en 2 segundos.
- Paleta AG, tarjetas blancas con borde `#E4E0D8`, firma discreta en una esquina.
- **Formato A — "Necesito vitamina [letra]":** humor tech; 4 cosas con la misma letra que mezclan IA y vida de emprendedor (G → Gemini, GPT, Ganancias, Gym). Título enorme arriba, cuadrícula 2×2 de tarjetas con ícono y etiqueta en negrita. Texto del post corto que remata el chiste y pregunta al lector.
- **Formato B — infografía/carrusel:** portada-gancho, título en dos líneas y dos tonos, diagrama tipo hub, frase-resumen y llamado a comentar una palabra.
- Los estilos van variando; Andrés irá sumando referencias.

---

## 5. Videos con Andrés a cámara (reels verticales 9:16)

### Corte

- Quitar silencios, repeticiones y tomas falsas; elegir la toma más limpia de cada frase.
- **Revisar que ninguna frase quede dos veces** (él reinicia frases: "Número 2… Número 2, me actualizo…").
- **Eliminar murmullos o voz de fondo en los silencios** (revisar tramos de bajo volumen entre frases).
- Estructura: gancho → problema → quién soy → valor (enumerado) → llamada a la acción → cierre AG.

### Texto en pantalla

1. **Un solo texto a la vez.** Nunca dos capas de texto juntas (frase grande + subtítulo). Si aparece un título o tarjeta, el subtítulo se oculta mientras dure.
2. Las animaciones no deben chocar ni encimarse con los textos.
3. Subtítulos abajo (zona del pecho), mayúsculas, 2–3 palabras, palabra activa resaltada, palabras clave en naranja. Corregir siempre la transcripción (nombres, "inteligencia artificial"…).
4. Nada de paneles grandes e invasivos sobre el video (rechazó el panel tipo "ranking").

### Cámara y zooms

- Quiere **más zooms**: lentos, acercamientos progresivos, luego zoom hacia atrás, variando entre escenas.
- **Límite:** evitar acercamientos fuertes en tomas donde los ojos destacan mucho. Zoom centrado por debajo de los ojos, máximo ~20 %, sin filtro de nitidez, piel ligeramente suavizada, sin filtros que oscurezcan. Sin zoom con sacudida hacia la cara.

### Motion graphics

- **Tarjetas a pantalla completa** que reemplazan el video un momento: fondo con textura + texto que entra con transición, y vuelta al video. Usarlas en ideas clave y enumeraciones ("Número 1: …"). Referencia: títulos tipo "DAY 2" de MrBeast, pero pueden ser más simples.
- Transiciones animadas entre escenas (barridos de color AG, destellos).
- Referencia de ritmo, animaciones y sonido: reels de Ibai.

### Sonido

- No le gustan los "whoosh/swish" repetidos cada vez que aparece un texto. Efectos pocos y con intención (entrada de tarjeta, golpe en idea clave).
- Voz limpia y nivelada, alrededor de −14 a −16 LUFS.

---

## 6. Videos animados con personaje (su formato favorito)

Formato que le encantó (video "¿Qué modelo de Claude deberías usar?"). Quiere hacer más videos completos así.

- 1080×1920, 30 fps, 30–40 s.
- **Un mismo personaje** dibujado por código (SVG): cabeza grande, sudadera, brazos y piernas de palo con borde blanco tipo recorte. Mueve la boca con el volumen de la voz, parpadea, se balancea y cambia de pose y accesorios por escena.
- **Una escena por idea**, alternando fondo crema y teal oscuro, con transición de deslizamiento.
- **Cartel colgante** arriba con el título de la escena y **una sola etiqueta de texto a la vez** abajo, que cambia cuando la voz dice cada idea.
- **Objetos que ilustran lo que se dice**, que aparecen en el momento exacto (laptop, libros, balanza, calendario, lupa, batería que se vacía, moneda, rayo).
- Cierre: personaje saludando + recuadro AG + "SÍGUEME →".
- **Voz IA preferida:** "Grady" de Higgsfield (modelo `seed_audio`, voice_id `e2a2d2e6-9ed2-59cd-82af-feaa27f8a678`, tipo preset). Habla rápido: bajar velocidad a 0,93×. Escribir los números en palabras.
- Música de fondo original (sintetizada, sin copyright), volumen bajo y fijo.

### Cómo se produce

1. Guion: transcribir/limpiar y dividir en intro + 3–5 ideas + cierre. Por escena: título, 2–4 etiquetas cortas en mayúsculas (≤ 24 caracteres) y la palabra que dispara cada una.
2. Voz: IA (Grady) o la voz de Andrés.
3. Transcribir la voz con marcas de tiempo por palabra (faster-whisper) y armar una línea de tiempo: inicio de cada escena, segundo de cada etiqueta y volumen por fotograma (para la boca).
4. Animación en una página HTML con una función `render(t)` que dibuja el fotograma del segundo `t`; se captura fotograma a fotograma con Playwright/Chromium y se codifica con ffmpeg.
5. Revisar fotogramas sueltos antes del render completo.
6. Mezclar voz + música con ganancia fija y entregar MP4.

La plantilla del personaje y las escenas está en el Proyecto AG de Claude: `claude/personaje-animado-plantilla.html`; la guía detallada, en `claude/guia-videos-animados-personaje.md`.

---

## 7. Audio: reglas aprendidas

- **Procesado mínimo.** Filtro de graves, compresión suave y, si hace falta, reducción de ruido leve. Nada más.
- **Nunca subir el volumen con un limitador trabajando fuerte:** deja la voz robótica y entrecortada. Usar ganancia fija y dejar el pico por debajo de −1 dB.
- No apilar "reparadores" (saturación, eses, ruido) si el audio no lo necesita.
- **Bajar a casi silencio las pausas entre frases** con rampa suave (ruido de cuarto, respiraciones, cortes de WhatsApp).
- Música a volumen fijo y bajo; si sube y baja con la voz, se oye raro en las pausas.
- Trabajar siempre desde el archivo original a calidad completa, no desde copias reducidas.
- Las notas de voz de WhatsApp vienen muy comprimidas: pedir grabación con la app Notas de voz, a ~15 cm, en cuarto con poco eco.

---

## 8. Herramientas y límites

- **Higgsfield (por MCP):** voz IA, generación de imagen/video con IA, análisis de viralidad, efectos prefabricados y un servidor de trabajo (sandbox) con ffmpeg, Python, Node/Playwright y un editor de gráficos (Higgsedit).
  - Sus efectos prefabricados son fijos: no se puede cambiar tamaño de paneles ni sonidos. La edición a medida se hace con ffmpeg/HTML y Higgsfield se usa como complemento (transiciones, voz).
  - **Cuesta créditos:** voz IA (~0,9 créditos por cada 100 caracteres; un guion de 30–40 s ≈ 5 créditos) y todo lo generado con IA. **No cuesta:** render, animación por código, música sintetizada, uso del sandbox.
  - Plan actual: gratis. Créditos restantes al 11 nov 2026: 0,3.
  - **Antes de gastar créditos: consultar el costo, decirlo y confirmar con Andrés.** Preguntar qué voz quiere antes de generar.
- **Automatización:** n8n (en Render), Make, Supabase, Telegram para aprobaciones.
- Andrés quiere que sus videos pasen por Higgsfield cuando aporte algo; no asumir que "editar" significa solo cortar.

---

## 9. Cómo trabajar con Andrés

- Entregar el resultado, no un informe del proceso. Decir qué se hizo y qué debe revisar.
- Decir con claridad lo que no se pudo verificar (por ejemplo, si no se pudo escuchar el audio).
- No inventar datos en pantalla (niveles, cifras, usuarios, seguidores). Si algo es estimación propia, avisarlo.
- No usar logos ni personajes de marcas ajenas; solo nombres en texto.
- Pide cambios rápidos y seguidos: aplicar la corrección exacta que pide y devolver la versión nueva.
- Cuando marca un fallo con el segundo exacto ("segundo 37"), ir directo a ese punto.

---

## 10. Lista de revisión antes de entregar

**Cualquier pieza**
- [ ] ¿Paleta y tipografía AG?
- [ ] ¿Texto corregido (nombres, términos)?
- [ ] ¿Algo inventado sin avisar?

**Video**
- [ ] ¿Algún momento con dos textos a la vez?
- [ ] ¿Algún gráfico tapa la cara o choca con los subtítulos?
- [ ] ¿Frases repetidas o murmullos en los silencios?
- [ ] ¿Zooms variados sin primeros planos de los ojos?
- [ ] ¿Sonidos escasos? ¿Voz sin limitador, pausas limpias, música fija?
- [ ] ¿Cierre AG?
- [ ] ¿Se revisaron fotogramas de cada escena?

**Si se usa Higgsfield**
- [ ] ¿Se consultó el costo y Andrés lo aprobó?
$ctx$::text as content
),
upd as (
  update knowledge_docs d
  set content = (select content from body),
      folder_id = (select id from folder),
      updated_at = now()
  from owner o
  where d.user_id = o.user_id and d.section = 'content' and d.title = 'CONTEXTO AG'
  returning d.id
)
insert into knowledge_docs (user_id, folder_id, title, content, sort_order, section)
select f.user_id, f.id, 'CONTEXTO AG', (select content from body), 0, 'content'
from folder f
where not exists (select 1 from upd);



-- ============================================================
-- BLOQUE 21 — 30 IDEAS DE VIDEOS + GUÍA DE ESTILO "TONO HUMANO"
--
-- Requiere los BLOQUES 18 y 19. Se puede volver a correr: no duplica
-- (las ideas se reconocen por título, la guía se actualiza).
--   1. Categorías del tablero: "Vende tu servicio", "IA sin humo",
--      "IA explicada fácil" (si no existen).
--   2. 30 ideas de reels en el banco de ideas (sin fecha), con hook,
--      descripción con ejemplo de la vida real y cierre, formato Reel.
--   3. Documento "Estilo de videos cortos" en la carpeta "Marca y voz" del
--      Contexto IA de Content (crea la carpeta si no existe).
-- ============================================================

-- 1. Categorías
with owner as (
  select user_id from app_profiles
  where role = 'admin' and active
  order by created_at
  limit 1
),
cats(name, color, n) as (values
    ('Vende tu servicio', '#E8703A', 0),
    ('IA sin humo', '#4C7C82', 1),
    ('IA explicada fácil', '#8b5cf6', 2)
),
base as (
  select coalesce(max(c.sort_order), -1) + 1 as start
  from content_categories c join owner o on o.user_id = c.user_id
)
insert into content_categories (user_id, name, color, sort_order)
select o.user_id, cats.name, cats.color, base.start + cats.n
from cats cross join owner o cross join base
where not exists (
  select 1 from content_categories c
  where c.user_id = o.user_id and lower(c.name) = lower(cats.name)
);

-- 2. Ideas
with owner as (
  select user_id from app_profiles
  where role = 'admin' and active
  order by created_at
  limit 1
),
ideas(n, category, title, hook, description) as (values
    (0, 'Vende tu servicio', 'La desventaja de ser vibecoder', 'Hacer una app con IA en un fin de semana es fácil. Que no se caiga es otra historia.', 'Ejemplo: construir sin saber es como levantar un edificio sin planos. Se ve bien en la foto, pero cuando le pones el segundo piso (más usuarios, más datos) se viene abajo. Con 10 usuarios funciona; con 1.000 se cae. Cierre: si tu negocio depende de ese sistema, mejor alguien que sepa poner las bases.'),
    (1, 'Vende tu servicio', 'Tu app hecha con IA tiene la puerta abierta', 'Tu app funciona perfecto… y cualquiera puede entrar.', 'Ejemplo: una casa preciosa con la llave debajo del tapete. Muchas apps hechas con IA dejan las claves a la vista o la base de datos sin candado. No se nota hasta que alguien entra. Cierre: antes de lanzar, que alguien revise las cerraduras.'),
    (2, 'Vende tu servicio', 'Lo barato sale caro (también en software)', 'Te ahorraste 300 dólares y ahora te toca pagar 3.000.', 'Ejemplo: el plomero que arregla el tubo con teipe. Aguanta hoy, explota mañana y el arreglo sale el triple. Rehacer un sistema mal hecho cuesta más que hacerlo bien desde el principio. Cierre: barato no es lo mismo que económico.'),
    (3, 'Vende tu servicio', 'Si tu negocio vive en un Excel, tienes un problema', '¿Todo tu negocio está en una hoja de Excel? Te cuento por qué eso da miedo.', 'Ejemplo: guardar todos tus ahorros debajo del colchón. Funciona… hasta que alguien borra una fila sin querer, el archivo se daña o dos personas lo editan a la vez. Cierre: un sistema con base de datos es la cuenta del banco de tu información.'),
    (4, 'Vende tu servicio', 'Cuánto tiempo pierdes copiando y pegando', 'Si haces lo mismo todos los días a la misma hora, eso lo puede hacer un robot.', 'Ejemplo: lavar la ropa a mano teniendo una lavadora en la casa. Cuenta: una hora al día pasando datos de un lado a otro son 22 horas al mes, casi tres días de trabajo. Cierre: eso se automatiza y tú haces lo que de verdad importa.'),
    (5, 'Vende tu servicio', 'Automatizar no es despedir gente', '¿Automatizar es botar empleados? No. Y te explico por qué.', 'Ejemplo: la calculadora no despidió a los contadores, les quitó la parte aburrida. Automatizar le quita a tu equipo lo repetitivo para que se dedique a atender clientes y vender. Cierre: tu gente vale más que copiar y pegar.'),
    (6, 'Vende tu servicio', 'Por qué tu chatbot responde como un robot', '¿Pusiste un chatbot en tu negocio y responde puras tonterías?', 'Ejemplo: contratar a un vendedor y no decirle qué vendes, a qué precio ni cómo hablarle a tus clientes. La IA es igual: sin la información de tu negocio, inventa. Cierre: un buen chatbot se arma con tus datos, tu tono y tus reglas.'),
    (7, 'Vende tu servicio', 'Qué pasa si el que te hizo el sistema desaparece', 'El programador que te hizo el sistema ya no contesta. ¿Y ahora?', 'Ejemplo: un carro con piezas que nadie más vende. Si nadie entiende cómo está hecho tu sistema, cualquier cambio es un dolor de cabeza. Cierre: pide siempre el sistema documentado y ordenado (así trabajo yo).'),
    (8, 'Vende tu servicio', 'No necesitas una app, necesitas que algo funcione', 'Te voy a ahorrar dinero: probablemente no necesitas una app.', 'Ejemplo: comprar un camión para ir a la panadería. Muchas veces basta con automatizar tu WhatsApp y conectar una hoja de cálculo. Cierre honesto: primero se entiende el problema, después se decide qué construir.'),
    (9, 'Vende tu servicio', '3 señales de que tu negocio necesita automatizar', 'Si te pasa alguna de estas tres cosas, tu negocio necesita automatizar.', '1) Respondes la misma pregunta 20 veces al día. 2) Se te pierden pedidos entre chats. 3) No sabes cuánto vendiste ayer sin ponerte a sumar. Ejemplo: un restaurante que toma pedidos por WhatsApp a mano. Cierre: comenta cuál te pasa.'),
    (10, 'Vende tu servicio', 'Por qué tu página web no te trae clientes', 'Tienes página web y nadie te escribe. Te digo por qué.', 'Ejemplo: un local bonito en una calle sin salida. Si tu web tarda en cargar, no aparece en Google o no tiene un botón claro de WhatsApp, nadie llega a la puerta. Cierre: una web es un vendedor, no un adorno.'),
    (11, 'Vende tu servicio', 'Cuando tus programas no se hablan entre sí', '¿Pasas datos a mano de un programa a otro? Eso tiene solución.', 'Ejemplo: dos empleados que no se hablan y tú haciendo de mensajero todo el día. Una integración hace que tu tienda, tu facturación y tu inventario se pasen la información solos. Cierre: deja de ser el mensajero.'),
    (12, 'IA sin humo', '¿La IA es una burbuja?', '¿La inteligencia artificial es una burbuja que va a explotar? Mi respuesta honesta.', 'Ejemplo: la burbuja del internet en el año 2000. Muchísimas empresas quebraron, pero internet se quedó y cambió todo. Con la IA puede pasar igual: el humo se va, las herramientas útiles se quedan. Cierre: aprende a usar lo que sí sirve.'),
    (13, 'IA sin humo', 'La IA nos está volviendo más brutos', 'La IA nos está volviendo más brutos. Y no es exageración.', 'Ejemplo: el GPS. Antes te sabías las calles; hoy sin Waze no llegas ni a la esquina. El cerebro es un músculo: lo que no usas, se debilita. Cierre con la solución: piensa primero tu respuesta y después compárala con la IA.'),
    (14, 'IA sin humo', '¿La IA te va a quitar el trabajo?', 'No te va a reemplazar la IA. Te va a reemplazar alguien que sepa usarla.', 'Ejemplo: cuando llegó Excel, no despidieron a los que hacían cuentas; ganaron los que aprendieron Excel. Con la IA pasa lo mismo. Cierre: la pregunta no es si llega, es si vas a saber usarla.'),
    (15, 'IA sin humo', 'La IA se equivoca, y con mucha seguridad', 'La IA te puede mentir en la cara, y con una seguridad impresionante.', 'Ejemplo: ese amigo que no sabe la respuesta pero te contesta como si fuera experto. A eso se le llama alucinación. Cierre: úsala, pero revisa los datos importantes (precios, leyes, salud).'),
    (16, 'IA sin humo', 'No le pegues todo a ChatGPT', 'Para de pegarle a ChatGPT los datos de tus clientes.', 'Ejemplo: contarle tus secretos a un desconocido en el metro. Contraseñas, datos de clientes o contratos no deberían ir a cualquier herramienta. Cierre: hay formas de usar IA cuidando tu información; pregunta antes de pegar.'),
    (17, 'IA sin humo', 'El negocio de los gurús de la IA', 'Si alguien te promete 10.000 dólares al mes con IA sin hacer nada, el negocio es venderte el curso.', 'Ejemplo: en la fiebre del oro, los que más ganaron fueron los que vendían palas. Desconfía de lo fácil y rápido. Cierre: la IA ahorra tiempo, pero no hace el trabajo por ti.'),
    (18, 'IA sin humo', '¿Está bien usar IA para estudiar?', 'Estudio ingeniería y uso IA todos los días. Así la uso sin hacer trampa.', 'Ejemplo: usar calculadora sin saber sumar vs. usarla cuando ya sabes. Úsala como un profesor que te explica, no como el compañero que te hace la tarea. Cierre: pídele que te explique, no que te resuelva.'),
    (19, 'IA sin humo', 'La IA no tiene ideas, tiene promedios', '¿Por qué todo el contenido hecho con IA se ve igual?', 'Ejemplo: si mezclas las recetas de todas las abuelas del mundo, te sale una sopa sin sabor. La IA responde con el promedio de lo que ya existe. Cierre: tu experiencia y tu forma de hablar es lo que la IA no puede copiar.'),
    (20, 'IA sin humo', 'La IA es un pasante muy rápido', 'Trabajo con IA todo el día. Esto es lo que nadie te cuenta.', 'Ejemplo: tener un pasante rapidísimo que nunca se cansa, pero que hay que revisarle todo. Te ahorra horas, pero si no lo supervisas, la embarra. Cierre: la IA no te quita el trabajo de pensar; te cambia el trabajo.'),
    (21, 'IA explicada fácil', '¿Qué es un agente de IA?', 'Todo el mundo habla de agentes de IA. Te lo explico en 30 segundos.', 'Ejemplo: ChatGPT es un consultor que te dice qué hacer. Un agente es un asistente que lo hace por ti: busca la información, manda el correo, agenda la cita. Cierre: lo usan negocios para atender clientes sin estar pegados al teléfono.'),
    (22, 'IA explicada fácil', '¿Qué es una API?', '¿Qué es una API? Te lo explico con un restaurante.', 'Ejemplo: tú no entras a la cocina. Le pides al mesonero, él va a la cocina y te trae el plato. La API es ese mesonero entre dos programas. Cierre: así tu tienda online habla con el banco o con tu sistema de facturas.'),
    (23, 'IA explicada fácil', '¿Qué es automatizar con n8n?', 'Así funciona una automatización, explicado con fichas de dominó.', 'Ejemplo: empujas la primera ficha y caen todas solas. Llega un pedido → se guarda → te avisa por Telegram → le responde al cliente. Eso es un flujo en n8n. Cierre: tú solo empujas la primera ficha (o ni eso).'),
    (24, 'IA explicada fácil', '¿Qué es un token y por qué la IA te cobra por eso?', '¿Por qué la IA cobra por ''tokens''? Te lo explico con un taxi.', 'Ejemplo: el taxímetro cobra por kilómetro; la IA cobra por pedacitos de palabra. Mientras más largo lo que le mandas y lo que responde, más paga. Cierre: por eso cada modelo tiene su precio (link al video de qué modelo de Claude usar).'),
    (25, 'IA explicada fácil', '¿Qué es una base de datos?', '¿Qué es una base de datos? Más simple de lo que crees.', 'Ejemplo: un archivador con carpetas etiquetadas vs. una caja donde tiras todos los papeles. Las dos guardan cosas, pero en una encuentras el papel en un segundo. Cierre: tu negocio necesita el archivador, no la caja.'),
    (26, 'IA explicada fácil', '¿Por qué la IA olvida lo que le dijiste?', '¿Por qué la IA se olvida de lo que le dijiste hace rato?', 'Ejemplo: la IA escribe en una pizarra; cuando se llena, borra lo primero para seguir escribiendo. A eso se le llama ventana de contexto. Cierre: por eso conviene darle un documento con tu contexto en vez de repetirle todo (así trabajo yo).'),
    (27, 'IA explicada fácil', '¿Qué IA usar para cada cosa?', 'ChatGPT, Claude o Gemini: ¿cuál usar para qué?', 'Ejemplo: una caja de herramientas; no usas el martillo para todo. Una para escribir, otra para programar, otra para buscar. Mismo formato que el video de los modelos de Claude. Antes de grabar: verificar los datos actuales de cada herramienta, no inventar.'),
    (28, 'IA explicada fácil', '¿Qué es la nube?', 'Tus fotos no están en el cielo. Te explico qué es la nube.', 'Ejemplo: guardar en la nube es guardar en la computadora de otra persona (Google, Amazon, Microsoft) que está prendida todo el día. Por eso la ves desde cualquier lado. Cierre: y por eso importa a quién le confías tus datos.'),
    (29, 'IA explicada fácil', 'Cómo pedirle algo a la IA para que te entienda', 'Si la IA te responde mal, el problema puede ser cómo le preguntas.', 'Ejemplo: al taxista no le dices ''llévame a un sitio bonito'', le das la dirección. A la IA dile qué quieres, para quién, con qué tono y dale un ejemplo. Cierre: comenta PROMPT y te paso mi plantilla.')
),
resolved as (
  select i.*, o.user_id, c.id as category_id
  from ideas i
  cross join owner o
  left join lateral (
    select id from content_categories c
    where c.user_id = o.user_id and lower(c.name) = lower(i.category)
    order by c.sort_order
    limit 1
  ) c on true
  where not exists (
    select 1 from content_ideas e
    where e.user_id = o.user_id and lower(e.title) = lower(i.title)
  )
)
insert into content_ideas (user_id, title, hook, description, script, format, category_id, sort_order)
select r.user_id, r.title, r.hook, r.description, '', 'reel', r.category_id,
  (select count(*) from content_ideas e where e.user_id = r.user_id and e.category_id = r.category_id) + r.n
from resolved r;

-- 3. Guía de estilo en el Contexto IA
insert into knowledge_folders (user_id, name, color, sort_order, section)
select p.user_id, 'Marca y voz', '#8b5cf6', 0, 'content'
from app_profiles p
where p.role = 'admin' and p.active
  and not exists (
    select 1 from knowledge_folders f
    where f.user_id = p.user_id and f.section = 'content' and f.name = 'Marca y voz'
  )
order by p.created_at
limit 1;

with owner as (
  select user_id from app_profiles
  where role = 'admin' and active
  order by created_at
  limit 1
),
folder as (
  select f.id, f.user_id from knowledge_folders f
  join owner o on o.user_id = f.user_id
  where f.section = 'content' and f.name = 'Marca y voz'
  limit 1
),
body as (
  select $sty$# Estilo de videos cortos — tono humano

Cómo tienen que sonar los videos de AG. Referencia: el video "¿Qué modelo de Claude deberías usar?" (35 s, personaje animado). Le gustó porque **suena a una persona explicándole algo a un amigo, no a un robot leyendo un guion.**

## La regla de oro

Cualquier persona que no sepa nada de IA tiene que entenderlo a la primera. Si una abuela o el dueño de una panadería no lo entiende, se reescribe.

## Estructura (30–40 s, ~80–100 palabras)

1. **Gancho en forma de pregunta o frase que pica** (≤ 3 s). Ej.: "¿Qué modelo de Claude deberías usar según lo que vayas a hacer?"
2. **Una idea por escena**, una o dos frases cada una. Nada de párrafos.
3. **Cada idea con su "pero"**: ventaja + "eso sí, …" con la desventaja. Eso lo hace creíble.
4. **Un ejemplo de la vida real** para todo lo técnico (ver tabla abajo).
5. **Cierre**: remate corto + por qué te conviene alguien que sabe (cuando el video vende) + recuadro AG "SÍGUEME →".

## Cómo suena (sí)

- Frases cortas, como se habla: "es tu mejor amigo para…", "no hace falta mucha descripción", "eso sí, no es el más…", "el que menos gasta".
- Tuteo, cercano, con un toque de humor.
- Opiniones claras: "para esto, usa esto". Nada de "depende" sin explicar de qué depende.
- Números y comparaciones concretas: "una hora al día son 22 horas al mes".
- Honesto: si algo tiene un límite, se dice.

## Cómo NO suena

- Nada de "en el mundo actual", "descubre cómo", "revoluciona tu negocio", "soluciones innovadoras", "potencia tu…".
- Nada de jerga sin traducir: si aparece "API", "token", "escalable", "agente", va con su ejemplo de la vida real en la misma frase.
- Nada de listas leídas de corrido ni de sonar a anuncio.
- No inventar cifras (seguidores, estudios, porcentajes). Si es una estimación, se dice que lo es.

## Traductor técnico → vida real

| Concepto | Cómo explicarlo |
|---|---|
| Sistema escalable | Un edificio con buenas bases: le puedes poner más pisos sin que se caiga. |
| Vibecoding sin saber | Construir una casa sin planos: se ve bien hasta que le pones el segundo piso. |
| API | El mesonero: tú no entras a la cocina, le pides a él y te trae el plato. |
| Integración | Dos empleados que por fin se hablan, en vez de que tú hagas de mensajero. |
| Automatización (n8n) | Fichas de dominó: llega un pedido y todo lo demás cae solo. |
| Agente de IA | ChatGPT es un consultor que te dice qué hacer; un agente es un asistente que lo hace. |
| Base de datos | Un archivador con carpetas etiquetadas, no una caja donde tiras todo. |
| Token | El taxímetro: la IA te cobra por pedacitos de palabra, como el taxi por kilómetro. |
| Ventana de contexto | Una pizarra: cuando se llena, borra lo primero que escribiste. |
| Alucinación | Ese amigo que no sabe la respuesta pero te contesta con total seguridad. |
| Seguridad | Una casa bonita con la llave debajo del tapete. |
| La nube | Tus fotos no están en el cielo: están en la computadora de otra persona. |
| Prompt | Al taxista no le dices "llévame a un sitio bonito", le das la dirección. |
| Deuda técnica | Arreglar el tubo con teipe: aguanta hoy, explota mañana. |

## Vender sin sonar a vendedor

- El video enseña algo útil primero; la venta es la conclusión lógica, no un anuncio.
- Fórmula de cierre: **problema → ejemplo de la vida real → "por eso, si tu negocio depende de esto, mejor alguien que sepa"**.
- Una sola llamada a la acción por video (seguir, comentar una palabra o escribir por DM).

## Ejemplo de referencia (transcripción del video que le gustó)

> ¿Qué modelo de Claude deberías usar según lo que vayas a hacer?
> Opus 5.5 es tu mejor amigo para código complejo y tareas de conocimiento profundo.
> Sonnet 5.5, para trabajo simple pero bastante preciso: balancea capacidad y velocidad en todas tus tareas diarias. Gasta menos recursos que Opus, pero es menos preciso.
> Fable 5.2: no hace falta mucha descripción, es uno de los más potentes del mercado. Se destaca por su gran capacidad de análisis a profundidad; es el que más recursos gasta.
> Haiku 5.5, el más rápido y barato para construir. Eso sí, no es el más preciso para tareas complejas; es el que menos tokens gasta.

Fíjate: pregunta de gancho, una idea por modelo, cada una con su ventaja y su "pero", palabras simples.
$sty$::text as content
),
upd as (
  update knowledge_docs d
  set content = (select content from body), updated_at = now()
  from owner o
  where d.user_id = o.user_id and d.section = 'content' and d.title = 'Estilo de videos cortos'
  returning d.id
)
insert into knowledge_docs (user_id, folder_id, title, content, sort_order, section)
select f.user_id, f.id, 'Estilo de videos cortos', (select content from body), 1, 'content'
from folder f
where not exists (select 1 from upd);
