// Project Management module types.
// A lightweight tracker for personal/freelance software projects.
// These mirror the DB row (snake_case), same approach as the other modules.

export type ProjectStatus =
  | "planning"
  | "in_progress"
  | "review"
  | "on_hold"
  | "completed";

export interface ProjectStatusDef {
  value: ProjectStatus;
  label: string;
  color: string;
  bg: string;
}

// Pipeline order — planning → active work → client review →
// (optionally stalled) → completed. This is the flow most freelance/solo
// software work actually goes through.
export const PROJECT_STATUSES: ProjectStatusDef[] = [
  { value: "planning", label: "Planning", color: "text-muted", bg: "bg-surface-hover" },
  { value: "in_progress", label: "In Progress", color: "text-blue-400", bg: "bg-blue-400/10" },
  { value: "review", label: "Review", color: "text-amber-400", bg: "bg-amber-400/10" },
  { value: "on_hold", label: "On Hold", color: "text-red-400", bg: "bg-red-400/10" },
  { value: "completed", label: "Completed", color: "text-emerald-400", bg: "bg-emerald-400/10" },
];

export type PaymentStatus = "unpaid" | "partial" | "paid";

export const PAYMENT_STATUSES: { value: PaymentStatus; label: string }[] = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partially paid" },
  { value: "paid", label: "Paid" },
];

export interface ProjectMilestone {
  id: string;
  title: string;
  done: boolean;
}

// A single piece of reference info attached to a project: a link, a
// credential pair, an uploaded image, or a free-form note.
export type ResourceType = "link" | "credential" | "image" | "note";

export const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: "link", label: "Link" },
  { value: "credential", label: "Credential" },
  { value: "image", label: "Image" },
  { value: "note", label: "Note" },
];

export interface ProjectResource {
  id: string;
  type: ResourceType;
  label: string;
  value: string; // URL for "link", text for "note"
  username: string; // "credential" only
  password: string; // "credential" only
  file_path: string; // "image" only — path inside the "project-files" bucket
}

export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  client: string;
  description: string;
  status: ProjectStatus;
  budget: number | null;
  payment_status: PaymentStatus;
  tech_stack: string[];
  resources: ProjectResource[]; // stored as jsonb in Supabase
  milestones: ProjectMilestone[];
  sort_order: number;
  created_at: string;
}
