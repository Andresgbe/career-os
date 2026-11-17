#!/usr/bin/env node
// NEXUS MCP server — exposes the career-os Supabase data to Claude so it can
// read context (schedule, ideas, subjects, projects, finance, per-section
// notes) and act on it (create ideas, log transactions, save notes).
//
// Runs locally over stdio. Register it with:
//   claude mcp add --scope user nexus -- node C:/career-os/mcp-server/index.js
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createClient } from "@supabase/supabase-js";
import * as z from "zod";
import dotenv from "dotenv";

import { registerCrudTools } from "./crud.js";

// Load .env sitting next to this file — the server's working directory is
// wherever Claude Code launched it from, which is usually not this folder.
dotenv.config({ path: new URL(".env", import.meta.url), quiet: true });

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
  "motorcycle",
  "medical",
  "content",
  "grades",
  "projects",
  "pipeline",
  "finance",
  "passwords",
];

// ============================================
// SERVER
// ============================================

const server = new McpServer({ name: "nexus", version: "1.0.0" });

server.registerTool(
  "overview",
  {
    description:
      "Snapshot completo del estado actual de NEXUS: clases de hoy, " +
      "ideas de contenido en progreso, " +
      "evaluaciones próximas y proyectos. Úsalo primero para tener contexto " +
      "antes de hacer cualquier tarea.",
    inputSchema: z.object({}),
  },
  tool(async () => {
    const { supabase } = await getSession();
    const today = caracasToday();

    const [schedule, ideas, evals, subjects, projects] =
      await Promise.all([
        soft(
          "schedule",
          supabase.from("grades_schedule_blocks").select("*").is("person_id", null)
        ),
        soft("content_ideas", supabase.from("content_ideas").select("*")),
        soft(
          "evaluations",
          supabase.from("grades_evaluations").select("*").not("eval_date", "is", null)
        ),
        soft("subjects", supabase.from("grades_subjects").select("id,name")),
        soft("projects", supabase.from("personal_projects").select("*")),
      ]);

    // Index of BRAIN, so Claude knows what context exists and pulls the
    // full text with the `brain` tool.
    const kbFolders = await soft(
      "knowledge_folders",
      supabase.from("knowledge_folders").select("id,name,section").order("sort_order")
    );
    const kbDocs = await soft(
      "knowledge_docs",
      supabase.from("knowledge_docs").select("title,folder_id,section")
    );

    const notes = [schedule, ideas, evals, subjects, projects]
      .filter((r) => r.error)
      .map((r) => `${r.label}: ${r.error}`);

    const subjectName = new Map((subjects.data ?? []).map((s) => [s.id, s.name]));

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
    const brainIndex = {};
    for (const d of (kbDocs.data ?? []).filter((x) => x.section === "brain")) {
      const key = d.folder_id ? kbFolderName.get(d.folder_id) ?? "?" : "Sin carpeta";
      (brainIndex[key] ??= []).push(d.title);
    }

    return ok({
      hoy: today,
      brain: Object.keys(brainIndex).length
        ? {
            ...brainIndex,
            nota: 'Contexto principal de Andrés (quién es, salud, agencia, universidad, finanzas...). Abre lo que necesites con la herramienta "brain" antes de trabajar.',
          }
        : "vacío",
      clases_de_hoy: todaysClasses,
      evaluaciones_proximas: upcomingEvals,
      ideas_de_contenido_abiertas: openIdeas.slice(0, 15),
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
        no_publicar: !!i.do_not_publish,
        hook: i.hook || null,
        formato: i.format || null,
        fecha: i.scheduled_date ?? null,
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

// ============================================
// CONTENT — WEEKLY PLANNER
// Mirrors src/features/content/types.ts: ISO weeks (Mon–Sun) keyed
// 'YYYY-Www'; a piece belongs to a week through its scheduled_date.
// ============================================

const FORMAT_KEYS = ["reel", "carrusel", "post", "historia", "video", "texto"];
const STYLE_KEYS = ["animado", "humano", "noticia", "foto"];

// Average views / saves per post, by format and by style, over publications
// that have the number (metrics are entered by hand in NEXUS).
function metricsByGroup(pubsRaw, ideas, snaps = []) {
  // each publication gets the numbers of its latest snapshot
  const latestOf = new Map();
  for (const s of snaps) {
    const cur = latestOf.get(s.publication_id);
    if (!cur || s.captured_on > cur.captured_on) latestOf.set(s.publication_id, s);
  }
  const pubs = pubsRaw.map((p) => ({ ...p, ...(latestOf.get(p.id) ?? {}), id: p.id, idea_id: p.idea_id }));
  const withViews = pubs.filter((p) => typeof p.views === "number");
  if (!withViews.length) return "sin datos todavía";
  const ideaOf = new Map(ideas.map((i) => [i.id, i]));
  const avg = (rows, k) => {
    const v = rows.map((r) => r[k]).filter((x) => typeof x === "number");
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  const group = (field) => {
    const g = {};
    for (const p of pubs) {
      const key = ideaOf.get(p.idea_id)?.[field] || "sin definir";
      (g[key] ??= []).push(p);
    }
    return Object.fromEntries(
      Object.entries(g).map(([k, rows]) => [k, { posts: rows.length, vistas_prom: avg(rows, "views"), guardados_prom: avg(rows, "saves") }])
    );
  };
  return { por_formato: group("format"), por_estilo: group("style") };
}
const pad2 = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseDate = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function weekKeyOfDate(d) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3);
  const year = t.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week =
    1 + Math.round(((t - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return `${year}-W${pad2(week)}`;
}

function weekDates(key) {
  const [y, w] = key.split("-W").map(Number);
  const jan4 = new Date(y, 0, 4);
  const monday = new Date(y, 0, 4 - ((jan4.getDay() + 6) % 7) + (w - 1) * 7);
  return Array.from({ length: 7 }, (_, i) =>
    isoDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i))
  );
}

const WEEK_KEY = z
  .string()
  .regex(/^\d{4}-W\d{2}$/)
  .describe("Semana ISO, formato 'YYYY-Www' (ej. 2026-W46). Lunes a domingo.");

server.registerTool(
  "get_content_week",
  {
    description:
      "Plan de contenido de una semana ISO: tema, brief, estado, las piezas " +
      "programadas día por día y el banco de ideas sin fecha. Úsalo antes de " +
      "plan_content_week (y get_content_context para la voz, audiencia y pilares). " +
      "Sin week_key devuelve la semana actual.",
    inputSchema: z.object({ week_key: WEEK_KEY.optional() }),
  },
  tool(async ({ week_key }) => {
    const { supabase } = await getSession();
    const key = week_key ?? weekKeyOfDate(parseDate(caracasToday().date));
    const dates = weekDates(key);

    const [{ data: cats }, { data: ideas, error }, weekRes, pubRes, snapResult] = await Promise.all([
      supabase.from("content_categories").select("id,name"),
      supabase.from("content_ideas").select("*"),
      soft(
        "content_weeks",
        supabase.from("content_weeks").select("*").eq("week_key", key).maybeSingle()
      ),
      soft("content_publications", supabase.from("content_publications").select("*")),
      soft("content_post_metrics", supabase.from("content_post_metrics").select("*")),
    ]);
    const pubs = pubRes.error ? [] : pubRes.data;
    const snapRows = snapResult.error ? [] : snapResult.data;
    const postedOn = new Map();
    for (const p of pubs) postedOn.set(p.idea_id, [...(postedOn.get(p.idea_id) ?? []), p.platform]);
    if (error) throw new Error(error.message);
    const catName = new Map((cats ?? []).map((c) => [c.id, c.name]));
    const piece = (i) => ({
      id: i.id,
      title: i.title,
      hook: i.hook || null,
      formato: i.format || null,
      estilo: i.style || null,
      publicada_en: postedOn.get(i.id) ?? [],
      categoria: i.category_id ? catName.get(i.category_id) ?? null : null,
      descripcion: i.description || null,
      guion: !!i.script_done,
      grabado: !!i.recorded,
      editado: !!i.edited,
      tiene_script: !!(i.script && i.script.trim()),
    });

    const all = ideas ?? [];
    const plan = weekRes.error ? null : weekRes.data;
    return ok({
      semana: key,
      desde: dates[0],
      hasta: dates[6],
      plan: plan
        ? { tema: plan.title, brief: plan.goal, notas: plan.notes, estado: plan.status }
        : { estado: "sin plan", nota: weekRes.error ?? null },
      dias: dates.map((date) => ({
        fecha: date,
        piezas: all
          .filter((i) => i.scheduled_date === date)
          .sort((a, b) => (a.schedule_order ?? 0) - (b.schedule_order ?? 0))
          .map(piece),
      })),
      // Pieces marked do_not_publish never show up here (they reveal his
      // stack or client process).
      listas_para_publicar: all
        .filter((i) => !i.scheduled_date && i.script_done && i.recorded && i.edited && !i.do_not_publish)
        .map(piece),
      banco_de_ideas: all
        .filter((i) => !i.scheduled_date && !(i.script_done && i.recorded && i.edited) && !i.do_not_publish)
        .map(piece),
      categorias: [...catName.values()],
      metricas: metricsByGroup(pubs, all, snapRows),
      formatos: FORMAT_KEYS,
    });
  })
);

server.registerTool(
  "plan_content_week",
  {
    description:
      "Planea una semana de contenido en NEXUS: guarda tema/brief/estado de la " +
      "semana y programa piezas en días concretos. Cada pieza con idea_id mueve " +
      "(y actualiza) una idea existente del banco; sin idea_id crea una nueva. " +
      "Las fechas deben caer dentro de la semana.",
    inputSchema: z.object({
      week_key: WEEK_KEY,
      title: z.string().optional().describe("Tema de la semana"),
      goal: z.string().optional().describe("Brief: objetivo, audiencia, ángulo"),
      status: z.enum(["draft", "approved", "done"]).optional(),
      pieces: z
        .array(
          z.object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Día de publicación YYYY-MM-DD"),
            idea_id: z.string().optional().describe("Id de una idea existente a programar"),
            title: z.string().optional().describe("Obligatorio si no hay idea_id"),
            hook: z.string().optional(),
            format: z.enum(FORMAT_KEYS).optional(),
            style: z.enum(STYLE_KEYS).optional().describe("Cómo se produce: animado | humano | noticia | foto"),
            description: z.string().optional(),
            script: z.string().optional(),
            category: z.string().optional().describe("Nombre de una categoría existente"),
          })
        )
        .optional(),
    }),
  },
  tool(async ({ week_key, title, goal, status, pieces }) => {
    const { supabase, userId } = await getSession();
    const dates = weekDates(week_key);
    const list = pieces ?? [];
    const outside = list.filter((p) => !dates.includes(p.date));
    if (outside.length) {
      return fail(
        `Estas fechas no están en ${week_key} (${dates[0]} a ${dates[6]}): ` +
          outside.map((p) => p.date).join(", ")
      );
    }
    if (list.some((p) => !p.idea_id && !p.title)) {
      return fail("Cada pieza nueva necesita title.");
    }
    const ids = list.map((p) => p.idea_id).filter(Boolean);
    if (ids.length) {
      const { data: rows, error } = await supabase.from("content_ideas").select("*").in("id", ids);
      if (error) throw new Error(error.message);
      const blocked = (rows ?? []).filter((r) => r.do_not_publish);
      if (blocked.length) {
        return fail(
          "Estas ideas están marcadas como 'no publicar' y no se pueden programar: " +
            blocked.map((r) => r.title).join(", ")
        );
      }
    }

    const weekFields = {};
    if (title !== undefined) weekFields.title = title;
    if (goal !== undefined) weekFields.goal = goal;
    if (status !== undefined) weekFields.status = status;
    if (Object.keys(weekFields).length || list.length) {
      const { error } = await supabase.from("content_weeks").upsert(
        {
          user_id: userId,
          week_key,
          ...weekFields,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,week_key" }
      );
      if (error) throw new Error(error.message);
    }

    const { data: cats } = await supabase.from("content_categories").select("id,name");
    const catId = (name) =>
      name
        ? (cats ?? []).find((c) => c.name.toLowerCase() === name.toLowerCase())?.id ?? null
        : undefined;

    // New pieces go after whatever is already on that day
    const { data: existing } = await supabase
      .from("content_ideas")
      .select("id,scheduled_date")
      .in("scheduled_date", dates);
    const dayCount = new Map(dates.map((d) => [d, 0]));
    for (const row of existing ?? []) {
      dayCount.set(row.scheduled_date, (dayCount.get(row.scheduled_date) ?? 0) + 1);
    }
    const nextOrder = (date) => {
      const n = dayCount.get(date) ?? 0;
      dayCount.set(date, n + 1);
      return n;
    };

    const done = [];
    for (const p of list) {
      const fields = {};
      if (p.title !== undefined) fields.title = p.title;
      if (p.hook !== undefined) fields.hook = p.hook;
      if (p.format !== undefined) fields.format = p.format;
      if (p.style !== undefined) fields.style = p.style;
      if (p.description !== undefined) fields.description = p.description;
      if (p.script !== undefined) fields.script = p.script;
      const category = catId(p.category);
      if (category !== undefined) fields.category_id = category;

      if (p.idea_id) {
        const { data, error } = await supabase
          .from("content_ideas")
          .update({
            ...fields,
            scheduled_date: p.date,
            schedule_order: nextOrder(p.date),
            updated_at: new Date().toISOString(),
          })
          .eq("id", p.idea_id)
          .select("id,title")
          .single();
        if (error) throw new Error(`${p.idea_id}: ${error.message}`);
        done.push({ fecha: p.date, accion: "programada", id: data.id, title: data.title });
      } else {
        const categoryId = fields.category_id ?? null;
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
            description: "",
            script: "",
            ...fields,
            category_id: categoryId,
            sort_order: count ?? 0,
            scheduled_date: p.date,
            schedule_order: nextOrder(p.date),
          })
          .select("id,title")
          .single();
        if (error) throw new Error(`${p.title}: ${error.message}`);
        done.push({ fecha: p.date, accion: "creada", id: data.id, title: data.title });
      }
    }

    return ok({ semana: week_key, ...weekFields, piezas: done });
  })
);

// ============================================
// CONTENT — CONTEXT DOCS
// The Content module's "Contexto IA" tab: knowledge_folders/docs rows with
// section = 'content'. Filtered client-side so an unmigrated DB (no section
// column) just reads as empty instead of failing.
// ============================================

const CONTENT_SECTION = "content";

async function loadContentContext(supabase) {
  const [{ data: folders, error: fErr }, { data: docs, error: dErr }] =
    await Promise.all([
      supabase.from("knowledge_folders").select("*").order("sort_order"),
      supabase.from("knowledge_docs").select("*").order("sort_order"),
    ]);
  if (fErr) throw new Error(fErr.message);
  if (dErr) throw new Error(dErr.message);
  return {
    folders: (folders ?? []).filter((f) => f.section === CONTENT_SECTION),
    docs: (docs ?? []).filter((d) => d.section === CONTENT_SECTION),
  };
}

server.registerTool(
  "get_content_context",
  {
    description:
      "CONTEXTO DE CONTENIDO: documentos markdown de la pestaña Contexto IA " +
      "del módulo Content (voz y tono, audiencia, pilares, formatos, " +
      "aprendizajes...). Léelo SIEMPRE antes de planear una semana, proponer " +
      "ideas o escribir guiones. Sin argumentos devuelve todos los documentos " +
      "completos agrupados por carpeta.",
    inputSchema: z.object({
      folder: z.string().optional().describe("Solo esta carpeta (por nombre)"),
    }),
  },
  tool(async ({ folder }) => {
    const { supabase } = await getSession();
    const { folders, docs } = await loadContentContext(supabase);
    const picked = folder
      ? folders.filter((f) => f.name.toLowerCase() === folder.toLowerCase())
      : folders;
    if (folder && picked.length === 0) {
      throw new Error(
        `No existe la carpeta "${folder}". Carpetas: ${
          folders.map((f) => f.name).join(", ") || "ninguna"
        }`
      );
    }
    const asDoc = (d) => ({ titulo: d.title, contenido: d.content, actualizado: d.updated_at });
    const out = {
      carpetas: picked.map((f) => ({
        carpeta: f.name,
        documentos: docs.filter((d) => d.folder_id === f.id).map(asDoc),
      })),
    };
    if (!folder) out.sin_carpeta = docs.filter((d) => !d.folder_id).map(asDoc);
    if (folders.length === 0 && docs.length === 0) {
      out.nota =
        "Aún no hay contexto de contenido. Pídele que abra Content → Contexto IA " +
        "y cree las carpetas, o créalas con write_content_context.";
    }
    return ok(out);
  })
);

server.registerTool(
  "write_content_context",
  {
    description:
      "Crea o actualiza un documento del contexto de contenido (pestaña " +
      "Contexto IA). Si ya existe un documento con ese título en el contexto " +
      "de contenido lo sobrescribe (o le agrega al final con append); si no, " +
      "lo crea en la carpeta indicada, creando la carpeta si hace falta. Úsalo " +
      "para registrar aprendizajes, ajustar la voz, sumar referencias, etc.",
    inputSchema: z.object({
      title: z.string(),
      content: z.string().describe("Contenido en markdown"),
      folder: z.string().optional().describe('Carpeta destino, ej. "Aprendizajes"'),
      append: z.boolean().optional().describe("Agrega al final en vez de sobrescribir"),
    }),
  },
  tool(async ({ title, content, folder, append }) => {
    const { supabase, userId } = await getSession();
    const { folders, docs } = await loadContentContext(supabase);

    const existing = docs.find((d) => d.title.toLowerCase() === title.toLowerCase());
    if (existing) {
      const next = append ? `${existing.content}\n\n${content}`.trim() : content;
      const { error } = await supabase
        .from("knowledge_docs")
        .update({ content: next, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return ok(`Documento de contexto "${existing.title}" actualizado.`);
    }

    let folderId = null;
    if (folder) {
      const match = folders.find((f) => f.name.toLowerCase() === folder.toLowerCase());
      if (match) {
        folderId = match.id;
      } else {
        const { data, error } = await supabase
          .from("knowledge_folders")
          .insert({
            user_id: userId,
            name: folder,
            color: "#8b5cf6",
            sort_order: folders.length,
            section: CONTENT_SECTION,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        folderId = data.id;
      }
    }

    const { error } = await supabase.from("knowledge_docs").insert({
      user_id: userId,
      folder_id: folderId,
      title,
      content,
      sort_order: docs.filter((d) => d.folder_id === folderId).length,
      section: CONTENT_SECTION,
    });
    if (error) throw new Error(error.message);
    return ok(`Documento de contexto "${title}" creado${folder ? ` en ${folder}` : ""}.`);
  })
);

// ============================================
// BRAIN
// The fixed BRAIN page in NEXUS: knowledge_folders / knowledge_docs rows
// with section = 'brain'. It's the single source of context agents read
// before working. Filtered client-side, like the content context.
// ============================================

const BRAIN_SECTION = "brain";

async function loadBrain(supabase) {
  const [{ data: folders, error: fErr }, { data: docs, error: dErr }] =
    await Promise.all([
      supabase.from("knowledge_folders").select("*").order("sort_order"),
      supabase.from("knowledge_docs").select("*").order("sort_order"),
    ]);
  if (fErr) throw new Error(fErr.message);
  if (dErr) throw new Error(dErr.message);
  return {
    folders: (folders ?? []).filter((f) => f.section === BRAIN_SECTION),
    docs: (docs ?? []).filter((d) => d.section === BRAIN_SECTION),
  };
}

const wordCount = (t) => (t && t.trim() ? t.trim().split(/\s+/).length : 0);

server.registerTool(
  "brain",
  {
    description:
      "BRAIN: la fuente única de contexto de Andrés (documentos markdown en " +
      "carpetas: quién es, su negocio AG, clientes, procesos, reglas para " +
      "agentes). LÉELO ANTES DE TRABAJAR en vez de preguntarle lo que ya está " +
      "escrito. Sin argumentos devuelve el índice (barato); luego pide solo lo " +
      "que necesites: doc (título exacto o parcial), folder (carpeta completa), " +
      "search (texto en títulos y contenido) o full:true (todo, úsalo poco).",
    inputSchema: z.object({
      doc: z.string().optional().describe("Título exacto o parcial de un documento"),
      folder: z.string().optional().describe("Nombre de carpeta: devuelve todos sus documentos completos"),
      search: z.string().optional().describe("Busca en títulos y contenido; devuelve coincidencias con un fragmento"),
      full: z.boolean().optional().describe("Devuelve TODO BRAIN completo"),
    }),
  },
  tool(async ({ doc, folder, search, full }) => {
    const { supabase } = await getSession();
    const { folders, docs } = await loadBrain(supabase);
    const folderName = new Map(folders.map((f) => [f.id, f.name]));
    const asDoc = (d) => ({
      titulo: d.title,
      carpeta: d.folder_id ? folderName.get(d.folder_id) ?? "?" : "Sin carpeta",
      contenido: d.content,
      actualizado: d.updated_at,
    });

    if (folders.length === 0 && docs.length === 0) {
      return ok("BRAIN está vacío. Pídele a Andrés que lo llene desde la página BRAIN de NEXUS, o propón crear documentos con brain_write.");
    }

    if (doc) {
      const needle = doc.toLowerCase();
      const exact = docs.filter((d) => d.title.toLowerCase() === needle);
      const found = exact.length ? exact : docs.filter((d) => d.title.toLowerCase().includes(needle));
      if (!found.length) {
        throw new Error(`No hay documento que coincida con "${doc}". Títulos: ${docs.map((d) => d.title).join(", ")}`);
      }
      return ok(found.map(asDoc));
    }

    if (folder) {
      const match = folders.find((f) => f.name.toLowerCase() === folder.toLowerCase()) ??
        folders.find((f) => f.name.toLowerCase().includes(folder.toLowerCase()));
      if (!match) {
        throw new Error(`No existe la carpeta "${folder}". Carpetas: ${folders.map((f) => f.name).join(", ")}`);
      }
      return ok(docs.filter((d) => d.folder_id === match.id).map(asDoc));
    }

    if (search) {
      const needle = search.toLowerCase();
      const hits = docs
        .filter((d) => d.title.toLowerCase().includes(needle) || (d.content ?? "").toLowerCase().includes(needle))
        .map((d) => {
          const flat = (d.content ?? "").replace(/\s+/g, " ");
          const at = flat.toLowerCase().indexOf(needle);
          const fragment = at === -1 ? flat.slice(0, 160) : flat.slice(Math.max(0, at - 80), at + needle.length + 80);
          return {
            titulo: d.title,
            carpeta: d.folder_id ? folderName.get(d.folder_id) ?? "?" : "Sin carpeta",
            fragmento: fragment,
          };
        });
      return ok({ busqueda: search, resultados: hits, nota: hits.length ? 'Abre el que necesites con doc: "<título>".' : "Sin coincidencias." });
    }

    if (full) return ok(docs.map(asDoc));

    // Index only, so the first call stays cheap
    const index = (fid) =>
      docs
        .filter((d) => (d.folder_id ?? null) === fid)
        .map((d) => ({ titulo: d.title, palabras: wordCount(d.content), actualizado: d.updated_at }));
    return ok({
      carpetas: folders.map((f) => ({ carpeta: f.name, documentos: index(f.id) })),
      ...(docs.some((d) => !d.folder_id) ? { sin_carpeta: index(null) } : {}),
      nota: 'Pide el contenido con doc: "<título>", folder: "<carpeta>" o search: "<texto>".',
    });
  })
);

server.registerTool(
  "brain_write",
  {
    description:
      "Crea o actualiza un documento de BRAIN. Si ya existe un documento con " +
      "ese título lo sobrescribe (o le agrega al final con append); si no, lo " +
      "crea en la carpeta indicada, creando la carpeta si hace falta. Úsalo " +
      "solo para contexto duradero y dile a Andrés qué guardaste.",
    inputSchema: z.object({
      title: z.string(),
      content: z.string().describe("Contenido en markdown"),
      folder: z.string().optional().describe("Carpeta destino por nombre"),
      append: z.boolean().optional().describe("Agrega al final en vez de sobrescribir"),
    }),
  },
  tool(async ({ title, content, folder, append }) => {
    const { supabase, userId } = await getSession();
    const { folders, docs } = await loadBrain(supabase);

    const existing = docs.find((d) => d.title.toLowerCase() === title.toLowerCase());
    if (existing) {
      const next = append ? `${existing.content}\n\n${content}`.trim() : content;
      const { error } = await supabase
        .from("knowledge_docs")
        .update({ content: next, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return ok(`Documento de BRAIN "${existing.title}" ${append ? "ampliado" : "actualizado"}.`);
    }

    let folderId = null;
    if (folder) {
      const match = folders.find((f) => f.name.toLowerCase() === folder.toLowerCase());
      if (match) {
        folderId = match.id;
      } else {
        const { data, error } = await supabase
          .from("knowledge_folders")
          .insert({
            user_id: userId,
            name: folder,
            color: "#8b5cf6",
            sort_order: folders.length,
            section: BRAIN_SECTION,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        folderId = data.id;
      }
    }

    const { error } = await supabase.from("knowledge_docs").insert({
      user_id: userId,
      folder_id: folderId,
      title,
      content,
      sort_order: docs.filter((d) => d.folder_id === folderId).length,
      section: BRAIN_SECTION,
    });
    if (error) throw new Error(error.message);
    return ok(`Documento de BRAIN "${title}" creado${folder ? ` en ${folder}` : ""}.`);
  })
);

// ============================================
// PIPELINE — client follow-up ("el guardián del pipeline")
// Stages have a rule (max days without movement) and a follow-up template;
// the guardian flags deals past their rule. Agents review and edit deals
// here, and every change is logged in pipeline_activity with actor 'agent'.
// Agents NEVER send messages: they propose (suggested_message) and Andrés
// approves and sends.
// ============================================

const DAY_MS = 86400000;
const daysSinceIso = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS));

function dealHealth(deal, stage) {
  if (!stage || deal.status !== "open") return "a tiempo";
  const days = daysSinceIso(deal.last_activity_at);
  if (days > stage.max_days) return "necesita atención";
  if (days >= Math.max(1, stage.max_days)) return "vigilar";
  return "a tiempo";
}

function proposedFollowUp(deal, stage) {
  if ((deal.suggested_message ?? "").trim()) return deal.suggested_message;
  const first = (deal.name ?? "").trim().split(/\s+/)[0] ?? "";
  return (stage?.message_template ?? "").replace(/\{nombre\}/gi, first);
}

async function loadPipeline(supabase) {
  const [{ data: stages, error: e1 }, { data: deals, error: e2 }] = await Promise.all([
    supabase.from("pipeline_stages").select("*").order("sort_order"),
    supabase.from("pipeline_deals").select("*").order("sort_order"),
  ]);
  if (e1 || e2) throw new Error((e1 || e2).message);
  return { stages: stages ?? [], deals: deals ?? [] };
}

server.registerTool(
  "pipeline_review",
  {
    description:
      "Revisión del guardián del pipeline de clientes de Andrés (módulo Pipeline de NEXUS). " +
      "Devuelve las etapas con su regla (máximo de días sin movimiento) y cada oportunidad abierta " +
      "con días sin movimiento, estado (a tiempo / vigilar / necesita atención), cuántos días se pasó " +
      "y el mensaje de seguimiento propuesto. Úsalo antes de pipeline_update. Nunca envíes mensajes " +
      "a clientes: propón el texto y Andrés decide.",
    inputSchema: z.object({
      include_closed: z.boolean().optional().describe("Incluir oportunidades ganadas/perdidas"),
    }),
  },
  tool(async ({ include_closed }) => {
    const { supabase } = await getSession();
    const { stages, deals } = await loadPipeline(supabase);
    const stageById = new Map(stages.map((s) => [s.id, s]));
    const rows = deals
      .filter((d) => include_closed || d.status === "open")
      .map((d) => {
        const st = stageById.get(d.stage_id);
        const days = daysSinceIso(d.last_activity_at);
        return {
          id: d.id,
          cliente: d.name,
          empresa: d.company || null,
          contacto: d.contact || null,
          canal: d.channel,
          etapa: st?.name ?? null,
          estado: d.status === "open" ? dealHealth(d, st) : d.status === "won" ? "ganada" : "perdida",
          dias_sin_movimiento: days,
          se_paso_por: st ? Math.max(0, days - st.max_days) : 0,
          ultima_novedad: d.note || null,
          valor: d.value === null ? null : `${d.value} ${d.currency}`,
          mensaje_propuesto: d.status === "open" ? proposedFollowUp(d, st) : null,
        };
      })
      .sort((a, b) => b.se_paso_por - a.se_paso_por);
    return ok({
      etapas: stages.map((s) => ({ etapa: s.name, maximo_dias: s.max_days, regla: s.rule })),
      resumen: {
        necesita_atencion: rows.filter((r) => r.estado === "necesita atención").length,
        vigilar: rows.filter((r) => r.estado === "vigilar").length,
        abiertas: deals.filter((d) => d.status === "open").length,
      },
      oportunidades: rows,
    });
  })
);

server.registerTool(
  "pipeline_update",
  {
    description:
      "Crea o modifica una oportunidad del pipeline de clientes. Identifícala con deal_id o por nombre " +
      "(name, exacto o parcial). Con create:true la crea si no existe. Puedes cambiar la etapa (por nombre), " +
      "la nota de lo último que pasó, contacto, canal, valor, el mensaje de seguimiento sugerido, marcarla " +
      "ganada/perdida, o reiniciar el reloj (touched:true) cuando hubo movimiento real con el cliente. " +
      "Todo queda en el historial como hecho por un agente. NO envía mensajes.",
    inputSchema: z.object({
      deal_id: z.string().optional(),
      name: z.string().optional().describe("Nombre del cliente; para buscar o para crear"),
      create: z.boolean().optional().describe("Crear la oportunidad si no existe"),
      stage: z.string().optional().describe("Nombre de la etapa destino"),
      note: z.string().optional().describe("Lo último que pasó, ej. 'Pidió la propuesta'"),
      company: z.string().optional(),
      contact: z.string().optional().describe("Teléfono, email o @usuario"),
      channel: z.enum(["whatsapp", "email", "instagram", "linkedin", "llamada", "otro"]).optional(),
      value: z.number().optional(),
      currency: z.string().optional(),
      suggested_message: z.string().optional().describe("Mensaje de seguimiento propuesto (Andrés decide si lo envía)"),
      touched: z.boolean().optional().describe("Hubo movimiento real hoy: reinicia el contador de días"),
      status: z.enum(["open", "won", "lost"]).optional(),
      log: z.string().optional().describe("Nota extra para el historial"),
      source: z.enum(["tiktok", "instagram", "referido", "web", "otro"]).optional().describe("De dónde vino el lead"),
      source_idea: z.string().optional().describe("Título de la pieza de contenido que trajo el lead"),
    }),
  },
  tool(async (args) => {
    const { supabase, userId } = await getSession();
    const { stages, deals } = await loadPipeline(supabase);
    const stageByName = (n) =>
      stages.find((s) => s.name.toLowerCase() === n.toLowerCase()) ??
      stages.find((s) => s.name.toLowerCase().includes(n.toLowerCase()));

    let deal = args.deal_id ? deals.find((d) => d.id === args.deal_id) : null;
    if (!deal && args.name) {
      const needle = args.name.toLowerCase();
      const exact = deals.filter((d) => d.name.toLowerCase() === needle);
      const partial = deals.filter((d) => d.name.toLowerCase().includes(needle));
      const found = exact.length ? exact : partial;
      if (found.length > 1) {
        return fail(`"${args.name}" coincide con varias: ${found.map((d) => `${d.name} (${d.id})`).join(", ")}. Usa deal_id.`);
      }
      deal = found[0] ?? null;
    }

    let stageId;
    if (args.stage) {
      const st = stageByName(args.stage);
      if (!st) return fail(`No existe la etapa "${args.stage}". Etapas: ${stages.map((s) => s.name).join(", ")}`);
      stageId = st.id;
    }

    const fields = {};
    for (const k of ["note", "company", "contact", "channel", "value", "currency", "suggested_message", "status", "source"]) {
      if (args[k] !== undefined) fields[k] = args[k];
    }
    if (args.source_idea) {
      const { data: ideaRows, error: ie } = await supabase.from("content_ideas").select("id,title");
      if (ie) throw new Error(ie.message);
      const needle = args.source_idea.toLowerCase();
      const exact = ideaRows.filter((i) => i.title.toLowerCase() === needle);
      const hits = exact.length ? exact : ideaRows.filter((i) => i.title.toLowerCase().includes(needle));
      if (hits.length !== 1) {
        return fail(hits.length ? `"${args.source_idea}" coincide con varias piezas: ${hits.map((i) => i.title).join(" | ")}` : `No encontré la pieza "${args.source_idea}".`);
      }
      fields.source_idea_id = hits[0].id;
    }
    if (stageId) fields.stage_id = stageId;
    const now = new Date().toISOString();
    // Moving to another stage or a real touch restarts the clock
    if (args.touched || (stageId && deal && stageId !== deal.stage_id)) fields.last_activity_at = now;

    const changes = [];
    if (!deal) {
      if (!args.create || !args.name) {
        return fail(`No encontré la oportunidad${args.name ? ` "${args.name}"` : ""}. Usa create:true con name para crearla.`);
      }
      const sid = stageId ?? stages[0]?.id ?? null;
      const { data, error } = await supabase
        .from("pipeline_deals")
        .insert({
          user_id: userId,
          name: args.name,
          ...fields,
          stage_id: sid,
          last_activity_at: fields.last_activity_at ?? now,
          sort_order: deals.filter((d) => d.stage_id === sid).length,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      deal = data;
      changes.push(`Creada en ${stages.find((s) => s.id === sid)?.name ?? "—"}`);
    } else if (Object.keys(fields).length) {
      const { data, error } = await supabase
        .from("pipeline_deals")
        .update({ ...fields, updated_at: now })
        .eq("id", deal.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      if (fields.stage_id && fields.stage_id !== deal.stage_id) {
        changes.push(`${stages.find((s) => s.id === deal.stage_id)?.name ?? "—"} → ${stages.find((s) => s.id === fields.stage_id)?.name}`);
      }
      if (fields.note) changes.push(fields.note);
      if (fields.suggested_message) changes.push("Propuso un mensaje de seguimiento");
      if (fields.status) changes.push(fields.status === "won" ? "Ganada" : fields.status === "lost" ? "Perdida" : "Reabierta");
      if (args.touched) changes.push("Hubo movimiento: reloj reiniciado");
      if (fields.source || fields.source_idea_id) changes.push(`Origen: ${fields.source ?? ""}${fields.source_idea_id ? ` · pieza ${args.source_idea}` : ""}`);
      const rest = Object.keys(fields).filter((k) => !["stage_id", "note", "suggested_message", "status", "last_activity_at", "source", "source_idea_id"].includes(k));
      if (rest.length) changes.push(`Editó: ${rest.join(", ")}`);
      deal = data;
    }
    if (args.log) changes.push(args.log);

    if (changes.length) {
      const { error } = await supabase.from("pipeline_activity").insert({
        user_id: userId,
        deal_id: deal.id,
        kind: "agent",
        body: changes.join(" · "),
        actor: "agent",
      });
      if (error) throw new Error(error.message);
    }
    const st = stages.find((s) => s.id === deal.stage_id);
    return ok({
      id: deal.id,
      cliente: deal.name,
      etapa: st?.name ?? null,
      estado: deal.status === "open" ? dealHealth(deal, st) : deal.status,
      cambios: changes.length ? changes : ["sin cambios"],
    });
  })
);

// ============================================
// TAREAS PARA EL ASISTENTE (BLOQUE 31)
// Andrés las deja en la pestaña "Tareas" del dashboard; el asistente las
// lee, avanza y deja su reporte. Todo lo que toca el asistente queda con
// updated_by = "agent", así Andrés ve qué movió.
// ============================================

const TASK_STATUSES = ["pendiente", "en_curso", "bloqueada", "hecha"];
const TASK_PRIORITY_RANK = { alta: 0, media: 1, baja: 2 };
const taskToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(new Date());

function taskView(t, today) {
  return {
    id: t.id,
    tarea: t.title,
    detalles: t.details || null,
    estado: t.status,
    prioridad: t.priority,
    fecha_limite: t.due_date,
    vencida: t.status !== "hecha" && !!t.due_date && t.due_date < today,
    reporte: t.result || null,
    ultimo_en_tocarla: t.updated_by === "agent" ? "asistente" : "andres",
    hecha_el: t.completed_at,
  };
}

server.registerTool(
  "tasks_list",
  {
    description:
      "Tareas que Andrés le dejó al asistente (pestaña Tareas del dashboard de NEXUS). Por defecto devuelve " +
      "las abiertas (pendiente, en_curso, bloqueada) ordenadas por prioridad y fecha límite. Úsalo cuando " +
      "Andrés pida 'revisa mis tareas', 'qué tengo pendiente' o 'haz las tareas'. Después de trabajar en una, " +
      "repórtalo con task_update.",
    inputSchema: z.object({
      status: z
        .enum(["abiertas", "todas", ...TASK_STATUSES])
        .optional()
        .describe("Filtro: abiertas (por defecto), todas, o un estado concreto"),
    }),
  },
  tool(async ({ status = "abiertas" }) => {
    const { supabase } = await getSession();
    const { data, error } = await supabase.from("assistant_tasks").select("*");
    if (error) throw new Error(error.message);
    const all = data ?? [];
    const today = taskToday();
    const rows = all
      .filter((t) =>
        status === "todas" ? true : status === "abiertas" ? t.status !== "hecha" : t.status === status
      )
      .sort(
        (a, b) =>
          Number(a.status === "hecha") - Number(b.status === "hecha") ||
          (TASK_PRIORITY_RANK[a.priority] ?? 1) - (TASK_PRIORITY_RANK[b.priority] ?? 1) ||
          (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
          a.sort_order - b.sort_order
      );
    const open = all.filter((t) => t.status !== "hecha");
    return ok({
      resumen: {
        abiertas: open.length,
        vencidas: open.filter((t) => t.due_date && t.due_date < today).length,
        bloqueadas: open.filter((t) => t.status === "bloqueada").length,
        hechas: all.length - open.length,
      },
      tareas: rows.map((t) => taskView(t, today)),
    });
  })
);

server.registerTool(
  "task_update",
  {
    description:
      "Actualiza o crea una tarea de la pestaña Tareas. Identifícala con task_id o por título (title, exacto " +
      "o parcial). Con create:true la crea si no existe (solo si Andrés te pide anotar una tarea). Cambia el " +
      "estado (pendiente | en_curso | bloqueada | hecha) y deja en result lo que hiciste, lo que encontraste o " +
      "por qué está bloqueada: Andrés lo lee en la tarjeta. Marca 'hecha' solo si de verdad la terminaste.",
    inputSchema: z.object({
      task_id: z.string().optional(),
      title: z.string().optional().describe("Título de la tarea; para buscarla o para crearla"),
      create: z.boolean().optional().describe("Crear la tarea si no existe"),
      status: z.enum(TASK_STATUSES).optional(),
      result: z.string().optional().describe("Reporte para Andrés: qué hiciste, resultado, o qué falta"),
      append: z.boolean().optional().describe("Agregar result debajo del reporte anterior en vez de reemplazarlo"),
      details: z.string().optional().describe("Qué hay que hacer"),
      priority: z.enum(["alta", "media", "baja"]).optional(),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe("YYYY-MM-DD o null"),
    }),
  },
  tool(async (args) => {
    const { supabase, userId } = await getSession();
    const { data: all, error: le } = await supabase.from("assistant_tasks").select("*");
    if (le) throw new Error(le.message);
    const tasks = all ?? [];

    let task = args.task_id ? tasks.find((t) => t.id === args.task_id) : null;
    if (!task && args.title) {
      const needle = args.title.toLowerCase();
      const exact = tasks.filter((t) => t.title.toLowerCase() === needle);
      const found = exact.length ? exact : tasks.filter((t) => t.title.toLowerCase().includes(needle));
      if (found.length > 1) {
        return fail(`"${args.title}" coincide con varias: ${found.map((t) => `${t.title} (${t.id})`).join(", ")}. Usa task_id.`);
      }
      task = found[0] ?? null;
    }

    const now = new Date().toISOString();
    const today = taskToday();

    if (!task) {
      if (!args.create || !args.title) {
        return fail(`No encontré la tarea${args.title ? ` "${args.title}"` : ""}. Usa create:true con title para crearla.`);
      }
      const status = args.status ?? "pendiente";
      const { data, error } = await supabase
        .from("assistant_tasks")
        .insert({
          user_id: userId,
          title: args.title,
          details: args.details ?? "",
          priority: args.priority ?? "media",
          due_date: args.due_date ?? null,
          status,
          result: args.result ?? "",
          updated_by: "agent",
          sort_order: tasks.reduce((m, t) => Math.max(m, t.sort_order), 0) + 1,
          completed_at: status === "hecha" ? now : null,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return ok({ creada: true, ...taskView(data, today) });
    }

    const fields = { updated_by: "agent", updated_at: now };
    if (args.status) {
      fields.status = args.status;
      fields.completed_at = args.status === "hecha" ? now : null;
    }
    if (args.result !== undefined) {
      fields.result = args.append && task.result ? `${task.result}\n\n${args.result}` : args.result;
    }
    for (const k of ["details", "priority", "due_date"]) {
      if (args[k] !== undefined) fields[k] = args[k];
    }
    const { data, error } = await supabase
      .from("assistant_tasks")
      .update(fields)
      .eq("id", task.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return ok({ actualizada: true, ...taskView(data, today) });
  })
);

// ============================================
// CONTENT ANALYTICS (BLOQUE 27)
// Account numbers per day and platform, dated snapshots per publication,
// and "most active times". Every metric is optional: what isn't passed is
// left as is / null ("sin datos"), never written as 0. Meant for loading
// numbers from TikTok / Instagram Analytics screenshots.
// ============================================

const STATS_NETWORKS = ["tiktok", "instagram"];
const ACCOUNT_KEYS = ["views", "unique_viewers", "new_viewers", "profile_views", "followers_gained", "followers_total", "likes", "comments", "shares", "saves"];
const POST_KEYS = ["views", "likes", "comments", "shares", "saves", "avg_watch_seconds", "full_watch_pct", "profile_views", "follows"];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const optInt = () => z.number().int().nullable().optional();
const optNum = () => z.number().nullable().optional();

const pickDefined = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

server.registerTool(
  "log_account_metrics",
  {
    description:
      "Registra métricas de la CUENTA por día (TikTok o Instagram), por ejemplo leídas de una captura de " +
      "Analytics → Overview. Un día ya cargado se actualiza (solo los campos que pases). No inventes: si la " +
      "captura no muestra un dato, no lo mandes. followers_gained es el neto del día.",
    inputSchema: z.object({
      platform: z.enum(["tiktok", "instagram"]),
      days: z
        .array(
          z.object({
            date: z.string().regex(DAY_RE).describe("YYYY-MM-DD"),
            views: optInt(),
            unique_viewers: optInt(),
            new_viewers: optInt(),
            profile_views: optInt(),
            followers_gained: optInt(),
            followers_total: optInt(),
            likes: optInt(),
            comments: optInt(),
            shares: optInt(),
            saves: optInt(),
          })
        )
        .min(1),
    }),
  },
  tool(async ({ platform, days }) => {
    const { supabase, userId } = await getSession();
    const saved = [];
    for (const d of days) {
      const fields = pickDefined(d, ACCOUNT_KEYS);
      if (!Object.keys(fields).length) continue;
      const { error } = await supabase.from("content_account_daily").upsert(
        { user_id: userId, platform, day: d.date, ...fields, source: "mcp", updated_at: new Date().toISOString() },
        { onConflict: "user_id,platform,day" }
      );
      if (error) throw new Error(`${d.date}: ${error.message}`);
      saved.push(`${d.date} (${Object.keys(fields).join(", ")})`);
    }
    return ok({ plataforma: platform, dias_guardados: saved });
  })
);

server.registerTool(
  "log_post_metrics",
  {
    description:
      "Guarda la foto del día de las métricas de UNA publicación (TikTok o Instagram). Identifícala con " +
      "publication_id, o con el título de la pieza (idea, exacto o parcial) + platform. Si la pieza no tiene " +
      "publicación en esa red, la crea (published_on, o hoy). Los campos que no pases se copian de la foto " +
      "anterior; no inventes datos que la captura no muestre.",
    inputSchema: z.object({
      publication_id: z.string().optional(),
      idea: z.string().optional().describe("Título de la pieza en NEXUS"),
      platform: z.enum(["tiktok", "instagram"]).optional(),
      published_on: z.string().regex(DAY_RE).optional().describe("Fecha de publicación si hay que crearla"),
      url: z.string().optional(),
      captured_on: z.string().regex(DAY_RE).optional().describe("Fecha de la foto (por defecto hoy)"),
      views: optInt(),
      likes: optInt(),
      comments: optInt(),
      shares: optInt(),
      saves: optInt(),
      avg_watch_seconds: optNum(),
      full_watch_pct: optNum(),
      profile_views: optInt(),
      follows: optInt(),
    }),
  },
  tool(async (args) => {
    const { supabase, userId } = await getSession();
    const capturedOn = args.captured_on ?? caracasToday().date;
    let pub = null;
    if (args.publication_id) {
      const { data, error } = await supabase.from("content_publications").select("*").eq("id", args.publication_id).maybeSingle();
      if (error) throw new Error(error.message);
      pub = data;
      if (!pub) return fail(`No existe la publicación ${args.publication_id}.`);
    } else {
      if (!args.idea || !args.platform) return fail("Pasa publication_id, o idea + platform.");
      const { data: ideas, error } = await supabase.from("content_ideas").select("id,title");
      if (error) throw new Error(error.message);
      const needle = args.idea.toLowerCase();
      const exact = ideas.filter((i) => i.title.toLowerCase() === needle);
      const found = exact.length ? exact : ideas.filter((i) => i.title.toLowerCase().includes(needle));
      if (found.length !== 1) {
        return fail(
          found.length
            ? `"${args.idea}" coincide con varias piezas: ${found.map((i) => i.title).join(" | ")}`
            : `No encontré la pieza "${args.idea}".`
        );
      }
      const { data: pubs, error: pe } = await supabase
        .from("content_publications")
        .select("*")
        .eq("idea_id", found[0].id)
        .eq("platform", args.platform)
        .order("published_at", { ascending: false });
      if (pe) throw new Error(pe.message);
      pub = pubs?.[0] ?? null;
      if (!pub) {
        const day = args.published_on ?? capturedOn;
        const { data, error: ie } = await supabase
          .from("content_publications")
          .insert({ user_id: userId, idea_id: found[0].id, platform: args.platform, published_at: new Date(`${day}T12:00:00-04:00`).toISOString(), url: args.url ?? "" })
          .select("*")
          .single();
        if (ie) throw new Error(ie.message);
        pub = data;
      }
    }

    // carry over the previous snapshot's numbers for fields not passed
    const { data: prev } = await supabase
      .from("content_post_metrics")
      .select("*")
      .eq("publication_id", pub.id)
      .lte("captured_on", capturedOn)
      .order("captured_on", { ascending: false })
      .limit(1);
    const carried = prev?.[0] ? Object.fromEntries(POST_KEYS.filter((k) => prev[0][k] !== null).map((k) => [k, prev[0][k]])) : {};
    const fields = pickDefined(args, POST_KEYS);
    if (!Object.keys(fields).length) return fail("No pasaste ninguna métrica.");
    const { error } = await supabase.from("content_post_metrics").upsert(
      { user_id: userId, publication_id: pub.id, captured_on: capturedOn, ...carried, ...fields, source: "mcp", updated_at: new Date().toISOString() },
      { onConflict: "publication_id,captured_on" }
    );
    if (error) throw new Error(error.message);
    return ok({ publicacion: pub.id, plataforma: pub.platform, foto_del: capturedOn, guardado: fields });
  })
);

server.registerTool(
  "log_active_times",
  {
    description:
      "Carga los horarios activos de la audiencia (TikTok Analytics → Followers → Most active times). " +
      "weekday 0 = lunes … 6 = domingo; hour 0–23 en HORA DE CARACAS (convierte si la captura usa otra zona). " +
      "value = lo que muestra la gráfica (seguidores activos). Reemplaza el valor de cada celda que pases.",
    inputSchema: z.object({
      platform: z.enum(["tiktok", "instagram"]),
      entries: z
        .array(z.object({ weekday: z.number().int().min(0).max(6), hour: z.number().int().min(0).max(23), value: z.number() }))
        .min(1),
    }),
  },
  tool(async ({ platform, entries }) => {
    const { supabase, userId } = await getSession();
    const today = caracasToday().date;
    const rows = entries.map((e) => ({ user_id: userId, platform, ...e, captured_on: today, source: "mcp" }));
    const { error } = await supabase.from("content_active_times").upsert(rows, { onConflict: "user_id,platform,weekday,hour" });
    if (error) throw new Error(error.message);
    return ok({ plataforma: platform, celdas: rows.length });
  })
);

// ---------- summary (same rules as the Stats tab: null = sin datos) ----------

const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDaysTo = (s, n) => {
  const [y, m, d] = s.split("-").map(Number);
  return isoDay(new Date(y, m - 1, d + n));
};
// Calendar day of a timestamp in Caracas time
const caracasDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" });
const localOf = (ts) => caracasDay.format(new Date(ts));
const sumN = (vals) => {
  const v = vals.filter((x) => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
};
const avgN = (vals) => {
  const v = vals.filter((x) => typeof x === "number");
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};
const SIN = "sin datos";
const show = (v) => (v === null ? SIN : v);

function periodOf(kind, anchor, to) {
  const [y, m, d] = anchor.split("-").map(Number);
  if (kind === "month") return { from: isoDay(new Date(y, m - 1, 1)), to: isoDay(new Date(y, m, 0)) };
  if (kind === "range") return { from: anchor, to: to && to >= anchor ? to : anchor };
  const dt = new Date(y, m - 1, d);
  const monday = new Date(y, m - 1, d - ((dt.getDay() + 6) % 7));
  return { from: isoDay(monday), to: addDaysTo(isoDay(monday), 6) };
}
function prevPeriodOf(kind, p) {
  if (kind === "month") {
    const [y, m] = p.from.split("-").map(Number);
    return periodOf("month", isoDay(new Date(y, m - 2, 1)));
  }
  const [y1, m1, d1] = p.from.split("-").map(Number);
  const [y2, m2, d2] = p.to.split("-").map(Number);
  const len = Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000) + 1;
  return { from: addDaysTo(p.from, -len), to: addDaysTo(p.from, -1) };
}

server.registerTool(
  "log_period_totals",
  {
    description:
      "Registra el TOTAL de un periodo de la cuenta (TikTok o Instagram) tal como lo muestra la app, por " +
      "ejemplo 'últimos 7 días, del 7 al 13 nov: 5.200 vistas, 115 visitas al perfil'. Se guarda como un " +
      "total del rango, NUNCA repartido en días. Si ese mismo rango ya existe, se actualiza (solo los campos " +
      "que pases). No inventes: si la captura no muestra un dato, no lo mandes. Para datos de un solo día usa " +
      "log_account_metrics.",
    inputSchema: z.object({
      platform: z.enum(["tiktok", "instagram"]),
      from: z.string().regex(DAY_RE).describe("Primer día del rango, YYYY-MM-DD"),
      to: z.string().regex(DAY_RE).describe("Último día del rango, YYYY-MM-DD"),
      views: optInt(),
      unique_viewers: optInt(),
      new_viewers: optInt(),
      profile_views: optInt(),
      followers_gained: optInt(),
      followers_total: optInt(),
      likes: optInt(),
      comments: optInt(),
      shares: optInt(),
      saves: optInt(),
    }),
  },
  tool(async (args) => {
    if (args.to < args.from) return fail("'to' no puede ser antes de 'from'.");
    const { supabase, userId } = await getSession();
    const fields = pickDefined(args, ACCOUNT_KEYS);
    if (!Object.keys(fields).length) return fail("No pasaste ninguna métrica.");
    const { error } = await supabase.from("content_period_totals").upsert(
      {
        user_id: userId,
        platform: args.platform,
        from_day: args.from,
        to_day: args.to,
        ...fields,
        source: "mcp",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform,from_day,to_day" }
    );
    if (error) throw new Error(error.message);
    return ok({ plataforma: args.platform, rango: `${args.from} → ${args.to}`, guardado: fields, nota: "Total del periodo, no se reparte en días." });
  })
);

server.registerTool(
  "get_analytics_summary",
  {
    description:
      "Resumen de estadísticas de contenido (TikTok / Instagram) de un periodo: totales de la cuenta con " +
      "variación contra el periodo anterior y cobertura de días, embudo vistas → perfil → seguidores → leads, " +
      "top 5 por vistas y por conversión, rendimiento por formato y estilo, mejores horarios, leads por pieza " +
      "y qué datos faltan. Si el periodo no tiene datos por día, usa los totales de periodo cargados con " +
      "log_period_totals y lo indica en 'origen' (un total no es una suma de días). Úsalo para analizar qué " +
      "funcionó; si algo dice 'sin datos', no lo inventes.",
    inputSchema: z.object({
      period: z.enum(["week", "month", "range"]).optional().describe("Por defecto la semana actual"),
      date: z.string().regex(DAY_RE).optional().describe("Un día dentro del periodo, o el inicio del rango"),
      to: z.string().regex(DAY_RE).optional().describe("Fin del rango (solo period=range)"),
      platform: z.enum(["both", "tiktok", "instagram"]).optional(),
    }),
  },
  tool(async ({ period = "week", date, to, platform = "both" }) => {
    const { supabase } = await getSession();
    const p = periodOf(period, date ?? caracasToday().date, to);
    const prevP = prevPeriodOf(period, p);
    const okPl = (pl) => platform === "both" || pl === platform;
    const inP = (day, per) => day >= per.from && day <= per.to;

    const [acc, pubs, snaps, times, ideas, cats, leadsRes, periodRes] = await Promise.all([
      soft("content_account_daily", supabase.from("content_account_daily").select("*")),
      soft("content_publications", supabase.from("content_publications").select("*")),
      soft("content_post_metrics", supabase.from("content_post_metrics").select("*")),
      soft("content_active_times", supabase.from("content_active_times").select("*")),
      soft("content_ideas", supabase.from("content_ideas").select("*")),
      soft("content_categories", supabase.from("content_categories").select("id,name")),
      soft("pipeline_deals", supabase.from("pipeline_deals").select("id,name,status,source,source_idea_id,created_at")),
      soft("content_period_totals", supabase.from("content_period_totals").select("*")),
    ]);
    const missingTables = [acc, pubs, snaps, times, leadsRes, periodRes].filter((r) => r.error).map((r) => r.label);
    const leadsAll = leadsRes.error
      ? null
      : leadsRes.data.filter((l) => STATS_NETWORKS.includes(l.source) || l.source_idea_id);

    // Same rule as the Stats tab, per platform and metric: sum the loaded
    // days; if none, the period total for exactly this period; if none, the
    // total that overlaps it the most (with its real dates). Never split.
    const periodRows = periodRes.error ? [] : periodRes.data;
    const plats = platform === "both" ? STATS_NETWORKS : [platform];
    const dayCount = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
    const overlap = (from, to, per) => {
      const a = from > per.from ? from : per.from;
      const b = to < per.to ? to : per.to;
      return a > b ? 0 : dayCount(a, b);
    };
    const totals = (per) => {
      const t = {};
      const origen = {};
      let partial = false;
      for (const k of ACCOUNT_KEYS.filter((x) => x !== "followers_total")) {
        let sum = null;
        const parts = [];
        for (const pl of plats) {
          const days = (acc.data ?? []).filter((r) => r.platform === pl && inP(r.day, per) && typeof r[k] === "number");
          if (days.length) {
            sum = (sum ?? 0) + days.reduce((a, r) => a + r[k], 0);
            parts.push(`${pl}: suma de ${days.length} día(s)`);
            continue;
          }
          const cands = periodRows.filter((r) => r.platform === pl && typeof r[k] === "number" && overlap(r.from_day, r.to_day, per) > 0);
          const best =
            cands.find((r) => r.from_day === per.from && r.to_day === per.to) ??
            cands.sort((a, b) => overlap(b.from_day, b.to_day, per) - overlap(a.from_day, a.to_day, per) || b.to_day.localeCompare(a.to_day))[0];
          if (best) {
            sum = (sum ?? 0) + best[k];
            const out = best.from_day < per.from || best.to_day > per.to;
            if (out) partial = true;
            parts.push(`${pl}: total del periodo ${best.from_day} → ${best.to_day}${out ? " (parcialmente fuera de este periodo)" : ""}, no es suma de días`);
          }
        }
        t[k] = sum;
        if (parts.length) origen[k] = parts.join(" · ");
      }
      t.leads = leadsAll ? leadsAll.filter((l) => inP(localOf(l.created_at), per) && (platform === "both" || l.source === platform)).length : null;
      const rows = (acc.data ?? []).filter((r) => okPl(r.platform) && inP(r.day, per));
      return { t, origen, partial, dias_con_datos: new Set(rows.map((r) => r.day)).size };
    };
    const now = totals(p);
    const before = totals(prevP);
    const variacion = Object.fromEntries(
      Object.keys(now.t).map((k) => {
        const a = now.t[k];
        const b = before.t[k];
        // a total that spills over both periods would be compared with itself
        if ((now.partial || before.partial) && k !== "leads") return [k, "no comparable (total de periodo parcial)"];
        return [k, a === null || b === null || b === 0 ? SIN : `${a >= b ? "+" : ""}${Math.round(((a - b) / Math.abs(b)) * 100)}%`];
      })
    );

    // Followers: latest total known up to the end of the period, per platform
    let seguidores = null;
    const seguidoresAl = [];
    for (const pl of plats) {
      const pts = [
        ...(acc.data ?? []).filter((r) => r.platform === pl && typeof r.followers_total === "number" && r.day <= p.to).map((r) => [r.day, r.followers_total]),
        ...periodRows.filter((r) => r.platform === pl && typeof r.followers_total === "number" && r.to_day <= p.to).map((r) => [r.to_day, r.followers_total]),
      ].sort((a, b) => b[0].localeCompare(a[0]));
      if (pts[0]) {
        seguidores = (seguidores ?? 0) + pts[0][1];
        seguidoresAl.push(`${pl} al ${pts[0][0]}: ${pts[0][1]}`);
      }
    }

    const steps = [["vistas", now.t.views], ["visitas_perfil", now.t.profile_views], ["seguidores", now.t.followers_gained], ["leads", now.t.leads]];
    const embudo = [];
    for (const [i, [k, v]] of steps.entries()) {
      if (v === null) break;
      const prevV = i ? steps[i - 1][1] : null;
      embudo.push({ paso: k, valor: v, del_paso_anterior: prevV ? `${((v / prevV) * 100).toFixed(1)}%` : null });
    }

    // pieces posted in the period (latest snapshot per publication)
    const latest = (pubId) =>
      (snaps.data ?? []).filter((s) => s.publication_id === pubId).sort((a, b) => b.captured_on.localeCompare(a.captured_on))[0] ?? null;
    const byIdea = new Map();
    for (const pub of pubs.data ?? []) {
      if (!okPl(pub.platform) || !inP(localOf(pub.published_at), p)) continue;
      byIdea.set(pub.idea_id, [...(byIdea.get(pub.idea_id) ?? []), pub]);
    }
    const catName = new Map((cats.data ?? []).map((c) => [c.id, c.name]));
    const pieces = [...byIdea.entries()].map(([ideaId, list]) => {
      const idea = (ideas.data ?? []).find((i) => i.id === ideaId) ?? {};
      const ss = list.map((x) => latest(x.id)).filter(Boolean);
      const views = sumN(ss.map((s) => s.views));
      const follows = sumN(ss.map((s) => s.follows));
      const pv = sumN(ss.map((s) => s.profile_views));
      const leads = leadsAll ? leadsAll.filter((l) => l.source_idea_id === ideaId).length : 0;
      let conv = null;
      let base = null;
      if (views) {
        if (follows !== null || leads) {
          conv = +((((follows ?? 0) + leads) / views) * 1000).toFixed(2);
          base = "seguidores+leads por 1000 vistas";
        } else if (pv !== null) {
          conv = +((pv / views) * 1000).toFixed(2);
          base = "visitas al perfil por 1000 vistas";
        }
      }
      return {
        pieza: idea.title ?? "?",
        formato: idea.format || SIN,
        estilo: idea.style || SIN,
        categoria: catName.get(idea.category_id) ?? null,
        publicada: list.map((x) => localOf(x.published_at)).sort()[0],
        redes: [...new Set(list.map((x) => x.platform))],
        vistas: views,
        comentarios: sumN(ss.map((s) => s.comments)),
        compartidos: sumN(ss.map((s) => s.shares)),
        guardados: sumN(ss.map((s) => s.saves)),
        leads,
        conversion: conv,
        base_conversion: base,
      };
    });
    const group = (key) => {
      const g = {};
      for (const x of pieces) (g[x[key]] ??= []).push(x);
      return Object.fromEntries(
        Object.entries(g).map(([k, list]) => [k, { piezas: list.length, vistas_prom: show(avgN(list.map((x) => x.vistas))), comentarios_prom: show(avgN(list.map((x) => x.comentarios))), compartidos_prom: show(avgN(list.map((x) => x.compartidos))) }])
      );
    };
    const DAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
    const cells = {};
    for (const r of (times.data ?? []).filter((x) => okPl(x.platform))) cells[`${r.weekday}-${r.hour}`] = (cells[`${r.weekday}-${r.hour}`] ?? 0) + Number(r.value);
    const horarios = Object.entries(cells)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => {
        const [wd, h] = k.split("-").map(Number);
        return `${DAYS[wd]} ${h}:00 (${v})`;
      });

    const faltan = [];
    if (missingTables.length) faltan.push(`Tablas sin crear: ${missingTables.join(", ")} (correr PENDIENTE.sql)`);
    const totalDays = Math.round((new Date(p.to) - new Date(p.from)) / 86400000) + 1;
    if (now.dias_con_datos < totalDays) faltan.push(`Métricas de cuenta: ${now.dias_con_datos} de ${totalDays} días cargados`);
    if (!pieces.some((x) => x.vistas !== null)) faltan.push("Ninguna pieza publicada en el periodo tiene métricas");
    if (!horarios.length) faltan.push("No hay horarios activos cargados");

    return ok({
      periodo: p,
      periodo_anterior: prevP,
      plataforma: platform,
      totales: Object.fromEntries(Object.entries(now.t).map(([k, v]) => [k, show(v)])),
      origen: Object.keys(now.origen).length ? now.origen : SIN,
      seguidores_totales: seguidores === null ? SIN : { total: seguidores, detalle: seguidoresAl },
      variacion_vs_anterior: variacion,
      cobertura: `${now.dias_con_datos} de ${totalDays} días con métricas de cuenta`,
      embudo: embudo.length ? embudo : SIN,
      top_vistas: pieces.filter((x) => x.vistas !== null).sort((a, b) => b.vistas - a.vistas).slice(0, 5),
      top_conversion: pieces.filter((x) => x.conversion !== null).sort((a, b) => b.conversion - a.conversion).slice(0, 5),
      por_formato: group("formato"),
      por_estilo: group("estilo"),
      mejores_horarios: horarios.length ? horarios : SIN,
      leads_por_pieza: pieces.filter((x) => x.leads > 0).map((x) => ({ pieza: x.pieza, leads: x.leads })),
      faltan,
    });
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
  "file_attachment",
  {
    description:
      "Archiva una imagen que llegó adjunta al chat en el módulo que " +
      "corresponda de NEXUS. Usala cuando te manden una foto: mirá qué es " +
      "con la herramienta Read y después archivala acá con una descripción " +
      "útil. El chat_path te lo da el mensaje.",
    inputSchema: z.object({
      chat_path: z
        .string()
        .describe("Ruta del adjunto en el bucket chat-files, como te la pasaron"),
      destination: z
        .enum(["medical_exam", "brain"])
        .describe(
          "medical_exam: examen o estudio médico. brain: documento de contexto en BRAIN"
        ),
      description: z
        .string()
        .describe("Qué es, en una línea, por ejemplo 'Hematología completa - Lab XYZ'"),
      date: z
        .string()
        .optional()
        .describe("Fecha del documento, YYYY-MM-DD, si se puede leer en la imagen"),
      brain_doc: z
        .string()
        .optional()
        .describe("Solo para brain: título del documento de BRAIN al que se agrega"),
    }),
  },
  tool(async ({ chat_path, destination, description, date, brain_doc }) => {
    const { supabase, userId } = await getSession();

    // Pull the bytes out of the private chat bucket
    const { data: blob, error: dlErr } = await supabase.storage
      .from("chat-files")
      .download(chat_path);
    if (dlErr) throw new Error(`No pude leer el adjunto: ${dlErr.message}`);
    const bytes = Buffer.from(await blob.arrayBuffer());
    const fileName = chat_path.split("/").pop() || "adjunto";

    if (destination === "medical_exam") {
      // medical-files is private and policies key off the user-id folder
      const filePath = `${userId}/exams/${Date.now()}-${fileName}`;
      const { error: upErr } = await supabase.storage
        .from("medical-files")
        .upload(filePath, bytes, { contentType: blob.type || "image/jpeg" });
      if (upErr) throw new Error(`No pude guardar el archivo: ${upErr.message}`);

      const { count } = await supabase
        .from("medical_exams")
        .select("id", { count: "exact", head: true });

      const { error } = await supabase.from("medical_exams").insert({
        user_id: userId,
        description,
        exam_date: date ?? null,
        file_name: fileName,
        file_path: filePath,
        sort_order: count ?? 0,
      });
      if (error) throw new Error(error.message);
      return ok(
        `Archivado en Medical > Exams: "${description}"${date ? ` (${date})` : ""}.`
      );
    }

    // brain: the bucket is public, so the URL can go straight in the markdown
    const filePath = `${userId}/${Date.now()}-${fileName}`;
    const { error: upErr } = await supabase.storage
      .from("grades-files")
      .upload(filePath, bytes, { contentType: blob.type || "image/jpeg" });
    if (upErr) throw new Error(`No pude guardar el archivo: ${upErr.message}`);
    const url = supabase.storage.from("grades-files").getPublicUrl(filePath).data
      .publicUrl;

    const title = brain_doc || description;
    const { data: allDocs } = await supabase
      .from("knowledge_docs")
      .select("id,title,content,section");
    const docs = (allDocs ?? []).filter((x) => x.section === "brain");
    const existing = (docs ?? []).find(
      (d) => d.title.toLowerCase() === title.toLowerCase()
    );
    const block = `

## ${description}${date ? ` (${date})` : ""}

![${description}](${url})
`;

    if (existing) {
      const { error } = await supabase
        .from("knowledge_docs")
        .update({
          content: (existing.content || "") + block,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return ok(`Imagen agregada al documento "${existing.title}" de BRAIN.`);
    }

    const { error } = await supabase.from("knowledge_docs").insert({
      user_id: userId,
      folder_id: null,
      title,
      content: `# ${title}${block}`,
      sort_order: docs.length,
      section: "brain",
    });
    if (error) throw new Error(error.message);
    return ok(`Documento "${title}" creado en BRAIN con la imagen.`);
  })
);

// ============================================
// FINANZAS — INGRESOS Y GASTOS
//
// Regla de conversión, una sola para todas las monedas:
//   rate_per_usd = cuántas unidades de esa moneda equivalen a 1 USD BCV
//   amount_usd   = amount / rate_per_usd
// El equivalente se guarda con la transacción: la tasa de hoy no cambia
// lo que se gastó hace un mes.
// ============================================

// Tasas del día desde DolarAPI (https://ve.dolarapi.com): pública, sin
// llave. Devuelve cuántas unidades de cada moneda son 1 dólar BCV, que es
// como NEXUS guarda las tasas.
async function fetchDolarApi() {
  const [dolares, euro] = await Promise.all([
    fetch("https://ve.dolarapi.com/v1/dolares").then((r) => r.json()),
    fetch("https://ve.dolarapi.com/v1/euros/oficial")
      .then((r) => r.json())
      .catch(() => null),
  ]);

  const pick = (fuente) =>
    (Array.isArray(dolares) ? dolares : []).find((q) => q.fuente === fuente)
      ?.promedio ?? null;

  const bcv = pick("oficial");
  const paralelo = pick("paralelo");
  const bsPorEuro = euro?.promedio ?? null;

  const cash = bcv && paralelo ? bcv / paralelo : null;

  return {
    BCV: bcv,
    // Bs/$ ÷ Bs/€ = euros por dólar, que es como NEXUS guarda las tasas.
    // Al revés daría dólares por euro, que es el número que se suele citar
    // y justo el que NO va acá.
    EUR: bcv && bsPorEuro ? bcv / bsPorEuro : null,
    // Efectivo y USDT se cambian a la tasa paralela, así que valen MÁS que
    // 1 dólar BCV: BCV ÷ paralelo da menos de 1.
    CASH: cash,
    USDT: cash,
  };
}

function monthRange(month) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, "0")}`];
}

server.registerTool(
  "finance_summary",
  {
    description:
      "Ingresos, gastos y balance de un mes, en dólares BCV, con el desglose " +
      "por categoría y los últimos movimientos. Úsalo antes de responder " +
      "cualquier cosa de plata.",
    inputSchema: z.object({
      month: z
        .string()
        .optional()
        .describe("Mes en formato yyyy-mm. Por defecto, el mes actual"),
    }),
  },
  tool(async ({ month }) => {
    const { supabase } = await getSession();
    const target = month || caracasToday().date.slice(0, 7);
    const [from, to] = monthRange(target);

    const [txs, cats, rates] = await Promise.all([
      soft(
        "finance_transactions",
        supabase
          .from("finance_transactions")
          .select("*")
          .gte("occurred_on", from)
          .lte("occurred_on", to)
          .order("occurred_on", { ascending: false })
      ),
      soft("finance_categories", supabase.from("finance_categories").select("*")),
      soft("finance_rates", supabase.from("finance_rates").select("*")),
    ]);

    if (txs.error) throw new Error(txs.error);

    const catName = new Map((cats.data ?? []).map((c) => [c.id, c.name]));
    const rows = (txs.data ?? []).map((t) => ({
      ...t,
      amount: Number(t.amount),
      amount_usd: Number(t.amount_usd),
    }));

    const sum = (kind) =>
      rows.filter((t) => t.kind === kind).reduce((a, t) => a + t.amount_usd, 0);
    const income = sum("income");
    const expense = sum("expense");

    const porCategoria = {};
    for (const t of rows) {
      if (t.kind !== "expense") continue;
      const key = catName.get(t.category_id) ?? "Sin categoría";
      porCategoria[key] = Number(((porCategoria[key] ?? 0) + t.amount_usd).toFixed(2));
    }

    return ok({
      mes: target,
      moneda: "USD BCV",
      ingresos: Number(income.toFixed(2)),
      gastos: Number(expense.toFixed(2)),
      balance: Number((income - expense).toFixed(2)),
      gastos_por_categoria: porCategoria,
      tasas_cargadas: (rates.data ?? []).map((r) => ({
        code: r.code,
        label: r.label,
        por_dolar: r.per_usd === null ? null : Number(r.per_usd),
      })),
      movimientos: rows.slice(0, 25).map((t) => ({
        id: t.id,
        fecha: t.occurred_on,
        tipo: t.kind === "income" ? "ingreso" : "gasto",
        descripcion: t.description || null,
        lugar: t.place || null,
        categoria: catName.get(t.category_id) ?? null,
        monto: `${t.amount} ${t.currency}`,
        forma_de_pago: t.rate_label || "BCV",
        en_dolares_bcv: Number(t.amount_usd.toFixed(2)),
      })),
    });
  })
);

server.registerTool(
  "add_transaction",
  {
    description:
      'Registra un ingreso o un gasto. Ejemplo: "gasté 5$ en el Gama en ' +
      'supermercado" → kind=expense, amount=5, currency=USD, place="El Gama", ' +
      'category="Supermercado". IMPORTANTE: 50$ en efectivo o USDT NO valen ' +
      'lo mismo que 50$ BCV — se cambian a la tasa paralela, que es más ' +
      'alta. Si el mensaje dice "efectivo", "cash" o "USDT", poné ' +
      'rate_code="CASH" o "USDT" aunque currency sea USD. Si no dice nada, ' +
      'currency=USD sin rate_code se trata como dólar BCV (1:1). Si la ' +
      "categoría no existe, se crea.",
    inputSchema: z.object({
      kind: z.enum(["income", "expense"]).describe("income = ingreso, expense = gasto"),
      amount: z.number().positive().describe("Monto en la moneda/forma de pago en que se pagó"),
      currency: z
        .string()
        .optional()
        .describe('Moneda real del monto: "USD" (por defecto), "VES" para bolívares, "EUR"'),
      rate_code: z
        .string()
        .optional()
        .describe(
          'Con qué se pagó, cuando no es dólar BCV 1:1: "BCV" (bolívares, por defecto si currency=VES), ' +
            '"EUR", "CASH" (dólar efectivo) o "USDT". Efectivo y USDT están en dólares pero valen MÁS ' +
            "que el BCV porque se cambian al paralelo — siempre especificalo si el mensaje lo menciona."
        ),
      rate_per_usd: z
        .number()
        .positive()
        .optional()
        .describe("Tasa puntual: cuántas unidades de esa forma de pago son 1 dólar BCV. Pisa a rate_code"),
      category: z.string().optional().describe("Nombre de la categoría, ej. Supermercado"),
      place: z.string().optional().describe("Dónde fue, ej. El Gama"),
      description: z.string().optional().describe("Qué fue"),
      date: z.string().optional().describe("Fecha yyyy-mm-dd. Por defecto hoy"),
      note: z.string().optional(),
    }),
  },
  tool(async (args) => {
    const { supabase, userId } = await getSession();
    const currency = (args.currency || "USD").toUpperCase();

    // --- tasa
    // Hace falta tasa si: la moneda no es dólar, O se especificó una forma
    // de pago (CASH/USDT) aunque el monto esté en dólares — son dólares que
    // valen más que el BCV, no la referencia.
    const needsRate = currency !== "USD" || !!args.rate_code;

    let ratePerUsd = 1;
    let rateLabel = "";
    if (needsRate) {
      if (args.rate_per_usd) {
        ratePerUsd = args.rate_per_usd;
        rateLabel = args.rate_code || "manual";
      } else {
        const code = args.rate_code || (currency === "VES" ? "BCV" : currency);
        const { data: rate } = await supabase
          .from("finance_rates")
          .select("*")
          .eq("code", code)
          .maybeSingle();

        if (rate && rate.per_usd !== null) {
          ratePerUsd = Number(rate.per_usd);
          rateLabel = rate.code;
        } else {
          // Sin tasa guardada, se trae la del día en vez de rechazar el
          // movimiento: Andrés suele decir el monto en bolívares, efectivo
          // o USDT y espera que el cálculo salga solo. Nunca se inventa.
          const live = await fetchDolarApi().catch(() => null);
          const value = live?.[code.toUpperCase()] ?? null;
          if (!value) {
            return fail(
              `No hay tasa cargada para "${code}" y DolarAPI tampoco respondió. Andrés la pone en Finance → Ingresos y gastos → Tasas, o pasame rate_per_usd. No la invento.`
            );
          }
          ratePerUsd = value;
          rateLabel = code.toUpperCase();
          // Y se guarda, para que el próximo movimiento ya la tenga
          if (rate) {
            await supabase
              .from("finance_rates")
              .update({ per_usd: value, updated_at: new Date().toISOString() })
              .eq("id", rate.id);
          } else {
            await supabase.from("finance_rates").insert({
              user_id: userId,
              code: code.toUpperCase(),
              label: code.toUpperCase(),
              currency,
              per_usd: value,
            });
          }
        }
      }
    }

    // --- categoría (se crea si no existe)
    let categoryId = null;
    if (args.category) {
      const wanted = args.category.trim();
      const { data: cats } = await supabase
        .from("finance_categories")
        .select("id,name");
      const found = (cats ?? []).find(
        (c) => c.name.toLowerCase() === wanted.toLowerCase()
      );
      if (found) {
        categoryId = found.id;
      } else {
        const { data: created, error } = await supabase
          .from("finance_categories")
          .insert({
            user_id: userId,
            name: wanted,
            kind: args.kind,
            sort_order: (cats ?? []).length,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        categoryId = created.id;
      }
    }

    const amountUsd = args.amount / ratePerUsd;

    const { error } = await supabase.from("finance_transactions").insert({
      user_id: userId,
      kind: args.kind,
      occurred_on: args.date || caracasToday().date,
      description: args.description || "",
      place: args.place || "",
      category_id: categoryId,
      amount: args.amount,
      currency,
      rate_per_usd: ratePerUsd,
      rate_label: rateLabel,
      amount_usd: amountUsd,
      note: args.note || "",
    });
    if (error) throw new Error(error.message);

    const tipo = args.kind === "income" ? "Ingreso" : "Gasto";
    // Si no hubo conversión (dólar BCV puro), el monto y el equivalente son
    // el mismo número y no hace falta repetirlo.
    const equiv =
      ratePerUsd === 1
        ? `${args.amount}`
        : `${args.amount} ${currency === "USD" ? rateLabel : currency} = ${amountUsd.toFixed(2)} BCV (tasa ${ratePerUsd})`;
    return ok(
      `${tipo} registrado: ${equiv}${args.category ? ` en ${args.category}` : ""}${
        args.place ? `, ${args.place}` : ""
      }.`
    );
  })
);

server.registerTool(
  "refresh_rates",
  {
    description:
      "Trae las tasas del día (BCV y euro) de DolarAPI y las guarda " +
      "en NEXUS. No toca los movimientos ya registrados: cada uno guarda la " +
      "tasa que usó.",
    inputSchema: z.object({}),
  },
  tool(async () => {
    const { supabase, userId } = await getSession();
    const live = await fetchDolarApi();

    const saved = [];
    for (const [code, value] of Object.entries(live)) {
      if (!value) continue;
      const { data: existing } = await supabase
        .from("finance_rates")
        .select("id,label")
        .eq("code", code)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("finance_rates")
          .update({ per_usd: value, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("finance_rates").insert({
          user_id: userId,
          code,
          label: code,
          currency: code === "EUR" ? "EUR" : "VES",
          per_usd: value,
        });
      }
      saved.push(`${code}: ${Number(value).toFixed(4)} por dólar`);
    }

    return ok(
      saved.length
        ? `Tasas actualizadas — ${saved.join(" · ")}`
        : "DolarAPI no devolvió ninguna tasa usable."
    );
  })
);

server.registerTool(
  "set_finance_rate",
  {
    description:
      "Actualiza una tasa de cambio guardada (BCV, PARALELO, EUR). El valor " +
      "es cuántas unidades de esa moneda equivalen a 1 dólar BCV. No cambia " +
      "los movimientos ya registrados.",
    inputSchema: z.object({
      code: z.string().describe('BCV o EUR'),
      per_usd: z.number().positive().describe("Cuántas unidades son 1 dólar BCV"),
    }),
  },
  tool(async ({ code, per_usd }) => {
    const { supabase, userId } = await getSession();
    const { data: existing } = await supabase
      .from("finance_rates")
      .select("id,label")
      .eq("code", code.toUpperCase())
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("finance_rates")
        .update({ per_usd, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return ok(`Tasa ${existing.label || code} actualizada a ${per_usd} por dólar.`);
    }

    const { error } = await supabase.from("finance_rates").insert({
      user_id: userId,
      code: code.toUpperCase(),
      label: code.toUpperCase(),
      currency: code.toUpperCase() === "EUR" ? "EUR" : "VES",
      per_usd,
    });
    if (error) throw new Error(error.message);
    return ok(`Tasa ${code.toUpperCase()} creada en ${per_usd} por dólar.`);
  })
);

// ============================================
// START
// ============================================

// Ver, crear, editar y borrar en cualquier módulo (lo usa también DESJ).
registerCrudTools(server, { getSession, tool, ok });

await serveStdio(() => server);
