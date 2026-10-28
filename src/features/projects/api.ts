import { supabase } from "../../lib/supabase";
import { compressImage } from "../../lib/compressImage";
import type {
  ProjectRow,
  ProjectResource,
  ProjectMilestone,
  ProjectEntryRow,
  ProjectDesignEntryRow,
  ProjectDesignImage,
  BoardColumnRow,
  BoardTaskRow,
  ProjectMessageRow,
  ProjectAccess,
} from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

// Supabase returns jsonb as raw JSON; ensure arrays are properly typed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeProject(row: any): ProjectRow {
  return {
    ...row,
    tech_stack: Array.isArray(row.tech_stack) ? row.tech_stack : [],
    resources: Array.isArray(row.resources) ? row.resources : [],
    milestones: Array.isArray(row.milestones) ? row.milestones : [],
  };
}

export async function getProjects(): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from("personal_projects")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeProject);
}

export async function getProject(id: string): Promise<ProjectRow> {
  const { data, error } = await supabase
    .from("personal_projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return normalizeProject(data);
}

export interface ProjectFormFields {
  name: string;
  client: string;
  description: string;
  tech_stack: string[];
  // Omitted by the project modal: links, credentials and the rest are
  // edited one at a time in their own tabs, so a modal save must not
  // overwrite whatever those tabs have changed since it opened.
  resources?: ProjectResource[];
  milestones: ProjectMilestone[];
}

// Save (insert or update) a project
export async function saveProject(
  fields: ProjectFormFields,
  existingId: string | null,
  nextSortOrder: number
): Promise<ProjectRow> {
  if (existingId) {
    const { data, error } = await supabase
      .from("personal_projects")
      .update(fields)
      .eq("id", existingId)
      .select("*")
      .single();
    if (error) throw error;
    return normalizeProject(data);
  }

  const user = await requireUser();
  const { data, error } = await supabase
    .from("personal_projects")
    .insert({
      user_id: user.id,
      sort_order: nextSortOrder,
      resources: [],
      ...fields,
    })
    .select("*")
    .single();
  if (error) throw error;
  return normalizeProject(data);
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from("personal_projects")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Partial updates used by the workspace tabs, so adding a link/credential/
// image or checking off a milestone doesn't require the full edit modal.
export async function updateProjectResources(
  id: string,
  resources: ProjectResource[]
): Promise<ProjectRow> {
  const { data, error } = await supabase
    .from("personal_projects")
    .update({ resources })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeProject(data);
}

export async function updateProjectMilestones(
  id: string,
  milestones: ProjectMilestone[]
): Promise<ProjectRow> {
  const { data, error } = await supabase
    .from("personal_projects")
    .update({ milestones })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeProject(data);
}

// ============================================
// PROJECT IMAGES (Supabase Storage)
// ============================================

const BUCKET = "project-files";

// Upload an image and return its storage path (to be saved on a resource entry)
export async function uploadProjectImage(file: File): Promise<string> {
  const user = await requireUser();
  const compressed = await compressImage(file);
  const filePath = `${user.id}/${Date.now()}-${compressed.name}`;

  const { error } = await supabase.storage.from(BUCKET).upload(filePath, compressed);
  if (error) throw error;
  return filePath;
}

// Get a temporary signed URL to view an uploaded image
export async function getProjectFileUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60 * 60); // valid for 1 hour
  if (error) throw error;
  return data.signedUrl;
}

// ============================================
// ENTRIES (Notion-style pages inside a project)
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeEntry(row: any): ProjectEntryRow {
  return {
    ...row,
    table_data: Array.isArray(row.table_data?.cells) ? row.table_data : null,
  };
}

export async function getProjectEntries(projectId: string): Promise<ProjectEntryRow[]> {
  const { data, error } = await supabase
    .from("project_entries")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeEntry);
}

export async function saveProjectEntry(
  projectId: string,
  fields: { title: string; content: string; code: string; table_data: ProjectEntryRow["table_data"] },
  existingId: string | null
): Promise<ProjectEntryRow> {
  if (existingId) {
    const { data, error } = await supabase
      .from("project_entries")
      .update(fields)
      .eq("id", existingId)
      .select("*")
      .single();
    if (error) throw error;
    return normalizeEntry(data);
  }

  const user = await requireUser();
  const { data, error } = await supabase
    .from("project_entries")
    .insert({ user_id: user.id, project_id: projectId, ...fields })
    .select("*")
    .single();
  if (error) throw error;
  return normalizeEntry(data);
}

