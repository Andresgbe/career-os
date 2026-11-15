import { supabase } from "../../lib/supabase";
import type {
  CategoryRow,
  ContentIdeaRow,
  ContentWeekRow,
  IdeaFields,
  PublicationRow,
  PostMetricRow,
  AccountDailyRow,
  ActiveTimeRow,
  ContentLead,
  WeekStatus,
} from "./types";

// ============================================
// SHARED HELPERS
// ============================================

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

// Rows written before BLOQUE 18 of PENDIENTE.sql lack the planner columns;
// fill them in so the UI never has to guard against undefined.
function normalizeIdea(row: Record<string, unknown>): ContentIdeaRow {
  const r = row as Partial<ContentIdeaRow>;
  return {
    ...(row as unknown as ContentIdeaRow),
    description: r.description ?? "",
    script: r.script ?? "",
    hook: r.hook ?? "",
    format: r.format ?? "",
    style: r.style ?? "",
    scheduled_date: r.scheduled_date ?? null,
    schedule_order: r.schedule_order ?? 0,
    // Column added by BLOQUE 23 of PENDIENTE.sql; false until it exists
    do_not_publish: r.do_not_publish ?? false,
  };
}

// ============================================
// CATEGORIES (board columns)
// ============================================

export async function getCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("content_categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addCategory(
  name: string,
  color: string,
  sortOrder: number
): Promise<CategoryRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("content_categories")
    .insert({ user_id: user.id, name, color, sort_order: sortOrder })
    .select("*")
    .single();
  if (error) throw error;
  return data as CategoryRow;
}

export async function updateCategory(
  id: string,
  fields: Partial<{
    name: string;
    color: string;
    sort_order: number;
    collapsed: boolean;
  }>
): Promise<CategoryRow> {
  const { data, error } = await supabase
    .from("content_categories")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as CategoryRow;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from("content_categories")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// CONTENT IDEAS
// ============================================

export async function getContentIdeas(): Promise<ContentIdeaRow[]> {
  const { data, error } = await supabase
    .from("content_ideas")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeIdea);
}

export async function addContentIdea(
  idea: Partial<IdeaFields> & {
    title: string;
    sort_order: number;
    schedule_order?: number;
  }
): Promise<ContentIdeaRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("content_ideas")
    .insert({ user_id: user.id, ...idea })
    .select("*")
    .single();
  if (error) throw error;
  return normalizeIdea(data);
}

export async function updateContentIdea(
  id: string,
  fields: Partial<IdeaFields>
): Promise<ContentIdeaRow> {
  const { data, error } = await supabase
    .from("content_ideas")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeIdea(data);
}

export async function deleteContentIdea(id: string): Promise<void> {
  const { error } = await supabase
    .from("content_ideas")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Persist a drag-and-drop move on the board: which column (category) each
// moved idea now belongs to and its new position within that column.
export async function reorderContentIdeas(
  order: { id: string; category_id: string | null; sort_order: number }[]
): Promise<void> {
  const results = await Promise.all(
    order.map(({ id, category_id, sort_order }) =>
      supabase
        .from("content_ideas")
        .update({ category_id, sort_order })
        .eq("id", id)
    )
  );
  for (const { error } of results) if (error) throw error;
}

// Persist a drag-and-drop move in the weekly planner: the day each moved
// piece is now scheduled on (null = back to the idea bank) and its position.
export async function rescheduleContentIdeas(
  order: { id: string; scheduled_date: string | null; schedule_order: number }[]
): Promise<void> {
  const results = await Promise.all(
    order.map(({ id, scheduled_date, schedule_order }) =>
      supabase
        .from("content_ideas")
        .update({ scheduled_date, schedule_order })
        .eq("id", id)
    )
  );
  for (const { error } of results) if (error) throw error;
}

// ============================================
// WEEKLY PLANS
// ============================================

export async function getContentWeeks(): Promise<ContentWeekRow[]> {
  const { data, error } = await supabase
    .from("content_weeks")
    .select("*")
    .order("week_key", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ContentWeekRow[];
}

// A week row only exists once something about it was edited, so every
// write is an upsert on (user_id, week_key).
export async function upsertContentWeek(
  weekKey: string,
  fields: Partial<{ title: string; goal: string; notes: string; status: WeekStatus }>
): Promise<ContentWeekRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("content_weeks")
    .upsert(
      {
        user_id: user.id,
        week_key: weekKey,
        ...fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,week_key" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as ContentWeekRow;
}

// ============================================
// PUBLICATIONS (content_publications)
// ============================================

export async function getPublications(): Promise<PublicationRow[]> {
  const { data, error } = await supabase
    .from("content_publications")
    .select("id,idea_id,platform,published_at,url,created_at")
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PublicationRow[];
}

export async function addPublications(
  ideaId: string,
  entries: { platform: string; published_at: string; url: string }[]
): Promise<PublicationRow[]> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("content_publications")
    .insert(entries.map((e) => ({ user_id: user.id, idea_id: ideaId, ...e })))
    .select("id,idea_id,platform,published_at,url,created_at");
  if (error) throw error;
  return (data ?? []) as PublicationRow[];
}

export async function deletePublication(id: string): Promise<void> {
  const { error } = await supabase.from("content_publications").delete().eq("id", id);
  if (error) throw error;
}

// ============================================
// ANALYTICS (BLOQUE 27). Writes are upserts on the natural key, so loading
// the same day / snapshot twice updates it instead of duplicating.
// ============================================

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function getPostMetrics(): Promise<PostMetricRow[]> {
  const { data, error } = await supabase
    .from("content_post_metrics")
    .select("*")
    .order("captured_on", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    avg_watch_seconds: num(r.avg_watch_seconds),
    full_watch_pct: num(r.full_watch_pct),
  })) as PostMetricRow[];
}

