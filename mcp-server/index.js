#!/usr/bin/env node
// NEXUS MCP server — exposes the career-os Supabase data to Claude so it can
// read context (tasks, schedule, ideas, shopping list, subjects, projects,
// per-section notes) and act on it (create tasks, ideas, items, save notes).
//
// Runs locally over stdio. Register it with:
//   claude mcp add --scope user nexus -- node C:/career-os/mcp-server/index.js
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createClient } from "@supabase/supabase-js";
import * as z from "zod";
import dotenv from "dotenv";

// Load .env sitting next to this file — the server's working directory is
// wherever Claude Code launched it from, which is usually not this folder.
dotenv.config({ path: new URL(".env", import.meta.url) });

// ============================================
// SUPABASE
// ============================================

// Signs in as the user with the anon key rather than using a service-role
// key, so RLS still applies and the server can only ever touch his own rows.
let sessionPromise = null;

async function getSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const url = process.env.NEXUS_SUPABASE_URL;
      const anonKey = process.env.NEXUS_SUPABASE_ANON_KEY;
      const email = process.env.NEXUS_EMAIL;
      const password = process.env.NEXUS_PASSWORD;

      const missing = [
        ["NEXUS_SUPABASE_URL", url],
        ["NEXUS_SUPABASE_ANON_KEY", anonKey],
        ["NEXUS_EMAIL", email],
        ["NEXUS_PASSWORD", password],
      ]
        .filter(([, v]) => !v)
        .map(([k]) => k);

      if (missing.length) {
        throw new Error(
          `Faltan variables en mcp-server/.env: ${missing.join(", ")}. ` +
            `Copia .env.example a .env y complétalo.`
        );
      }

      const supabase = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: true },
      });
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        sessionPromise = null; // let the next call retry
        throw new Error(`No se pudo iniciar sesión en Supabase: ${error.message}`);
      }
      return { supabase, userId: data.user.id };
    })();
  }
  return sessionPromise;
}

// ============================================
// HELPERS
// ============================================

function ok(payload) {
  const text =
    typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: "text", text }] };
}

function fail(message) {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

// Wraps a handler so a thrown error comes back as readable text instead of
// killing the stdio connection.
function tool(handler) {
  return async (args, ctx) => {
    try {
      return await handler(args, ctx);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  };
}

// Runs a query and, instead of throwing, returns a note when the table is
// missing — a migration he hasn't run yet shouldn't break the whole overview.
async function soft(label, promise) {
  try {
    const { data, error } = await promise;
    if (error) return { label, error: error.message };
    return { label, data: data ?? [] };
  } catch (err) {
    return { label, error: err instanceof Error ? err.message : String(err) };
  }
}

// The app treats days in Venezuela time; the schedule grid indexes Mon..Fri 0..4.
function caracasToday() {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
  }).format(new Date());
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    weekday: "short",
  }).format(new Date());
  const index = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4 }[weekday];
  return { date: ymd, weekday, dayIndex: index ?? null };
}

const SECTIONS = [
  "dashboard",
  "tasks",
  "motorcycle",
  "medical",
  "content",
  "grades",
  "projects",
  "programming",
  "insurance",
  "finance",
  "passwords",
  "tobuy",
];

// ============================================
// SERVER
// ============================================

const server = new McpServer({ name: "nexus", version: "1.0.0" });

