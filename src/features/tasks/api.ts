import { supabase } from "../../lib/supabase";
import type { TaskRow, Priority } from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

function normalizeTask(row: Record<string, unknown>): TaskRow {
  return {
    ...(row as unknown as TaskRow),
    done: row.done === true,
    assignee: (row.assignee as string) ?? "",
    project_id: (row.project_id as string | null) ?? null,
  };
}

export async function getTasks(): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeTask);
}

export async function addTask(fields: {
  title: string;
  priority: Priority;
  due: string | null;
  assignee?: string;
  project_id?: string | null;
}): Promise<TaskRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title: fields.title,
      priority: fields.priority,
      due: fields.due,
      assignee: fields.assignee ?? "",
      project_id: fields.project_id ?? null,
      done: false,
      sort_order: Date.now(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return normalizeTask(data);
}

export async function updateTask(
  id: string,
  fields: Partial<{
    title: string;
    done: boolean;
    priority: Priority;
    due: string | null;
    assignee: string;
    project_id: string | null;
  }>
): Promise<TaskRow> {
  const { data, error } = await supabase
    .from("tasks")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeTask(data);
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderTasks(
  order: { id: string; sort_order: number }[]
): Promise<void> {
  const results = await Promise.all(
    order.map(({ id, sort_order }) =>
      supabase.from("tasks").update({ sort_order }).eq("id", id)
    )
  );
  for (const { error } of results) if (error) throw error;
}