export async function upsertPostMetric(
  publicationId: string,
  capturedOn: string,
  fields: Partial<Omit<PostMetricRow, "id" | "publication_id" | "captured_on" | "updated_at">>
): Promise<PostMetricRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("content_post_metrics")
    .upsert(
      { user_id: user.id, publication_id: publicationId, captured_on: capturedOn, source: "manual", ...fields, updated_at: new Date().toISOString() },
      { onConflict: "publication_id,captured_on" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as PostMetricRow;
}

export async function getAccountDaily(): Promise<AccountDailyRow[]> {
  const { data, error } = await supabase
    .from("content_account_daily")
    .select("*")
    .order("day", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AccountDailyRow[];
}

export async function upsertAccountDay(
  platform: string,
  day: string,
  fields: Partial<Omit<AccountDailyRow, "id" | "platform" | "day" | "updated_at">>
): Promise<AccountDailyRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("content_account_daily")
    .upsert(
      { user_id: user.id, platform, day, source: "manual", ...fields, updated_at: new Date().toISOString() },
      { onConflict: "user_id,platform,day" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as AccountDailyRow;
}

export async function getActiveTimes(): Promise<ActiveTimeRow[]> {
  const { data, error } = await supabase.from("content_active_times").select("*");
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, value: Number(r.value) })) as ActiveTimeRow[];
}

// Leads = pipeline deals that came from content (a network or a piece)
export async function getContentLeads(): Promise<ContentLead[]> {
  const { data, error } = await supabase
    .from("pipeline_deals")
    .select("id,name,status,stage_id,source,source_idea_id,created_at")
    .or("source.in.(tiktok,instagram),source_idea_id.not.is.null");
  if (error) throw error;
  return (data ?? []) as ContentLead[];
}

// Quick lead from the stats sheet: a deal in the pipeline's first stage
export async function createContentLead(fields: {
  name: string;
  source: string;
  source_idea_id: string | null;
  contact: string;
  note: string;
}): Promise<ContentLead> {
  const user = await requireUser();
  const { data: stages, error: se } = await supabase
    .from("pipeline_stages")
    .select("id")
    .order("sort_order")
    .limit(1);
  if (se) throw se;
  const { data, error } = await supabase
    .from("pipeline_deals")
    .insert({
      user_id: user.id,
      name: fields.name,
      contact: fields.contact,
      note: fields.note,
      channel: fields.source === "tiktok" || fields.source === "instagram" ? fields.source : "otro",
      source: fields.source,
      source_idea_id: fields.source_idea_id,
      stage_id: stages?.[0]?.id ?? null,
    })
    .select("id,name,status,stage_id,source,source_idea_id,created_at")
    .single();
  if (error) throw error;
  await supabase.from("pipeline_activity").insert({
    user_id: user.id,
    deal_id: data.id,
    kind: "created",
    body: "Lead logged from Content → Stats",
    actor: "andres",
  });
  return data as ContentLead;
}
