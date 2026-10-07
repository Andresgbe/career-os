import { supabase } from "../../lib/supabase";
import type { KnowledgeFolderRow, KnowledgeDocRow } from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

// ============================================
// FOLDERS
// ============================================

export async function getFolders(): Promise<KnowledgeFolderRow[]> {
  const { data, error } = await supabase
    .from("knowledge_folders")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addFolder(
  name: string,
  color: string,
  sortOrder: number
): Promise<KnowledgeFolderRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("knowledge_folders")
    .insert({ user_id: user.id, name, color, sort_order: sortOrder })
    .select("*")
    .single();
  if (error) throw error;
  return data as KnowledgeFolderRow;
}

export async function updateFolder(
  id: string,
  fields: Partial<{ name: string; color: string; sort_order: number }>
): Promise<KnowledgeFolderRow> {
  const { data, error } = await supabase
    .from("knowledge_folders")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as KnowledgeFolderRow;
}

export async function deleteFolder(id: string): Promise<void> {
  const { error } = await supabase
    .from("knowledge_folders")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// DOCS
// ============================================

export async function getDocs(): Promise<KnowledgeDocRow[]> {
  const { data, error } = await supabase
    .from("knowledge_docs")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addDoc(
  folderId: string | null,
  title: string,
  content: string,
  sortOrder: number
): Promise<KnowledgeDocRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("knowledge_docs")
    .insert({
      user_id: user.id,
      folder_id: folderId,
      title,
      content,
      sort_order: sortOrder,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as KnowledgeDocRow;
}

export async function updateDoc(
  id: string,
  fields: Partial<{
    title: string;
    content: string;
    folder_id: string | null;
    sort_order: number;
  }>
): Promise<KnowledgeDocRow> {
  const { data, error } = await supabase
    .from("knowledge_docs")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as KnowledgeDocRow;
}

export async function deleteDoc(id: string): Promise<void> {
  const { error } = await supabase.from("knowledge_docs").delete().eq("id", id);
  if (error) throw error;
}
