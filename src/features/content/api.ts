import { supabase } from "../../lib/supabase";
import type { CategoryRow, ContentIdeaRow, Platform } from "./types";

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
// CATEGORIES
// ============================================

export async function getCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("content_categories")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addCategory(name: string, color: string) {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("content_categories")
    .insert({ user_id: user.id, name, color })
    .select("*")
    .single();
  if (error) throw error;
  return data as CategoryRow;
}

export async function updateCategory(
  id: string,
  fields: { name?: string; color?: string }
) {
  const { data, error } = await supabase
    .from("content_categories")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as CategoryRow;
}

export async function deleteCategory(id: string) {
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
  platforms: Platform[];
  category_ids: string[];
}

export async function getContentIdeas(): Promise<ContentIdeaRow[]> {
  const { data, error } = await supabase
    .from("content_ideas")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeIdea);
}

export async function addContentIdea(idea: ContentIdeaInsert) {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("content_ideas")
    .insert({
      user_id: user.id,
      title: idea.title,
      description: idea.description,
      script: idea.script,
      platforms: idea.platforms,
      category_ids: idea.category_ids,
    })
    .select("*")
    .single();
  if (error) throw error;
  return normalizeIdea(data);
}

export async function updateContentIdea(
  id: string,
  fields: Partial<ContentIdeaInsert & { script_done: boolean; recorded: boolean; edited: boolean }>
) {
  const { data, error } = await supabase
    .from("content_ideas")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeIdea(data);
}

export async function toggleIdeaStatus(
  id: string,
  field: "script_done" | "recorded" | "edited",
  value: boolean
) {
  const { data, error } = await supabase
    .from("content_ideas")
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeIdea(data);
}

export async function deleteContentIdea(id: string) {
  const { error } = await supabase
    .from("content_ideas")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Supabase returns jsonb as raw JSON; ensure arrays are properly typed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeIdea(row: any): ContentIdeaRow {
  return {
    ...row,
    platforms: Array.isArray(row.platforms) ? row.platforms : [],
    category_ids: Array.isArray(row.category_ids) ? row.category_ids : [],
  };
}
