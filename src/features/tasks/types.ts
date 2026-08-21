// Tasks module types.
// These mirror the DB rows (snake_case), same approach as the other modules.

export type Priority = "alta" | "media" | "baja";

export type SubtaskStatus = "pendiente" | "en_progreso" | "hecho";

export interface Subtask {
  id: string;
  title: string;
  status: SubtaskStatus;
}

export interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  status_id: string;
  priority: Priority;
  due: string | null; // YYYY-MM-DD
  project: string; // freeform project/tag label, '' if none
  subtasks: Subtask[];
  sort_order: number;
  created_at: string;
}

// A user-defined task status (e.g. "Por hacer", "En progreso", "Bloqueada",
// "Hecha") — a single one is assigned per task, like a mini-kanban. Whether
// it counts as "done" for bucketing/agenda purposes is the is_done flag,
// not the name, so users can add their own completed-style statuses too
// (e.g. "Cancelada").
export interface TaskStatusRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_done: boolean;
  sort_order: number;
  created_at: string;
}

export const STATUS_COLOR_PRESETS = [
  "#71717a", "#8b5cf6", "#f87171", "#fbbf24",
  "#38bdf8", "#22c55e", "#f472b6", "#a3a3a3",
];

export const PRIORITY_LABELS: Record<Priority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export const PRIORITY_RANK: Record<Priority, number> = {
  alta: 0,
  media: 1,
  baja: 2,
};

export type BucketKey =
  | "atrasadas"
  | "hoy"
  | "semana"
  | "mas_adelante"
  | "sin_fecha"
  | "completadas";

export const BUCKET_DEFS: { key: BucketKey; label: string }[] = [
  { key: "atrasadas", label: "Atrasadas" },
  { key: "hoy", label: "Hoy" },
  { key: "semana", label: "Esta semana" },
  { key: "mas_adelante", label: "Más adelante" },
  { key: "sin_fecha", label: "Sin fecha" },
  { key: "completadas", label: "Completadas" },
];

// today's local date as YYYY-MM-DD
export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const MONTHS_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export function formatDueShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(d, 10)} ${MONTHS_SHORT[parseInt(m, 10) - 1]}`;
}

export function bucketOf(task: TaskRow, today: string, isDone: boolean): BucketKey {
  if (isDone) return "completadas";
  if (!task.due) return "sin_fecha";
  if (task.due < today) return "atrasadas";
  if (task.due === today) return "hoy";
  if (task.due <= addDays(today, 7)) return "semana";
  return "mas_adelante";
}
