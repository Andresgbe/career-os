import { supabase } from "../../lib/supabase";
import type {
  ProjectRow,
  ProjectStatus,
  PaymentStatus,
  ProjectResource,
  ProjectMilestone,
  ProjectEntryRow,
  ProjectDesignEntryRow,
  ProjectDesignImage,
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
  status: ProjectStatus;
  budget: number | null;
  payment_status: PaymentStatus;
  tech_stack: string[];
  resources: ProjectResource[];
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
    .insert({ user_id: user.id, sort_order: nextSortOrder, ...fields })
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
  const filePath = `${user.id}/${Date.now()}-${file.name}`;

  const { error } = await supabase.storage.from(BUCKET).upload(filePath, file);
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
  const filePath = `${user.id}/${Date.now()}-${file.name}`;

  const { error } = await supabase.storage
    .from(ENTRY_FILES_BUCKET)
    .upload(filePath, file);
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
