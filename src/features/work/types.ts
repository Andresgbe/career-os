// Work Tracker module types.
// These mirror the DB rows (snake_case), same approach as the other modules.

// ============================================
// TASKS
// ============================================

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "waiting_backend"
  | "to_consult"
  | "done";

export interface TaskStatusDef {
  value: TaskStatus;
  label: string;
  color: string;
  bg: string;
}

export const TASK_STATUSES: TaskStatusDef[] = [
  { value: "pending", label: "Pending", color: "text-muted", bg: "bg-surface-hover" },
  { value: "in_progress", label: "In Progress", color: "text-blue-400", bg: "bg-blue-400/10" },
  { value: "waiting_backend", label: "Waiting on Backend", color: "text-purple-400", bg: "bg-purple-400/10" },
  { value: "to_consult", label: "To Consult", color: "text-amber-400", bg: "bg-amber-400/10" },
  { value: "done", label: "Done", color: "text-emerald-400", bg: "bg-emerald-400/10" },
];

export interface WorkTaskRow {
  id: string;
  user_id: string;
  identifier: string; // ticket / task id
  description: string;
  status: TaskStatus;
  consulta: string; // doubts/questions about this task
  created_at: string;
}

// ============================================
// PEOPLE
// ============================================

export interface PersonRow {
  id: string;
  user_id: string;
  name: string;
  role: string; // e.g. "Backend", "QA" (optional)
  routes: string[]; // routes/endpoints this person owns
  notes: string;
  created_at: string;
}

// ============================================
// PROJECTS
// ============================================

export interface ProjectResource {
  label: string;
  url: string;
}

export interface WorkProjectRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  notes: string;
  resources: ProjectResource[]; // stored as jsonb in Supabase
  created_at: string;
}

// ============================================
// GENERAL INFO
// ============================================

export interface GeneralInfoRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
}
