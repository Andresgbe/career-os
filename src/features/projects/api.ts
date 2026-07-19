import { supabase } from "../../lib/supabase";
import type {
  ProjectRow,
  ProjectStatus,
  PaymentStatus,
  ProjectResource,
  ProjectMilestone,
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