server.registerTool(
  "overview",
  {
    description:
      "Snapshot completo del estado actual de NEXUS: tareas pendientes, " +
      "clases de hoy, lista de compras, ideas de contenido en progreso, " +
      "evaluaciones próximas y proyectos. Úsalo primero para tener contexto " +
      "antes de hacer cualquier tarea.",
    inputSchema: z.object({}),
  },
  tool(async () => {
    const { supabase } = await getSession();
    const today = caracasToday();

    const [tasks, schedule, tobuy, ideas, evals, subjects, projects] =
      await Promise.all([
        soft("tasks", supabase.from("tasks").select("*").order("sort_order")),
        soft(
          "schedule",
          supabase.from("grades_schedule_blocks").select("*").is("person_id", null)
        ),
        soft("tobuy", supabase.from("tobuy_items").select("*").eq("checked", false)),
        soft("content_ideas", supabase.from("content_ideas").select("*")),
        soft(
          "evaluations",
          supabase.from("grades_evaluations").select("*").not("eval_date", "is", null)
        ),
        soft("subjects", supabase.from("grades_subjects").select("id,name")),
        soft("projects", supabase.from("personal_projects").select("*")),
      ]);

    // Index of the knowledge base, so Claude knows what personal context
    // exists and can pull the full text with the `knowledge` tool.
    const kbFolders = await soft(
      "knowledge_folders",
      supabase.from("knowledge_folders").select("id,name").order("sort_order")
    );
    const kbDocs = await soft(
      "knowledge_docs",
      supabase.from("knowledge_docs").select("title,folder_id")
    );

    const notes = [tasks, schedule, tobuy, ideas, evals, subjects, projects]
      .filter((r) => r.error)
      .map((r) => `${r.label}: ${r.error}`);

    const subjectName = new Map((subjects.data ?? []).map((s) => [s.id, s.name]));

    const pendingTasks = (tasks.data ?? [])
      .filter((t) => !t.done)
      .map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        due: t.due,
        overdue: t.due ? t.due < today.date : false,
      }));

    const todaysClasses =
      today.dayIndex === null
        ? []
        : (schedule.data ?? [])
            .filter((b) => b.day === today.dayIndex)
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
            .map((b) => `${b.start_time}-${b.end_time} ${b.subject}`);

    const upcomingEvals = (evals.data ?? [])
      .filter((e) => e.eval_date >= today.date && e.grade == null)
      .sort((a, b) => a.eval_date.localeCompare(b.eval_date))
      .slice(0, 10)
      .map((e) => ({
        date: e.eval_date,
        subject: subjectName.get(e.subject_id) ?? null,
        name: e.name,
        weight: e.weight,
      }));

    const openIdeas = (ideas.data ?? [])
      .filter((i) => !(i.script_done && i.recorded && i.edited))
      .map((i) => ({
        id: i.id,
        title: i.title,
        guion: !!i.script_done,
        grabado: !!i.recorded,
        editado: !!i.edited,
      }));

    const kbFolderName = new Map((kbFolders.data ?? []).map((f) => [f.id, f.name]));
    const baseDeConocimiento = {};
    for (const d of kbDocs.data ?? []) {
      const key = d.folder_id ? kbFolderName.get(d.folder_id) ?? "?" : "Sin carpeta";
      (baseDeConocimiento[key] ??= []).push(d.title);
    }

    return ok({
      hoy: today,
      base_de_conocimiento: Object.keys(baseDeConocimiento).length
        ? {
            ...baseDeConocimiento,
            nota: 'Usa la herramienta "knowledge" para leer el contenido completo.',
          }
        : "vacía",
      tareas_pendientes: {
        total: pendingTasks.length,
        atrasadas: pendingTasks.filter((t) => t.overdue).length,
        items: pendingTasks.slice(0, 25),
      },
      clases_de_hoy: todaysClasses,
      evaluaciones_proximas: upcomingEvals,
      ideas_de_contenido_abiertas: openIdeas.slice(0, 15),
      compras_pendientes: (tobuy.data ?? []).map((i) => i.title).slice(0, 30),
      proyectos: (projects.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        client: p.client ?? null,
        status: p.status ?? null,
      })),
      ...(notes.length ? { tablas_no_disponibles: notes } : {}),
    });
  })
);

