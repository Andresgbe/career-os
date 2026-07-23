import { supabase } from "../../lib/supabase";
import type {
  WorkTaskRow,
  TaskStatus,
  PersonRow,
  WorkProjectRow,
  ProjectResource,
  GeneralInfoRow,
  WorkShortcutRow,
} from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

// ============================================
// TASKS
// ============================================

export async function getTasks(): Promise<WorkTaskRow[]> {
  const { data, error } = await supabase
    .from("work_tasks")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addTask(fields: {
  identifier: string;
  description: string;
  status: TaskStatus;
  consulta: string;
}): Promise<WorkTaskRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("work_tasks")
    .insert({ user_id: user.id, ...fields })
    .select("*")
    .single();
  if (error) throw error;
  return data as WorkTaskRow;
}

export async function updateTask(
  id: string,
  fields: Partial<{
    identifier: string;
    description: string;
    status: TaskStatus;
    consulta: string;
  }>
): Promise<WorkTaskRow> {
  const { data, error } = await supabase
    .from("work_tasks")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as WorkTaskRow;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("work_tasks").delete().eq("id", id);
  if (error) throw error;
}

// ============================================
// PEOPLE
// ============================================

export async function getPeople(): Promise<PersonRow[]> {
  const { data, error } = await supabase
    .from("work_people")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizePerson);
}

export async function savePerson(
  fields: { name: string; role: string; routes: string[]; notes: string },
  existingId: string | null
): Promise<PersonRow> {
  if (existingId) {
    const { data, error } = await supabase
      .from("work_people")
      .update(fields)
      .eq("id", existingId)
      .select("*")
      .single();
    if (error) throw error;
    return normalizePerson(data);
  }

  const user = await requireUser();
  const { data, error } = await supabase
    .from("work_people")
    .insert({ user_id: user.id, ...fields })
    .select("*")
    .single();
  if (error) throw error;
  return normalizePerson(data);
}

export async function deletePerson(id: string): Promise<void> {
  const { error } = await supabase.from("work_people").delete().eq("id", id);
  if (error) throw error;
}

// ============================================
// PROJECTS
// ============================================

export async function getWorkProjects(): Promise<WorkProjectRow[]> {
  const { data, error } = await supabase
    .from("work_projects")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeProject);
}

export async function saveWorkProject(
  fields: {
    name: string;
    description: string;
    notes: string;
    resources: ProjectResource[];
  },
  existingId: string | null
): Promise<WorkProjectRow> {
  if (existingId) {
    const { data, error } = await supabase
      .from("work_projects")
      .update(fields)
      .eq("id", existingId)
      .select("*")
      .single();
    if (error) throw error;
    return normalizeProject(data);
  }

  const user = await requireUser();
  const { data, error } = await supabase
    .from("work_projects")
    .insert({ user_id: user.id, ...fields })
    .select("*")
    .single();
  if (error) throw error;
  return normalizeProject(data);
}

export async function deleteWorkProject(id: string): Promise<void> {
  const { error } = await supabase.from("work_projects").delete().eq("id", id);
  if (error) throw error;
}

// ============================================
// GENERAL INFO
// ============================================

export async function getGeneralInfo(): Promise<GeneralInfoRow[]> {
  const { data, error } = await supabase
    .from("work_general_info")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function saveGeneralInfo(
  fields: { title: string; content: string; code: string },
  existingId: string | null
): Promise<GeneralInfoRow> {
  if (existingId) {
    const { data, error } = await supabase
      .from("work_general_info")
      .update(fields)
      .eq("id", existingId)
      .select("*")
      .single();
    if (error) throw error;
    return data as GeneralInfoRow;
  }

  const user = await requireUser();
  const { data, error } = await supabase
    .from("work_general_info")
    .insert({ user_id: user.id, ...fields })
    .select("*")
    .single();
  if (error) throw error;
  return data as GeneralInfoRow;
}

export async function deleteGeneralInfo(id: string): Promise<void> {
  const { error } = await supabase
    .from("work_general_info")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// SHORTCUTS
// ============================================

export async function getWorkShortcuts(): Promise<WorkShortcutRow[]> {
  const { data, error } = await supabase
    .from("work_shortcuts")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addWorkShortcut(
  name: string,
  url: string,
  iconUrl: string | null
): Promise<WorkShortcutRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("work_shortcuts")
    .insert({
      user_id: user.id,
      name,
      url,
      icon_url: iconUrl,
      sort_order: Date.now(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as WorkShortcutRow;
}

// Upload a custom shortcut logo (used when a site has no discoverable
// favicon, e.g. internal/local tools). Public bucket so the URL can be
// embedded directly without re-signing it every render.
export async function uploadShortcutIcon(file: File): Promise<string> {
  const user = await requireUser();
  const filePath = `${user.id}/${Date.now()}-${file.name}`;

  const { error } = await supabase.storage
    .from("shortcut-icons")
    .upload(filePath, file);
  if (error) throw error;

  return supabase.storage.from("shortcut-icons").getPublicUrl(filePath).data
    .publicUrl;
}

export async function deleteWorkShortcut(id: string): Promise<void> {
  const { error } = await supabase
    .from("work_shortcuts")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function reorderWorkShortcuts(
  order: { id: string; sort_order: number }[]
): Promise<void> {
  const results = await Promise.all(
    order.map(({ id, sort_order }) =>
      supabase.from("work_shortcuts").update({ sort_order }).eq("id", id)
    )
  );
  for (const { error } of results) if (error) throw error;
}

// ============================================
// GENERAL INFO IMAGES (Supabase Storage, public bucket)
// ============================================

const WORK_FILES_BUCKET = "work-files";

// Upload an image embedded in a General Info rich-text entry.
// The bucket is public so the returned URL can be embedded directly in
// stored HTML without needing to re-sign it every time it's rendered.
export async function uploadWorkImage(file: File): Promise<string> {
  const user = await requireUser();
  const filePath = `${user.id}/${Date.now()}-${file.name}`;

  const { error } = await supabase.storage
    .from(WORK_FILES_BUCKET)
    .upload(filePath, file);
  if (error) throw error;

  return supabase.storage.from(WORK_FILES_BUCKET).getPublicUrl(filePath).data
    .publicUrl;
}

// Supabase returns jsonb as raw JSON; ensure arrays are properly typed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePerson(row: any): PersonRow {
  return {
    ...row,
    routes: Array.isArray(row.routes) ? row.routes : [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeProject(row: any): WorkProjectRow {
  return {
    ...row,
    resources: Array.isArray(row.resources) ? row.resources : [],
  };
}
