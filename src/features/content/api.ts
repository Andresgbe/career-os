import { supabase } from "../../lib/supabase";
import type { CategoryRow, ContentIdeaRow } from "./types";

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

interface ContentIdeaInsert {
  title: string;
  description: string;
  script: string;
  category_id: string | null;
  sort_order: number;
}

export async function getContentIdeas(): Promise<ContentIdeaRow[]> {
  const { data, error } = await supabase
    .from("content_ideas")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addContentIdea(
  idea: ContentIdeaInsert
): Promise<ContentIdeaRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("content_ideas")
    .insert({ user_id: user.id, ...idea })
    .select("*")
    .single();
  if (error) throw error;
  return data as ContentIdeaRow;
}

export async function updateContentIdea(
  id: string,
  fields: Partial<
    ContentIdeaInsert & {
      script_done: boolean;
      recorded: boolean;
      edited: boolean;
    }
  >
): Promise<ContentIdeaRow> {
  const { data, error } = await supabase
    .from("content_ideas")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ContentIdeaRow;
}

export async function toggleIdeaStatus(
  id: string,
  field: "script_done" | "recorded" | "edited",
  value: boolean
): Promise<ContentIdeaRow> {
  const { data, error } = await supabase
    .from("content_ideas")
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ContentIdeaRow;
}

export async function deleteContentIdea(id: string): Promise<void> {
  const { error } = await supabase
    .from("content_ideas")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Persist a drag-and-drop move: which column (category) each moved idea
// now belongs to and its new position within that column.
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
