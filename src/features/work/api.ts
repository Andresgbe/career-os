import { supabase } from "../../lib/supabase";
import type {
  WorkTaskRow,
  TaskStatus,
  PersonRow,
  WorkProjectRow,
  ProjectResource,
  GeneralInfoRow,
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
  fields: { title: string; content: string },
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
