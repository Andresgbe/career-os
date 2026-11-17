// Calendario del dashboard (BLOQUE 33, tabla calendar_events): recordatorios,
// tareas y eventos puestos en cualquier día. Privado por cuenta.

export type EventKind = "recordatorio" | "tarea" | "evento";

export type RepeatKind = "none" | "daily" | "weekly" | "monthly" | "yearly";

export interface CalendarEvent {
  id: string;
  title: string;
  notes: string;
  /** YYYY-MM-DD */
  event_date: string;
  /** HH:MM (24 h) o "" si es de todo el día */
  event_time: string;
  kind: EventKind;
  /** Hecho (solo eventos que no se repiten; en una serie se usa done_dates). */
  done: boolean;
  /** Repetición (BLOQUE 33): la serie empieza en event_date. */
  repeat: RepeatKind;
  /** Último día de la serie (inclusive); null = sin fin. */
  repeat_until: string | null;
  /** Días de la serie ya marcados como hechos. */
  done_dates: string[];
  /** Días de la serie que se borraron ("solo este día"). */
  skip_dates: string[];
  created_at: string;
}

/** Una aparición concreta de un evento en un día (las series generan varias). */
export interface Occurrence {
  event: CalendarEvent;
  date: string;
  done: boolean;
}

export type EventFields = Pick<CalendarEvent, "title" | "notes" | "event_date" | "event_time" | "kind"> & {
  repeat?: RepeatKind;
  repeat_until?: string | null;
};

export const REPEATS: RepeatKind[] = ["none", "daily", "weekly", "monthly", "yearly"];

/** Texto de cada opción de repetición, según el día elegido (como Google Calendar). */
export function repeatLabel(kind: RepeatKind, date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  switch (kind) {
    case "none":
      return "No se repite";
    case "daily":
      return "Todos los días";
    case "weekly":
      return `Cada semana el ${dt.toLocaleDateString("es-VE", { weekday: "long" })}`;
    case "monthly":
      return `Cada mes el día ${d}`;
    case "yearly":
      return `Cada año el ${d} de ${MONTHS_ES[m - 1].toLowerCase()}`;
  }
}

export function repeatShort(kind: RepeatKind): string {
  return { none: "", daily: "Diario", weekly: "Semanal", monthly: "Mensual", yearly: "Anual" }[kind];
}

export const KINDS: EventKind[] = ["recordatorio", "tarea", "evento"];

export const KIND_LABEL: Record<EventKind, string> = {
  recordatorio: "Recordatorio",
  tarea: "Tarea",
  evento: "Evento",
};

/** Chip del calendario y punto de color por tipo. */
export const KIND_CLASS: Record<EventKind, string> = {
  recordatorio: "bg-amber-500/15 text-amber-300",
  tarea: "bg-sky-500/15 text-sky-300",
  evento: "bg-primary/20 text-primary-hover",
};

/** Punto sólido por tipo (vista de celular). */
export const KIND_DOT: Record<EventKind, string> = {
  recordatorio: "bg-amber-400",
  tarea: "bg-sky-400",
  evento: "bg-primary",
};

export const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
export const DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function monthTitle(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_ES[m - 1]} ${y}`;
}

export function longDayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Con hora primero (por hora), luego los de todo el día; hechos al final. */
export function sortOccurrences(a: Occurrence, b: Occurrence): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  const [ta, tb] = [a.event.event_time, b.event.event_time];
  if (ta !== tb) {
    if (!ta) return 1;
    if (!tb) return -1;
    return ta.localeCompare(tb);
  }
  return a.event.created_at.localeCompare(b.event.created_at);
}
