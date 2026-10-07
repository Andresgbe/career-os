// Tasks module types.
// A plain personal to-do list: a title, a priority, an optional due date and
// a done flag. No statuses and no project picker — project work lives in the
// Tasks tab of each project instead.

export type Priority = "alta" | "media" | "baja";

export interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  done: boolean;
  priority: Priority;
  due: string | null; // YYYY-MM-DD
  assignee: string; // who's responsible; '' when nobody is
  project_id: string | null; // set only for tasks created inside a project
  sort_order: number;
  created_at: string;
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

// Sort order for "ordenar por prioridad": alta first.
export const PRIORITY_RANK: Record<Priority, number> = {
  alta: 0,
  media: 1,
  baja: 2,
};

export const PRIORITY_DOT: Record<Priority, string> = {
  alta: "bg-red-400",
  media: "bg-amber-400",
  baja: "bg-sky-400",
};

export const PRIORITY_CHIP: Record<Priority, string> = {
  alta: "bg-red-400/15 text-red-400",
  media: "bg-amber-400/15 text-amber-400",
  baja: "bg-sky-400/15 text-sky-400",
};

// today's local date as YYYY-MM-DD
export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MONTHS_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export function formatDueShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(d, 10)} ${MONTHS_SHORT[parseInt(m, 10) - 1]}`;
}
