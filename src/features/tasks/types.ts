// Tareas que Andrés le deja al asistente (BLOQUE 31, tabla assistant_tasks).
// Los valores guardados (pendiente, en_curso, ...) son los mismos que usa el
// servidor MCP (tasks_list / task_update); acá solo se traducen a etiquetas.

export type TaskStatus = "pendiente" | "en_curso" | "bloqueada" | "hecha";
export type TaskPriority = "alta" | "media" | "baja";
export type TaskActor = "andres" | "agent";

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskRow {
  id: string;
  title: string;
  details: string;
  /** Subtareas (BLOQUE 32). Opcional en la BD: si la columna no existe es []. */
  checklist: ChecklistItem[];
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  /** Lo que el asistente reporta al avanzar o terminar. */
  result: string;
  updated_by: TaskActor;
  sort_order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export type TaskFields = Pick<TaskRow, "title" | "details" | "priority" | "due_date"> & {
  checklist?: ChecklistItem[];
};

export function newChecklistItem(text: string): ChecklistItem {
  return { id: crypto.randomUUID(), text, done: false };
}

export function checklistProgress(items: ChecklistItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}

/** "hace 3 h", "hace 2 d"… para mostrar cuándo se creó o tocó una tarea. */
export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d < 30 ? `hace ${d} d` : new Date(iso).toLocaleDateString("es-VE", { day: "numeric", month: "short" });
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  bloqueada: "Bloqueada",
  hecha: "Hecha",
};

export const STATUS_ORDER: TaskStatus[] = ["pendiente", "en_curso", "bloqueada", "hecha"];

export const STATUS_CLASS: Record<TaskStatus, string> = {
  pendiente: "bg-surface-hover text-muted",
  en_curso: "bg-sky-500/15 text-sky-300",
  bloqueada: "bg-amber-500/15 text-amber-300",
  hecha: "bg-emerald-500/15 text-emerald-300",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export const PRIORITY_RANK: Record<TaskPriority, number> = { alta: 0, media: 1, baja: 2 };

export const PRIORITY_CLASS: Record<TaskPriority, string> = {
  alta: "text-red-300",
  media: "text-muted",
  baja: "text-muted/70",
};

/** Fecha de hoy en Caracas, YYYY-MM-DD (para comparar con due_date). */
export function caracasToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(new Date());
}

export function isOverdue(task: TaskRow, today = caracasToday()): boolean {
  return task.status !== "hecha" && !!task.due_date && task.due_date < today;
}

/** Abiertas primero por prioridad, luego por fecha límite (sin fecha al final) y orden manual. */
export function sortOpen(a: TaskRow, b: TaskRow): number {
  const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (p) return p;
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  }
  return a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
}

/** Hechas: la más reciente primero. */
export function sortDone(a: TaskRow, b: TaskRow): number {
  return (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at);
}

export function formatDue(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-VE", { day: "numeric", month: "short" });
}
