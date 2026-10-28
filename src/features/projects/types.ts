// Project Management module types.
// A lightweight tracker for personal/freelance software projects.
// These mirror the DB row (snake_case), same approach as the other modules.

import type { RichTableData } from "../../components/TableBlock";

export interface ProjectMilestone {
  id: string;
  title: string;
  done: boolean;
}

// A single piece of reference info attached to a project: a link, a
// credential pair, an uploaded image, or a free-form note. A
// "credential_group" is a user-made category in the Credenciales tab
// (label = name, value = color); credentials point at it via `category`.
export type ResourceType = "link" | "credential" | "credential_group" | "image" | "note";

export const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "link", label: "Link" },
  { value: "credential", label: "Credential" },
  { value: "image", label: "Image" },
];

export const RESOURCE_STYLE: Record<ResourceType, { color: string; bg: string }> = {
  note: { color: "text-emerald-400", bg: "bg-emerald-400/10" },
  link: { color: "text-blue-400", bg: "bg-blue-400/10" },
  credential: { color: "text-amber-400", bg: "bg-amber-400/10" },
  credential_group: { color: "text-amber-400", bg: "bg-amber-400/10" },
  image: { color: "text-purple-400", bg: "bg-purple-400/10" },
};

export interface ProjectResource {
  id: string;
  type: ResourceType;
  label: string;
  value: string; // URL for "link", text for "note"
  username: string; // "credential" only
  password: string; // "credential" only
  category?: string; // "credential" only — id of its credential_group, "" when none
  file_path: string; // "image" only — path inside the "project-files" bucket
}

export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  client: string;
  description: string;
  tech_stack: string[];
  resources: ProjectResource[]; // stored as jsonb in Supabase
  milestones: ProjectMilestone[];
  sort_order: number;
  created_at: string;
}

// ============================================
// ENTRIES (Notion-style pages inside a project)
// ============================================

export type ProjectEntryTableData = RichTableData;

export interface ProjectEntryRow {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  content: string; // rich HTML (bold, color, bullets, inline images)
  code: string; // optional collapsible code snippet
  table_data: ProjectEntryTableData | null; // optional collapsible table
  created_at: string;
}

// ============================================
// DESIGN (titled photo galleries per project)
// ============================================

export interface ProjectDesignImage {
  id: string;
  file_path: string; // path inside the "project-files" bucket
  label: string;
}

export interface ProjectDesignEntryRow {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  images: ProjectDesignImage[]; // stored as jsonb in Supabase
  created_at: string;
}

// ============================================
// BOARD (Kanban: columns the user creates, tasks dragged between them)
// ============================================

// A credential in the "Privada" category: its own table, readable only by
// the user who created it (see BLOQUE 12 of PENDIENTE.sql).
export interface PrivateCredentialRow {
  id: string;
  user_id: string;
  project_id: string;
  label: string;
  username: string;
  password: string;
  sort_order: number;
  created_at: string;
}

export interface BoardColumnRow {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface BoardTaskRow {
  id: string;
  user_id: string;
  project_id: string;
  column_id: string;
  title: string;
  tag: string; // free-form label, '' when none
  assignee: string; // who's on it, '' when nobody
  due: string | null; // YYYY-MM-DD
  sort_order: number;
  created_at: string;
}

export const BOARD_COLORS = [
  "#a1a1aa",
  "#a78bfa",
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#fb923c",
  "#f472b6",
  "#f87171",
];

// A stable accent per project, so its badge looks the same everywhere
const PROJECT_ACCENTS = ["#a78bfa", "#38bdf8", "#fbbf24", "#34d399", "#f472b6", "#fb923c"];

export function projectAccent(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PROJECT_ACCENTS[hash % PROJECT_ACCENTS.length];
}

export function projectInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.map((w) => w.charAt(0)).join("").slice(0, 2).toUpperCase() || "?";
}

// "5 nov" for a YYYY-MM-DD due date
export function formatDue(due: string): string {
  return new Date(`${due}T00:00:00`).toLocaleDateString("es-VE", {
    day: "numeric",
    month: "short",
  });
}

// What a brand-new project's board starts with
export const DEFAULT_BOARD_COLUMNS = [
  { name: "Por hacer", color: "#a1a1aa" },
  { name: "En progreso", color: "#a78bfa" },
  { name: "Hecho", color: "#34d399" },
];

// ============================================
// MESSAGES (conversation between Andrés and the project's client)
// ============================================

export interface ProjectMessageRow {
  id: string;
  user_id: string;
  project_id: string;
  author_name: string;
  body: string;
  task_id: string | null; // optional board task the message is about
  created_at: string;
}

// One column of a project's board, summarized for the project list
export interface ColumnCount {
  name: string;
  color: string;
  count: number;
}

// Who besides the owner can see a project, as shown on the project list
export type ProjectAccess = "private" | "view" | "edit";

// How each access level reads on the project list
export const ACCESS_CHIP: Record<ProjectAccess, { label: string; className: string }> = {
  private: { label: "Privado", className: "bg-surface-hover text-muted" },
  view: { label: "Cliente puede ver", className: "bg-emerald-400/10 text-emerald-300" },
  edit: { label: "Cliente puede editar", className: "bg-emerald-400/10 text-emerald-300" },
};