server.registerTool(
  "get_context",
  {
    description:
      "Lee las notas libres del botón CONTEXT de una sección de NEXUS " +
      "(su scratchpad personal). Sin argumento devuelve todas las secciones " +
      "que tengan notas.",
    inputSchema: z.object({
      section: z
        .enum(SECTIONS)
        .optional()
        .describe("Sección concreta; omitir para traer todas"),
    }),
  },
  tool(async ({ section }) => {
    const { supabase } = await getSession();
    let query = supabase.from("section_notes").select("section,content,updated_at");
    if (section) query = query.eq("section", section);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data ?? []).filter((r) => (r.content ?? "").trim().length > 0);
    if (rows.length === 0) return ok("No hay notas de contexto guardadas.");
    return ok(rows);
  })
);

server.registerTool(
  "save_context",
  {
    description:
      "Guarda (sobrescribe) las notas del botón CONTEXT de una sección de NEXUS.",
    inputSchema: z.object({
      section: z.enum(SECTIONS),
      content: z.string().describe("Texto completo que queda guardado"),
    }),
  },
  tool(async ({ section, content }) => {
    const { supabase, userId } = await getSession();
    const { error } = await supabase.from("section_notes").upsert(
      {
        user_id: userId,
        section,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,section" }
    );
    if (error) throw new Error(error.message);
    return ok(`Contexto de "${section}" guardado (${content.length} caracteres).`);
  })
);

server.registerTool(
  "list_tasks",
  {
    description:
      "Lista sus tareas. Por defecto solo las pendientes de su lista " +
      "personal; con project trae las de un proyecto.",
    inputSchema: z.object({
      include_done: z.boolean().optional().describe("Incluir las ya hechas"),
      project: z
        .string()
        .optional()
        .describe('Nombre de un proyecto, o "todos" para no filtrar'),
    }),
  },
  tool(async ({ include_done, project }) => {
    const { supabase } = await getSession();
    const [{ data: tasks, error }, { data: projects }] = await Promise.all([
      supabase.from("tasks").select("*").order("sort_order"),
      supabase.from("personal_projects").select("id,name"),
    ]);
    if (error) throw new Error(error.message);
    const projectById = new Map((projects ?? []).map((p) => [p.id, p.name]));

    let rows = tasks ?? [];
    if (!project) {
      rows = rows.filter((t) => !t.project_id);
    } else if (project.toLowerCase() !== "todos") {
      const match = (projects ?? []).find(
        (p) => p.name.toLowerCase() === project.toLowerCase()
      );
      if (!match)
        throw new Error(
          `No existe el proyecto "${project}". Proyectos: ${
            (projects ?? []).map((p) => p.name).join(", ") || "ninguno"
          }`
        );
      rows = rows.filter((t) => t.project_id === match.id);
    }

    const rank = { alta: 0, media: 1, baja: 2 };
    return ok(
      rows
        .filter((t) => include_done || !t.done)
        .sort((a, b) => rank[a.priority] - rank[b.priority])
        .map((t) => ({
          id: t.id,
          title: t.title,
          hecha: !!t.done,
          prioridad: t.priority,
          fecha: t.due,
          responsable: t.assignee || null,
          proyecto: t.project_id ? projectById.get(t.project_id) ?? null : null,
        }))
    );
  })
);

server.registerTool(
  "create_task",
  {
    description:
      "Crea una tarea. Sin project va a su lista personal; con project " +
      "queda dentro de ese proyecto.",
    inputSchema: z.object({
      title: z.string(),
      priority: z.enum(["alta", "media", "baja"]).optional(),
      due: z.string().optional().describe("Fecha YYYY-MM-DD"),
      assignee: z.string().optional().describe("Quién es responsable"),
      project: z
        .string()
        .optional()
        .describe("Nombre de un proyecto existente de Project Management"),
    }),
  },
  tool(async ({ title, priority, due, assignee, project }) => {
    const { supabase, userId } = await getSession();

    let projectId = null;
    if (project) {
      const { data: rows } = await supabase
        .from("personal_projects")
        .select("id,name");
      const match = (rows ?? []).find(
        (p) => p.name.toLowerCase() === project.toLowerCase()
      );
      if (!match)
        throw new Error(
          `No existe el proyecto "${project}". Proyectos: ${
            (rows ?? []).map((p) => p.name).join(", ") || "ninguno"
          }`
        );
      projectId = match.id;
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title,
        priority: priority ?? "media",
        due: due ?? null,
        assignee: assignee ?? "",
        project_id: projectId,
        done: false,
        sort_order: Date.now(),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return ok({ creada: { id: data.id, title: data.title, due: data.due } });
  })
);

server.registerTool(
  "update_task",
  {
    description:
      "Actualiza una tarea: marcarla hecha o pendiente, cambiar título, " +
      "prioridad, fecha o el proyecto al que pertenece.",
    inputSchema: z.object({
      id: z.string(),
      title: z.string().optional(),
      done: z.boolean().optional().describe("true la marca hecha"),
      priority: z.enum(["alta", "media", "baja"]).optional(),
      due: z.string().nullable().optional(),
      assignee: z.string().optional().describe("Quién es responsable"),
      project: z
        .string()
        .nullable()
        .optional()
        .describe("Nombre del proyecto al que moverla; null la vuelve personal"),
    }),
  },
  tool(async ({ id, project, ...fields }) => {
    const { supabase } = await getSession();
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );

    if (project !== undefined) {
      if (project === null) {
        patch.project_id = null;
      } else {
        const { data: rows } = await supabase
          .from("personal_projects")
          .select("id,name");
        const match = (rows ?? []).find(
          (p) => p.name.toLowerCase() === project.toLowerCase()
        );
        if (!match)
          throw new Error(
            `No existe el proyecto "${project}". Proyectos: ${
              (rows ?? []).map((p) => p.name).join(", ") || "ninguno"
            }`
          );
        patch.project_id = match.id;
      }
    }

    if (Object.keys(patch).length === 0) throw new Error("Nada que actualizar.");

    const { data, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return ok({ actualizada: { id: data.id, title: data.title, hecha: !!data.done } });
  })
);

server.registerTool(
  "list_content_ideas",
  {
    description:
      "Lista las ideas de contenido con su categoría y progreso " +
      "(guion / grabado / editado).",
    inputSchema: z.object({
      include_done: z.boolean().optional(),
    }),
  },
  tool(async ({ include_done }) => {
    const { supabase } = await getSession();
    const [{ data: cats }, { data: ideas, error }] = await Promise.all([
      supabase.from("content_categories").select("*"),
      supabase.from("content_ideas").select("*").order("sort_order"),
    ]);
    if (error) throw new Error(error.message);
    const catName = new Map((cats ?? []).map((c) => [c.id, c.name]));
    const rows = (ideas ?? [])
      .filter((i) => include_done || !(i.script_done && i.recorded && i.edited))
      .map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description || null,
        categoria: i.category_id ? catName.get(i.category_id) ?? null : "Sin categoría",
        guion: !!i.script_done,
        grabado: !!i.recorded,
        editado: !!i.edited,
        tiene_script: !!(i.script && i.script.trim()),
      }));
    return ok(rows);
  })
);

