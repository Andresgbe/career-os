// Contexto que el worker le pega adelante a cada mensaje del chat.
// Vive aparte de worker.js para poder probarlo solo:  node context.js

// Cuánto de la base de conocimiento se pega antes de recortarla.
const KB_BUDGET = Number(process.env.NEXUS_WORKER_KB_BUDGET || 20000);

function caracasToday() {
  const now = new Date();
  const fmt = (opts) =>
    new Intl.DateTimeFormat(opts.locale ?? "en-CA", {
      timeZone: "America/Caracas",
      ...opts,
    }).format(now);
  const weekday = fmt({ locale: "en-US", weekday: "short" });
  return {
    date: fmt({}),
    dayIndex: { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4 }[weekday] ?? null,
    legible: fmt({
      locale: "es-VE",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };
}

// Una tabla que todavía no existe (un módulo sin migrar) no debe tumbar
// el contexto completo: el resto igual vale la pena mandarlo.
async function rows(query) {
  try {
    const { data, error } = await query;
    return error ? [] : data ?? [];
  } catch {
    return [];
  }
}

// Arma el bloque que va delante de cada mensaje.
//
// Claude tiene herramientas para leer todo esto por su cuenta, pero un turno
// que no las llame contestaría a ciegas. Mandándoselo pegado al mensaje, la
// respuesta siempre sale de sus datos reales. La base de conocimiento va
// solo cuando la sesión es nueva, porque --resume ya la lleva en contexto.
export async function buildContext(supabase, includeKnowledge) {
  const today = caracasToday();
  const out = [`Hoy es ${today.legible}. Zona horaria: America/Caracas.`];

  const [
    tasks,
    blocks,
    subjects,
    evals,
    projects,
    tobuy,
    finance,
    finCats,
    finRates,
    folders,
    docs,
  ] = await Promise.all([
      rows(supabase.from("tasks").select("title,priority,due,done,project_id")),
      rows(
        supabase
          .from("grades_schedule_blocks")
          .select("day,start_time,end_time,subject")
          .is("person_id", null)
      ),
      rows(supabase.from("grades_subjects").select("id,name")),
      rows(
        supabase
          .from("grades_evaluations")
          .select("subject_id,name,eval_date,grade")
          .not("eval_date", "is", null)
      ),
      rows(supabase.from("personal_projects").select("*")),
      rows(supabase.from("tobuy_items").select("title").eq("checked", false)),
    rows(
      supabase
        .from("finance_transactions")
        .select("kind,amount_usd,occurred_on,category_id")
        .gte("occurred_on", `${today.date.slice(0, 7)}-01`)
    ),
    rows(supabase.from("finance_categories").select("id,name")),
    rows(supabase.from("finance_rates").select("code,label,per_usd")),
      includeKnowledge
        ? rows(supabase.from("knowledge_folders").select("id,name").order("sort_order"))
        : [],
      includeKnowledge
        ? rows(
            supabase
              .from("knowledge_docs")
              .select("title,content,folder_id")
              .order("sort_order")
          )
        : [],
    ]);

  const classes = blocks
    .filter((b) => b.day === today.dayIndex)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((b) => `  ${b.start_time}-${b.end_time} ${b.subject}`);
  out.push(
    classes.length
      ? `CLASES DE HOY:\n${classes.join("\n")}`
      : "CLASES DE HOY: ninguna."
  );

  const pending = tasks.filter((t) => !t.done);
  const label = (t) =>
    `  [${t.priority ?? "sin prioridad"}] ${t.title}` +
    (t.due ? ` — vence ${t.due}${t.due < today.date ? " (ATRASADA)" : ""}` : "");
  out.push(
    pending.length
      ? `TAREAS PENDIENTES (${pending.length}):\n${pending.slice(0, 40).map(label).join("\n")}`
      : "TAREAS PENDIENTES: ninguna."
  );

  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const upcoming = evals
    .filter((e) => e.grade == null && e.eval_date >= today.date)
    .sort((a, b) => a.eval_date.localeCompare(b.eval_date))
    .slice(0, 8)
    .map(
      (e) => `  ${e.eval_date} — ${subjectName.get(e.subject_id) ?? "?"}: ${e.name}`
    );
  if (upcoming.length) out.push(`EVALUACIONES PRÓXIMAS:\n${upcoming.join("\n")}`);

  if (projects.length) {
    out.push(
      `PROYECTOS DE LA AGENCIA:\n${projects
        .map(
          (p) =>
            `  ${p.name}` +
            (p.client ? ` — cliente: ${p.client}` : "") +
            (p.budget ? ` — ${p.budget}` : "") +
            (p.payment_status ? ` — pago: ${p.payment_status}` : "")
        )
        .join("\n")}`
    );
  }

  if (tobuy.length) {
    out.push(
      `LISTA DE COMPRAS (${tobuy.length} sin marcar):\n  ${tobuy
        .slice(0, 30)
        .map((i) => i.title)
        .join(", ")}`
    );
  }

  if (finance.length || finRates.length) {
    const catName = new Map(finCats.map((c) => [c.id, c.name]));
    const sum = (kind) =>
      finance
        .filter((t) => t.kind === kind)
        .reduce((a, t) => a + Number(t.amount_usd), 0);
    const income = sum("income");
    const expense = sum("expense");

    const porCat = {};
    for (const t of finance) {
      if (t.kind !== "expense") continue;
      const key = catName.get(t.category_id) ?? "Sin categoría";
      porCat[key] = (porCat[key] ?? 0) + Number(t.amount_usd);
    }
    const top = Object.entries(porCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, total]) => `    ${name}: ${total.toFixed(2)}`);

    const tasas = finRates.map(
      (r) =>
        `    ${r.label || r.code}: ${
          r.per_usd === null ? "SIN CARGAR" : `${r.per_usd} por dólar`
        }`
    );

    out.push(
      [
        `FINANZAS DEL MES (todo en dólares BCV):`,
        `  Ingresos: ${income.toFixed(2)}`,
        `  Gastos: ${expense.toFixed(2)}`,
        `  Balance: ${(income - expense).toFixed(2)}`,
        top.length ? `  Mayores gastos por categoría:\n${top.join("\n")}` : "",
        tasas.length ? `  Tasas guardadas:\n${tasas.join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  if (includeKnowledge && docs.length) {
    const folderName = new Map(folders.map((f) => [f.id, f.name]));
    let kb = "";
    for (const d of docs) {
      const where = d.folder_id ? folderName.get(d.folder_id) ?? "?" : "Sin carpeta";
      const entry = `\n### ${where} / ${d.title}\n${(d.content ?? "").trim()}\n`;
      if (kb.length + entry.length > KB_BUDGET) {
        kb += `\n(…resto de los documentos recortado; leelo con la herramienta knowledge.)\n`;
        break;
      }
      kb += entry;
    }
    out.push(`BASE DE CONOCIMIENTO (quién es Andrés, su salud, su agencia):${kb}`);
  }

  return out.join("\n\n");
}


// Probar a mano:  node context.js
// Imprime exactamente el bloque que recibe Claude en cada mensaje.
if (import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  const [{ createClient }, { default: dotenv }] = await Promise.all([
    import("@supabase/supabase-js"),
    import("dotenv"),
  ]);
  dotenv.config({ path: new URL(".env", import.meta.url) });
  const sb = createClient(
    process.env.NEXUS_SUPABASE_URL,
    process.env.NEXUS_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  const { error } = await sb.auth.signInWithPassword({
    email: process.env.NEXUS_EMAIL,
    password: process.env.NEXUS_PASSWORD,
  });
  if (error) throw new Error(error.message);
  console.log(await buildContext(sb, true));
}
