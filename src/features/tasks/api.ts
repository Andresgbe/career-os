import { supabase } from "../../lib/supabase";
import type { TaskFields, TaskRow, TaskStatus } from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

function normalize(row: Record<string, unknown>): TaskRow {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    details: String(row.details ?? ""),
    status: (row.status as TaskStatus) ?? "pendiente",
    priority: (row.priority as TaskRow["priority"]) ?? "media",
    due_date: (row.due_date as string | null) ?? null,
    result: String(row.result ?? ""),
    updated_by: row.updated_by === "agent" ? "agent" : "andres",
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? row.created_at ?? ""),
    completed_at: (row.completed_at as string | null) ?? null,
  };
}

export async function getTasks(): Promise<TaskRow[]> {
  const { data, error } = await supabase.from("assistant_tasks").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []).map(normalize);
}

export async function addTask(fields: TaskFields, sortOrder: number): Promise<TaskRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("assistant_tasks")
    .insert({ user_id: user.id, ...fields, sort_order: sortOrder, updated_by: "andres" })
    .select("*")
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function updateTask(
  id: string,
  fields: Partial<TaskFields> & { status?: TaskStatus; result?: string }
): Promise<TaskRow> {
  const patch: Record<string, unknown> = {
    ...fields,
    updated_by: "andres",
    updated_at: new Date().toISOString(),
  };
  if (fields.status) patch.completed_at = fields.status === "hecha" ? new Date().toISOString() : null;
  const { data, error } = await supabase
    .from("assistant_tasks")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("assistant_tasks").delete().eq("id", id);
  if (error) throw error;
}
