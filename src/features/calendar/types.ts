// Calendario del dashboard (BLOQUE 33, tabla calendar_events): recordatorios,
// tareas y eventos puestos en cualquier día. Privado por cuenta.

export type EventKind = "recordatorio" | "tarea" | "evento";

export interface CalendarEvent {
  id: string;
  title: string;
  notes: string;
  /** YYYY-MM-DD */
  event_date: string;
  /** HH:MM (24 h) o "" si es de todo el día */
  event_time: string;
  kind: EventKind;
  done: boolean;
  created_at: string;
}

export type EventFields = Pick<CalendarEvent, "title" | "notes" | "event_date" | "event_time" | "kind">;

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
export function sortEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.event_time !== b.event_time) {
    if (!a.event_time) return 1;
    if (!b.event_time) return -1;
    return a.event_time.localeCompare(b.event_time);
  }
  return a.created_at.localeCompare(b.created_at);
}
