import type { CalendarEvent, Occurrence } from "./types";

// Lógica pura de repetición (diaria, semanal, mensual, anual). Todo con
// strings YYYY-MM-DD para no depender de zonas horarias.

const parts = (s: string) => s.split("-").map(Number) as [number, number, number];
const utcDays = (s: string) => {
  const [y, m, d] = parts(s);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

/** YYYY-MM-DD del día anterior. */
export function dayBefore(date: string): string {
  const [y, m, d] = parts(date);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return dt.toISOString().slice(0, 10);
}

/** ¿El evento (o su serie) cae en este día? */
export function occursOn(ev: CalendarEvent, date: string): boolean {
  if (date < ev.event_date) return false;
  if (ev.repeat === "none") return date === ev.event_date;
  if (ev.repeat_until && date > ev.repeat_until) return false;
  if (ev.skip_dates.includes(date)) return false;
  const [, m, d] = parts(date);
  const [, em, ed] = parts(ev.event_date);
  switch (ev.repeat) {
    case "daily":
      return true;
    case "weekly":
      return (utcDays(date) - utcDays(ev.event_date)) % 7 === 0;
    // Mes sin ese día (p. ej. el 31): se salta, como Google Calendar.
    case "monthly":
      return d === ed;
    case "yearly":
      return m === em && d === ed;
  }
}

export function isDoneOn(ev: CalendarEvent, date: string): boolean {
  return ev.repeat === "none" ? ev.done : ev.done_dates.includes(date);
}

/** Apariciones de todos los eventos en un día. */
export function occurrencesOn(events: CalendarEvent[], date: string): Occurrence[] {
  return events
    .filter((e) => occursOn(e, date))
    .map((event) => ({ event, date, done: isDoneOn(event, date) }));
}
