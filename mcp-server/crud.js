// Herramientas genéricas para manejar NEXUS desde Claude (y desde DESJ): ver, crear, editar y borrar
// filas de las tablas de los módulos. Usan la misma sesión que el resto del servidor (anon key + login
// de Andrés), así que RLS sigue aplicando: solo se tocan sus propias filas.
//
// Seguridad:
// - Solo las tablas de TABLES. Quedan fuera las de permisos/admin, el chat, las contraseñas y lo privado.
// - Las contraseñas, tokens y secretos nunca salen en las respuestas: se reemplazan por "[oculto]".
//   Una escritura que traiga "[oculto]" se rechaza, para no pisar una contraseña real con el marcador.
// - Editar y borrar es por id (nada de cambios masivos con filtros) y borrar exige confirm: true.
import * as z from "zod";

const HIDDEN = "[oculto]";
const SECRET_KEY = /pass(word)?|secret|token|api_?key/i;
const MAX_LIST = 100;
const MAX_CREATE = 50;
const MAX_DELETE = 20;

// Tabla → módulo, para qué sirve y sus columnas (sin id, user_id ni created_at, que pone la base).
// Las columnas salen de los tipos de src/features/*/types.ts; las marcadas "(ver fila)" se descubren
// con nexus_list porque no tienen un tipo *Row en el frontend.
export const TABLES = {
  // Proyectos de la agencia
  personal_projects: { module: "projects", about: "Proyectos (nombre, cliente, stack, hitos). resources trae links/notas; sus contraseñas salen ocultas.", columns: "name, client, description, tech_stack (array), resources (array), milestones (array de {id,title,done}), sort_order" },
  project_board_columns: { module: "projects", about: "Columnas del tablero Kanban de un proyecto (p. ej. Por hacer / En progreso / Hecho).", columns: "project_id, name, color, sort_order" },
  project_board_tasks: { module: "projects", about: "Tareas del tablero de un proyecto. column_id dice en qué columna está; moverla = cambiar column_id.", columns: "project_id, column_id, title, tag, assignee, due (YYYY-MM-DD o null), sort_order" },
  project_entries: { module: "projects", about: "Páginas/notas dentro de un proyecto (contenido en HTML).", columns: "project_id, title, content (HTML), code, table_data" },
  project_design_entries: { module: "projects", about: "Galerías de diseño de un proyecto.", columns: "project_id, title, images (array)" },
  project_dossier_sections: { module: "projects", about: "Expediente del proyecto: bloques de contenido o de pagos (visible_to_client decide si el cliente lo ve).", columns: "project_id, title, kind (content|payments), body (HTML), files (array), total_amount, total_currency, visible_to_client, sort_order" },
  project_dossier_payments: { module: "projects", about: "Pagos dentro de un bloque de pagos del expediente.", columns: "section_id, concept, amount, currency, date (YYYY-MM-DD), note, files (array)" },
  project_messages: { module: "projects", about: "Mensajes del proyecto con el cliente (los ve el cliente).", columns: "project_id, author_name, body, task_id" },
  // Contenido
  content_categories: { module: "content", about: "Categorías de ideas de contenido.", columns: "name, color, sort_order, collapsed" },
  content_ideas: { module: "content", about: "Ideas/piezas de contenido. scheduled_date las pone en un día del planner.", columns: "title, description, script, hook, format, style (animado|humano|noticia|foto), category_id, sort_order, scheduled_date (YYYY-MM-DD o null), schedule_order, script_done, recorded, edited, do_not_publish" },
  content_weeks: { module: "content", about: "Plan de cada semana del planner.", columns: "week_key (p. ej. 2026-W46), title, goal, notes, status" },
  pipeline_stages: { module: "pipeline", about: "Etapas del pipeline de clientes con su regla (máximo de días sin movimiento) y plantilla de seguimiento ({nombre}).", columns: "name, max_days, rule, message_template, color, sort_order" },
  pipeline_deals: { module: "pipeline", about: "Oportunidades / clientes en seguimiento. Mejor usar pipeline_update, que deja historial.", columns: "name, company, contact, channel, stage_id, note, value, currency, status (open|won|lost), last_activity_at, suggested_message, source (tiktok|instagram|referido|web|otro), source_idea_id, sort_order" },
  pipeline_activity: { module: "pipeline", about: "Historial de cada oportunidad (actor andres|agent).", columns: "deal_id, kind, body, actor" },
  content_publications: { module: "content", about: "Dónde y cuándo se publicó cada pieza (las métricas van en content_post_metrics).", columns: "idea_id, platform (instagram|tiktok|linkedin|youtube|otro), published_at, url" },
  content_account_daily: { module: "content", about: "Métricas de la cuenta por día y plataforma (null = sin datos). Mejor usar log_account_metrics.", columns: "platform (tiktok|instagram), day, views, unique_viewers, new_viewers, profile_views, followers_gained, followers_total, likes, comments, shares, saves, source" },
  content_post_metrics: { module: "content", about: "Fotos fechadas de las métricas de cada publicación. Mejor usar log_post_metrics.", columns: "publication_id, captured_on, views, likes, comments, shares, saves, avg_watch_seconds, full_watch_pct, profile_views, follows, source" },
  content_active_times: { module: "content", about: "Horarios activos de la audiencia (0=lunes, hora de Caracas). Mejor usar log_active_times.", columns: "platform, weekday, hour, value, captured_on, source" },
  // Finanzas
  finance_transactions: { module: "finance", about: "Movimientos de dinero (preferí add_transaction para registrar, calcula la tasa).", columns: "(ver fila)" },
  finance_categories: { module: "finance", about: "Categorías de ingresos y gastos.", columns: "(ver fila)" },
  finance_bills: { module: "finance", about: "Deudas y cuentas por pagar.", columns: "name, description, amount, interest_rate, due_date (YYYY-MM-DD), paid" },
  finance_monthly_budget: { module: "finance", about: "Presupuesto mensual.", columns: "(ver fila)" },
  // Universidad
  grades_subjects: { module: "grades", about: "Materias.", columns: "name, color, sort_order, eval_plan_text, eval_plan_images (array)" },
  grades_evaluations: { module: "grades", about: "Evaluaciones de una materia (nota sobre 20, peso en %).", columns: "subject_id, name, weight, grade (o null), eval_date (YYYY-MM-DD), sort_order" },
  grades_weeks: { module: "grades", about: "Semanas de una materia con temas y notas.", columns: "subject_id, week_number, start_date, end_date, topics (array), notes (HTML), code, resources (array)" },
  grades_schedule_people: { module: "grades", about: "Personas del horario.", columns: "name, color, sort_order" },
  grades_schedule_blocks: { module: "grades", about: "Bloques del horario semanal.", columns: "person_id, day, start_time (HH:MM), end_time (HH:MM), subject, color" },
  grades_payment_plans: { module: "grades", about: "Planes de pago de la universidad.", columns: "name, cuota_inicial, mes_2, mes_3, mes_4, mes_5, ci, subjects (array), sort_order" },
  // Salud
  medical_history: { module: "medical", about: "Historial médico (consultas, estudios).", columns: "entry_date (YYYY-MM-DD), entry_type, place, professional, notes" },
  medical_contacts: { module: "medical", about: "Contactos médicos.", columns: "name, description, phones (array), location" },
  medical_exams: { module: "medical", about: "Exámenes (el archivo se sube desde la app).", columns: "description, exam_date, file_name, file_path, sort_order" },
  // Moto
  motorcycle_info: { module: "motorcycle", about: "Datos de la moto.", columns: "(ver fila)" },
  oil_changes: { module: "motorcycle", about: "Cambios de aceite.", columns: "(ver fila)" },
  motorcycle_to_buy: { module: "motorcycle", about: "Cosas por comprar para la moto.", columns: "(ver fila)" },
  // Conocimiento y notas
  knowledge_folders: { module: "knowledge", about: "Carpetas de documentos de contexto (section 'brain' = BRAIN, o el id de un módulo, ej. 'content').", columns: "name, color, sort_order, section" },
  knowledge_docs: { module: "knowledge", about: "Documentos de contexto en markdown.", columns: "folder_id, title, content, sort_order, section" },
  section_notes: { module: "dashboard", about: "Nota libre de cada sección (botón CONTEXT). Una fila por section.", columns: "section, content (ver fila)" },
  // Dashboard
  dashboard_shortcuts: { module: "dashboard", about: "Accesos directos del Dashboard.", columns: "name, url, icon_url, sort_order" },
  pill_tracker_items: { module: "dashboard", about: "Pastillas del tracker del Dashboard.", columns: "name, sort_order" },
  pill_tracker_logs: { module: "dashboard", about: "Tomas registradas del tracker (una por pastilla y día).", columns: "item_id, log_date (YYYY-MM-DD)" },
};