server.registerTool(
  "create_content_idea",
  {
    description: "Crea una idea de contenido nueva en NEXUS.",
    inputSchema: z.object({
      title: z.string(),
      description: z.string().optional(),
      script: z.string().optional().describe("Guion completo, si ya lo tienes"),
      category: z
        .string()
        .optional()
        .describe("Nombre de una categoría existente; si no coincide queda sin categoría"),
    }),
  },
  tool(async ({ title, description, script, category }) => {
    const { supabase, userId } = await getSession();

    let categoryId = null;
    if (category) {
      const { data: cats } = await supabase.from("content_categories").select("id,name");
      const match = (cats ?? []).find(
        (c) => c.name.toLowerCase() === category.toLowerCase()
      );
      categoryId = match?.id ?? null;
    }

    // Append at the end of its column, matching how the board orders cards
    const countQuery = supabase
      .from("content_ideas")
      .select("id", { count: "exact", head: true });
    const { count } = await (categoryId
      ? countQuery.eq("category_id", categoryId)
      : countQuery.is("category_id", null));

    const { data, error } = await supabase
      .from("content_ideas")
      .insert({
        user_id: userId,
        title,
        description: description ?? "",
        script: script ?? "",
        category_id: categoryId,
        sort_order: count ?? 0,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return ok({ creada: { id: data.id, title: data.title } });
  })
);

server.registerTool(
  "list_tobuy",
  {
    description: "Lista la lista de compras (To Buy) agrupada por categoría.",
    inputSchema: z.object({
      include_checked: z.boolean().optional().describe("Incluir lo ya comprado"),
    }),
  },
  tool(async ({ include_checked }) => {
    const { supabase } = await getSession();
    const [{ data: cats }, { data: items, error }] = await Promise.all([
      supabase.from("tobuy_categories").select("*").order("sort_order"),
      supabase.from("tobuy_items").select("*").order("sort_order"),
    ]);
    if (error) throw new Error(error.message);
    const catName = new Map((cats ?? []).map((c) => [c.id, c.name]));
    const grouped = {};
    for (const item of items ?? []) {
      if (!include_checked && item.checked) continue;
      const key = item.category_id ? catName.get(item.category_id) ?? "?" : "Sin categoría";
      (grouped[key] ??= []).push(item.checked ? `${item.title} (comprado)` : item.title);
    }
    return ok(grouped);
  })
);

server.registerTool(
  "add_tobuy_item",
  {
    description: "Agrega un artículo a la lista de compras de NEXUS.",
    inputSchema: z.object({
      title: z.string(),
      category: z
        .string()
        .optional()
        .describe("Nombre de una categoría existente, por ejemplo Mercado"),
    }),
  },
  tool(async ({ title, category }) => {
    const { supabase, userId } = await getSession();

    let categoryId = null;
    if (category) {
      const { data: cats } = await supabase.from("tobuy_categories").select("id,name");
      const match = (cats ?? []).find(
        (c) => c.name.toLowerCase() === category.toLowerCase()
      );
      categoryId = match?.id ?? null;
    }

    const { data, error } = await supabase
      .from("tobuy_items")
      .insert({
        user_id: userId,
        title,
        category_id: categoryId,
        checked: false,
        sort_order: Date.now() % 100000,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return ok({ agregado: { id: data.id, title: data.title } });
  })
);

server.registerTool(
  "get_schedule",
  {
    description:
      "Horario de clases de la semana (lunes a viernes). Por defecto el suyo; " +
      "puede traer el de un amigo registrado para comparar disponibilidad.",
    inputSchema: z.object({
      person: z
        .string()
        .optional()
        .describe('Nombre de un amigo; omitir para su propio horario; "todos" para todos'),
    }),
  },
  tool(async ({ person }) => {
    const { supabase } = await getSession();
    const [{ data: people }, { data: blocks, error }] = await Promise.all([
      supabase.from("grades_schedule_people").select("*"),
      supabase.from("grades_schedule_blocks").select("*"),
    ]);
    if (error) throw new Error(error.message);

    const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
    const nameById = new Map((people ?? []).map((p) => [p.id, p.name]));

    let filtered = blocks ?? [];
    if (!person) {
      filtered = filtered.filter((b) => !b.person_id);
    } else if (person.toLowerCase() !== "todos") {
      const match = (people ?? []).find(
        (p) => p.name.toLowerCase() === person.toLowerCase()
      );
      if (!match)
        throw new Error(
          `No existe el amigo "${person}". Registrados: ${
            (people ?? []).map((p) => p.name).join(", ") || "ninguno"
          }`
        );
      filtered = filtered.filter((b) => b.person_id === match.id);
    }

    const out = {};
    for (const b of filtered.sort((a, b) => a.start_time.localeCompare(b.start_time))) {
      const day = DAYS[b.day] ?? `día ${b.day}`;
      const who = b.person_id ? nameById.get(b.person_id) ?? "?" : "yo";
      (out[day] ??= []).push(
        `${b.start_time}-${b.end_time} ${b.subject}${person?.toLowerCase() === "todos" ? ` [${who}]` : ""}`
      );
    }
    return ok({ hoy: caracasToday(), horario: out });
  })
);

server.registerTool(
  "list_subjects",
  {
    description:
      "Materias de la universidad con sus evaluaciones, notas, promedio " +
      "acumulado y el plan de evaluación si lo tiene adjunto.",
    inputSchema: z.object({}),
  },
  tool(async () => {
    const { supabase } = await getSession();
    const [{ data: subjects, error }, { data: evals }] = await Promise.all([
      supabase.from("grades_subjects").select("*").order("sort_order"),
      supabase.from("grades_evaluations").select("*").order("sort_order"),
    ]);
    if (error) throw new Error(error.message);

    return ok(
      (subjects ?? []).map((s) => {
        const mine = (evals ?? []).filter((e) => e.subject_id === s.id);
        const earned = mine.reduce(
          (acc, e) => acc + (e.grade == null ? 0 : (e.grade / 20) * (20 * (e.weight / 100))),
          0
        );
        const planText = (s.eval_plan_text ?? "").replace(/<[^>]*>/g, " ").trim();
        return {
          id: s.id,
          name: s.name,
          acumulado: Number(earned.toFixed(2)),
          peso_evaluado: mine.reduce((a, e) => a + (e.grade == null ? 0 : e.weight), 0),
          evaluaciones: mine.map((e) => ({
            name: e.name,
            weight: e.weight,
            grade: e.grade,
            date: e.eval_date,
          })),
          plan_de_evaluacion: planText || null,
          plan_imagenes: Array.isArray(s.eval_plan_images) ? s.eval_plan_images.length : 0,
        };
      })
    );
  })
);

server.registerTool(
  "list_projects",
  {
    description:
      "Proyectos del módulo Project Management, con cliente, estado y stack. " +
      "Útil como contexto de los trabajos de la agencia.",
    inputSchema: z.object({}),
  },
  tool(async () => {
    const { supabase } = await getSession();
    const { data, error } = await supabase.from("personal_projects").select("*");
    if (error) throw new Error(error.message);
    return ok(
      (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        client: p.client || null,
        status: p.status ?? null,
        payment_status: p.payment_status ?? null,
        budget: p.budget ?? null,
        description: p.description || null,
        tech_stack: Array.isArray(p.tech_stack) ? p.tech_stack : [],
        milestones: Array.isArray(p.milestones) ? p.milestones.length : 0,
      }))
    );
  })
);

server.registerTool(
  "knowledge",
  {
    description:
      "SU BASE DE CONOCIMIENTO: documentos markdown con quién es, su salud, " +
      "su agencia, etc. Léelo antes de responder cualquier cosa personal " +
      "(peso, salud, preferencias, clientes) en vez de preguntárselo. " +
      "Sin argumentos devuelve el índice; con folder o doc devuelve el " +
      "contenido completo.",
    inputSchema: z.object({
      folder: z
        .string()
        .optional()
        .describe('Nombre de carpeta, ej. "Salud". Devuelve sus documentos completos'),
      doc: z.string().optional().describe("Título exacto o parcial de un documento"),
      full: z
        .boolean()
        .optional()
        .describe("Devuelve TODOS los documentos completos (útil al empezar)"),
    }),
  },
  tool(async ({ folder, doc, full }) => {
    const { supabase } = await getSession();
    const [{ data: folders, error: fErr }, { data: docs, error: dErr }] =
      await Promise.all([
        supabase.from("knowledge_folders").select("*").order("sort_order"),
        supabase.from("knowledge_docs").select("*").order("sort_order"),
      ]);
    if (fErr) throw new Error(fErr.message);
    if (dErr) throw new Error(dErr.message);

    const folderName = new Map((folders ?? []).map((f) => [f.id, f.name]));
    const withFolder = (d) => ({
      titulo: d.title,
      carpeta: d.folder_id ? folderName.get(d.folder_id) ?? "?" : "Sin carpeta",
      contenido: d.content,
      actualizado: d.updated_at,
    });

    if (doc) {
      const needle = doc.toLowerCase();
      const matches = (docs ?? []).filter((d) =>
        d.title.toLowerCase().includes(needle)
      );
      if (matches.length === 0)
        throw new Error(
          `No hay documento que coincida con "${doc}". Títulos: ${
            (docs ?? []).map((d) => d.title).join(", ") || "ninguno"
          }`
        );
      return ok(matches.map(withFolder));
    }

    if (folder) {
      const match = (folders ?? []).find(
        (f) => f.name.toLowerCase() === folder.toLowerCase()
      );
      if (!match)
        throw new Error(
          `No existe la carpeta "${folder}". Carpetas: ${
            (folders ?? []).map((f) => f.name).join(", ") || "ninguna"
          }`
        );
      return ok(
        (docs ?? []).filter((d) => d.folder_id === match.id).map(withFolder)
      );
    }

    if (full) return ok((docs ?? []).map(withFolder));

    // Index only, so a first call stays cheap
    return ok({
      carpetas: (folders ?? []).map((f) => ({
        nombre: f.name,
        documentos: (docs ?? [])
          .filter((d) => d.folder_id === f.id)
          .map((d) => d.title),
      })),
      sin_carpeta: (docs ?? []).filter((d) => !d.folder_id).map((d) => d.title),
      nota: 'Usa folder, doc o full:true para traer el contenido completo.',
    });
  })
);

server.registerTool(
  "write_knowledge",
  {
    description:
      "Crea o actualiza un documento de la base de conocimiento. Si el " +
      "título ya existe lo sobrescribe; si no, lo crea en la carpeta indicada.",
    inputSchema: z.object({
      title: z.string(),
      content: z.string().describe("Contenido en markdown"),
      folder: z
        .string()
        .optional()
        .describe("Carpeta destino por nombre; si no existe, queda sin carpeta"),
      append: z
        .boolean()
        .optional()
        .describe("Agrega al final en vez de sobrescribir"),
    }),
  },
  tool(async ({ title, content, folder, append }) => {
    const { supabase, userId } = await getSession();
    const [{ data: folders }, { data: docs }] = await Promise.all([
      supabase.from("knowledge_folders").select("id,name"),
      supabase.from("knowledge_docs").select("id,title,content,folder_id"),
    ]);

    const existing = (docs ?? []).find(
      (d) => d.title.toLowerCase() === title.toLowerCase()
    );

    if (existing) {
      const next = append
        ? `${existing.content}\n\n${content}`.trim()
        : content;
      const { error } = await supabase
        .from("knowledge_docs")
        .update({ content: next, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return ok(`Documento "${existing.title}" actualizado.`);
    }

    const folderId = folder
      ? (folders ?? []).find((f) => f.name.toLowerCase() === folder.toLowerCase())
          ?.id ?? null
      : null;

    const { error } = await supabase.from("knowledge_docs").insert({
      user_id: userId,
      folder_id: folderId,
      title,
      content,
      sort_order: (docs ?? []).length,
    });
    if (error) throw new Error(error.message);
    return ok(
      `Documento "${title}" creado${folderId ? ` en ${folder}` : " sin carpeta"}.`
    );
  })
);

// ============================================
// START
// ============================================

await serveStdio(() => server);
