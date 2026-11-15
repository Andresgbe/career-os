// Markdown context docs, grouped in folders and scoped by `section`.
// Backs BRAIN (section "brain") and Content's "AI context" tab (section
// "content"). The tables are still called knowledge_folders / knowledge_docs
// from when this was the Knowledge module; the MCP server reads the same rows.
import { supabase } from "./supabase";

export interface ContextFolderRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
  section?: string; // "brain" = BRAIN, a module id = that module's context (e.g. "content")
  created_at: string;
}

export interface ContextDocRow {
  id: string;
  user_id: string;
  folder_id: string | null; // null = loose doc, shown as "Unfiled"
  title: string;
  content: string; // markdown
  sort_order: number;
  section?: string;
  created_at: string;
  updated_at: string;
}

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

// `section` scopes a library: "brain" is BRAIN, a module id (e.g. "content")
// is that module's own context folders. Filtered client-side, like the MCP
// server does.
const inSection = (section: string) => (row: { section?: string | null }) =>
  (row.section ?? "") === section;

export async function getFolders(section: string): Promise<ContextFolderRow[]> {
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
  section: string
): Promise<ContextFolderRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("knowledge_folders")
    .insert({
      user_id: user.id,
      name,
      color,
      sort_order: sortOrder,
      ...(section ? { section } : {}),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ContextFolderRow;
}

export async function updateFolder(
  id: string,
  fields: Partial<{ name: string; color: string; sort_order: number }>
): Promise<ContextFolderRow> {
  const { data, error } = await supabase
    .from("knowledge_folders")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ContextFolderRow;
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

export async function getDocs(section: string): Promise<ContextDocRow[]> {
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
  section: string
): Promise<ContextDocRow> {
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
  return data as ContextDocRow;
}

export async function updateDoc(
  id: string,
  fields: Partial<{
    title: string;
    content: string;
    folder_id: string | null;
    sort_order: number;
  }>
): Promise<ContextDocRow> {
  const { data, error } = await supabase
    .from("knowledge_docs")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ContextDocRow;
}

export async function deleteDoc(id: string): Promise<void> {
  const { error } = await supabase.from("knowledge_docs").delete().eq("id", id);
  if (error) throw error;
}