const tableEnum = z.enum(Object.keys(TABLES));
const PROTECTED = new Set(["id", "user_id", "created_at", "updated_at"]);

/** Reemplaza contraseñas, tokens y secretos por "[oculto]" en cualquier nivel. */
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SECRET_KEY.test(k) && v !== "" && v !== null ? HIDDEN : redact(v)])
    );
  }
  return value;
}

function hasHidden(value) {
  if (value === HIDDEN) return true;
  if (Array.isArray(value)) return value.some(hasHidden);
  if (value && typeof value === "object") return Object.values(value).some(hasHidden);
  return false;
}

/** Quita las columnas que pone la base y rechaza el marcador de contraseña oculta. */
function cleanRow(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Cada fila debe ser un objeto {columna: valor}.");
  if (hasHidden(row)) {
    throw new Error(`Los datos traen "${HIDDEN}": es el marcador de una contraseña que no se muestra. Quita ese campo para no borrar la contraseña real.`);
  }
  return Object.fromEntries(Object.entries(row).filter(([k]) => !PROTECTED.has(k)));
}

export function registerCrudTools(server, { getSession, tool, ok }) {
  server.registerTool(
    "nexus_tables",
    {
      description:
        "Lista las tablas de NEXUS que puedes ver y cambiar con nexus_list / nexus_create / nexus_update / nexus_delete, " +
        "con el módulo, para qué sirve cada una y sus columnas. Úsala primero si no sabes dónde vive algo.",
      inputSchema: z.object({}),
    },
    tool(async () => ok(Object.entries(TABLES).map(([table, t]) => ({ table, ...t }))))
  );

  server.registerTool(
    "nexus_list",
    {
      description:
        "Lee filas de una tabla de NEXUS. Filtra por columnas exactas (where) y/o busca texto en una columna (search). " +
        "Devuelve los ids que necesitas para editar o borrar. Las contraseñas salen como [oculto].",
      inputSchema: z.object({
        table: tableEnum,
        where: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
          .optional()
          .describe('Igualdades, p. ej. {"project_id": "…", "column_id": "…"}'),
        search: z
          .object({ column: z.string(), text: z.string() })
          .optional()
          .describe('Texto que contiene una columna (sin distinguir mayúsculas), p. ej. {"column": "name", "text": "lorenzo"}'),
        columns: z.string().optional().describe("Columnas separadas por coma; por defecto todas"),
        order: z.string().optional().describe("Columna para ordenar; por defecto created_at"),
        ascending: z.boolean().optional(),
        limit: z.number().int().min(1).max(MAX_LIST).optional().describe(`Máximo ${MAX_LIST}; por defecto 30`),
      }),
    },
    tool(async ({ table, where, search, columns, order, ascending, limit }) => {
      const { supabase } = await getSession();
      const run = (sortBy) => {
        let q = supabase.from(table).select(columns || "*");
        for (const [col, val] of Object.entries(where ?? {})) q = val === null ? q.is(col, null) : q.eq(col, val);
        if (search) q = q.ilike(search.column, `%${search.text.replace(/[%_]/g, "")}%`);
        if (sortBy) q = q.order(sortBy, { ascending: ascending ?? false });
        return q.limit(limit ?? 30);
      };
      let { data, error } = await run(order || "created_at");
      // Alguna tabla no tiene created_at: sin orden pedido, se lee sin ordenar.
      if (error && !order && /created_at/.test(error.message)) ({ data, error } = await run(null));
      if (error) throw new Error(error.message);
      return ok({ table, count: data.length, rows: redact(data) });
    })
  );

  server.registerTool(
    "nexus_create",
    {
      description:
        `Crea filas en una tabla de NEXUS (hasta ${MAX_CREATE}). No mandes id, user_id ni created_at: los pone la base. ` +
        "Para tareas del tablero, busca antes el project_id y el column_id con nexus_list.",
      inputSchema: z.object({
        table: tableEnum,
        rows: z.array(z.record(z.string(), z.unknown())).min(1).max(MAX_CREATE),
      }),
    },
    tool(async ({ table, rows }) => {
      const { supabase, userId } = await getSession();
      const clean = rows.map((r) => ({ ...cleanRow(r), user_id: userId }));
      const { data, error } = await supabase.from(table).insert(clean).select();
      if (error) throw new Error(error.message);
      return ok({ table, created: data.length, rows: redact(data) });
    })
  );

  server.registerTool(
    "nexus_update",
    {
      description:
        "Cambia columnas de UNA fila de NEXUS por su id (búscalo antes con nexus_list). Solo manda las columnas que cambian. " +
        "Para mover una tarea del tablero, cambia su column_id.",
      inputSchema: z.object({
        table: tableEnum,
        id: z.string().describe("id de la fila"),
        changes: z.record(z.string(), z.unknown()).describe('Columnas nuevas, p. ej. {"title": "…", "due": "2026-11-18"}'),
      }),
    },
    tool(async ({ table, id, changes }) => {
      const { supabase } = await getSession();
      const clean = cleanRow(changes);
      if (!Object.keys(clean).length) throw new Error("No hay columnas para cambiar.");
      const { data, error } = await supabase.from(table).update(clean).eq("id", id).select();
      if (error) throw new Error(error.message);
      if (!data.length) throw new Error("No encontré esa fila (o no tienes permiso para editarla).");
      return ok({ table, updated: redact(data[0]) });
    })
  );

  server.registerTool(
    "nexus_delete",
    {
      description:
        `Borra filas de NEXUS por id (hasta ${MAX_DELETE}). Es definitivo. Antes de usarla, di exactamente qué vas a borrar ` +
        "y espera a que la persona lo confirme; solo entonces llámala con confirm: true.",
      inputSchema: z.object({
        table: tableEnum,
        ids: z.array(z.string()).min(1).max(MAX_DELETE),
        confirm: z.literal(true).describe("true solo después de que la persona confirmó el borrado"),
      }),
    },
    tool(async ({ table, ids }) => {
      const { supabase } = await getSession();
      const { data, error } = await supabase.from(table).delete().in("id", ids).select();
      if (error) throw new Error(error.message);
      if (!data.length) throw new Error("No borré nada: no encontré esas filas (o no tienes permiso).");
      return ok({ table, deleted: data.length, rows: redact(data) });
    })
  );
}