export async function deleteProjectEntry(id: string): Promise<void> {
  const { error } = await supabase.from("project_entries").delete().eq("id", id);
  if (error) throw error;
}

const ENTRY_FILES_BUCKET = "project-entry-files";

// Upload an image embedded inline in an entry's rich text. Separate public
// bucket (unlike the private "project-files" gallery bucket) so the
// returned URL can be embedded directly in stored HTML without re-signing
// it every render — same reasoning as the Work module's inline images.
export async function uploadProjectEntryImage(file: File): Promise<string> {
  const user = await requireUser();
  const compressed = await compressImage(file);
  const filePath = `${user.id}/${Date.now()}-${compressed.name}`;

  const { error } = await supabase.storage
    .from(ENTRY_FILES_BUCKET)
    .upload(filePath, compressed);
  if (error) throw error;

  return supabase.storage.from(ENTRY_FILES_BUCKET).getPublicUrl(filePath).data
    .publicUrl;
}

// ============================================
// DESIGN (titled photo galleries per project)
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeDesignEntry(row: any): ProjectDesignEntryRow {
  return {
    ...row,
    images: Array.isArray(row.images) ? row.images : [],
  };
}

export async function getProjectDesignEntries(
  projectId: string
): Promise<ProjectDesignEntryRow[]> {
  const { data, error } = await supabase
    .from("project_design_entries")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeDesignEntry);
}

export async function saveProjectDesignEntry(
  projectId: string,
  title: string,
  existingId: string | null
): Promise<ProjectDesignEntryRow> {
  if (existingId) {
    const { data, error } = await supabase
      .from("project_design_entries")
      .update({ title })
      .eq("id", existingId)
      .select("*")
      .single();
    if (error) throw error;
    return normalizeDesignEntry(data);
  }

  const user = await requireUser();
  const { data, error } = await supabase
    .from("project_design_entries")
    .insert({ user_id: user.id, project_id: projectId, title, images: [] })
    .select("*")
    .single();
  if (error) throw error;
  return normalizeDesignEntry(data);
}

export async function updateProjectDesignImages(
  id: string,
  images: ProjectDesignImage[]
): Promise<ProjectDesignEntryRow> {
  const { data, error } = await supabase
    .from("project_design_entries")
    .update({ images })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeDesignEntry(data);
}

export async function deleteProjectDesignEntry(id: string): Promise<void> {
  const { error } = await supabase.from("project_design_entries").delete().eq("id", id);
  if (error) throw error;
}

// ============================================
// BOARD (Kanban)
// ============================================

export async function getBoard(
  projectId: string
): Promise<{ columns: BoardColumnRow[]; tasks: BoardTaskRow[] }> {
  const [cols, tasks] = await Promise.all([
    supabase
      .from("project_board_columns")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("project_board_tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true }),
  ]);
  if (cols.error) throw cols.error;
  if (tasks.error) throw tasks.error;
  return { columns: cols.data ?? [], tasks: tasks.data ?? [] };
}

// Columns and task counts for every project the user can see, for the list
export async function getBoardSummaries(): Promise<{
  columns: BoardColumnRow[];
  tasks: Pick<BoardTaskRow, "project_id" | "column_id">[];
}> {
  const [cols, tasks] = await Promise.all([
    supabase
      .from("project_board_columns")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase.from("project_board_tasks").select("project_id, column_id"),
  ]);
  if (cols.error) throw cols.error;
  if (tasks.error) throw tasks.error;
  return { columns: cols.data ?? [], tasks: tasks.data ?? [] };
}

export async function addBoardColumn(
  projectId: string,
  name: string,
  color: string,
  sortOrder: number
): Promise<BoardColumnRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("project_board_columns")
    .insert({ user_id: user.id, project_id: projectId, name, color, sort_order: sortOrder })
    .select("*")
    .single();
  if (error) throw error;
  return data as BoardColumnRow;
}

export async function updateBoardColumn(
  id: string,
  fields: Partial<Pick<BoardColumnRow, "name" | "color">>
): Promise<void> {
  const { error } = await supabase.from("project_board_columns").update(fields).eq("id", id);
  if (error) throw error;
}

