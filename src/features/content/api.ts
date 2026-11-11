import { supabase } from "../../lib/supabase";
import type {
  CategoryRow,
  ContentIdeaRow,
  ContentWeekRow,
  IdeaFields,
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
    scheduled_date: r.scheduled_date ?? null,
    schedule_order: r.schedule_order ?? 0,
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
