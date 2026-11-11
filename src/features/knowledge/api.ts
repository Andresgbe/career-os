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

// `section` scopes a library: "" is the general Knowledge base, a module id
// (e.g. "content") is that module's own context folders. Filtered here
// rather than in the query so the general base keeps working on a database
// where the section column (BLOQUE 19 of PENDIENTE.sql) doesn't exist yet.
const inSection = (section: string) => (row: { section?: string | null }) =>
  (row.section ?? "") === section;

export async function getFolders(section = ""): Promise<KnowledgeFolderRow[]> {
  const { data, error } = await supabase
    .from("knowledge_folders")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).filter(inSection(section));
}

export async function addFolder(
  name: string,
  color: string,
  sortOrder: number,
  section = ""
): Promise<KnowledgeFolderRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("knowledge_folders")
    .insert({
      user_id: user.id,
      name,
      color,
      sort_order: sortOrder,
      // Only sent when set, so the general base doesn't need the column
      ...(section ? { section } : {}),
    })
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

export async function getDocs(section = ""): Promise<KnowledgeDocRow[]> {
  const { data, error } = await supabase
    .from("knowledge_docs")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).filter(inSection(section));
}

export async function addDoc(
  folderId: string | null,
  title: string,
  content: string,
  sortOrder: number,
  section = ""
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
      ...(section ? { section } : {}),
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