export async function reorderBoardColumns(
  updates: { id: string; sort_order: number }[]
): Promise<void> {
  const results = await Promise.all(
    updates.map(({ id, sort_order }) =>
      supabase.from("project_board_columns").update({ sort_order }).eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

// Deleting a column takes its tasks with it (on delete cascade)
export async function deleteBoardColumn(id: string): Promise<void> {
  const { error } = await supabase.from("project_board_columns").delete().eq("id", id);
  if (error) throw error;
}

export async function addBoardTask(
  projectId: string,
  columnId: string,
  title: string,
  sortOrder: number
): Promise<BoardTaskRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("project_board_tasks")
    .insert({
      user_id: user.id,
      project_id: projectId,
      column_id: columnId,
      title,
      sort_order: sortOrder,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as BoardTaskRow;
}

export async function updateBoardTask(
  id: string,
  fields: Partial<Pick<BoardTaskRow, "title" | "tag" | "assignee" | "due">>
): Promise<void> {
  const { error } = await supabase.from("project_board_tasks").update(fields).eq("id", id);
  if (error) throw error;
}

// Saves the position of every task that moved after a drag
export async function moveBoardTasks(
  updates: { id: string; column_id: string; sort_order: number }[]
): Promise<void> {
  const results = await Promise.all(
    updates.map(({ id, column_id, sort_order }) =>
      supabase.from("project_board_tasks").update({ column_id, sort_order }).eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function deleteBoardTask(id: string): Promise<void> {
  const { error } = await supabase.from("project_board_tasks").delete().eq("id", id);
  if (error) throw error;
}

// ============================================
// MESSAGES
// ============================================

export async function getProjectMessages(projectId: string): Promise<ProjectMessageRow[]> {
  const { data, error } = await supabase
    .from("project_messages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendProjectMessage(
  projectId: string,
  authorName: string,
  body: string,
  taskId: string | null
): Promise<ProjectMessageRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("project_messages")
    .insert({
      user_id: user.id,
      project_id: projectId,
      author_name: authorName,
      body,
      task_id: taskId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProjectMessageRow;
}

export async function deleteProjectMessage(id: string): Promise<void> {
  const { error } = await supabase.from("project_messages").delete().eq("id", id);
  if (error) throw error;
}

// Live updates: calls onInsert for every new message in this project.
// Returns the unsubscribe function.
export function subscribeToProjectMessages(
  projectId: string,
  onInsert: (row: ProjectMessageRow) => void
): () => void {
  const channel = supabase
    .channel(`project-messages-${projectId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "project_messages",
        filter: `project_id=eq.${projectId}`,
      },
      (payload) => onInsert(payload.new as ProjectMessageRow)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function markMessagesRead(projectId: string): Promise<void> {
  const user = await requireUser();
  const { error } = await supabase.from("project_message_reads").upsert(
    { user_id: user.id, project_id: projectId, last_read_at: new Date().toISOString() },
    { onConflict: "user_id,project_id" }
  );
  if (error) throw error;
}

// Messages from someone else posted since this user last opened the
// conversation
export async function getUnreadCount(projectId: string): Promise<number> {
  const user = await requireUser();
  const { data: read } = await supabase
    .from("project_message_reads")
    .select("last_read_at")
    .eq("project_id", projectId)
    .maybeSingle();
  let query = supabase
    .from("project_messages")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .neq("user_id", user.id);
  if (read?.last_read_at) query = query.gt("created_at", read.last_read_at);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

// ============================================
// CLIENT ACCESS (admin only: the list shows who else sees each project)
// ============================================

export async function getProjectAccess(): Promise<Record<string, ProjectAccess>> {
  const [projectPerms, modulePerms] = await Promise.all([
    supabase.from("app_project_permissions").select("user_id, project_id"),
    supabase.from("app_module_permissions").select("user_id, can_edit").eq("module", "projects"),
  ]);
  if (projectPerms.error) throw projectPerms.error;
  if (modulePerms.error) throw modulePerms.error;

  const editors = new Set(
    (modulePerms.data ?? []).filter((p) => p.can_edit).map((p) => p.user_id)
  );
  const access: Record<string, ProjectAccess> = {};
  for (const p of projectPerms.data ?? []) {
    const level: ProjectAccess = editors.has(p.user_id) ? "edit" : "view";
    if (access[p.project_id] !== "edit") access[p.project_id] = level;
  }
  return access;
}
