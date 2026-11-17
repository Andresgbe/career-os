import { supabase } from "../../lib/supabase";
import type { CalendarEvent, EventFields, EventKind, RepeatKind } from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

function normalize(row: Record<string, unknown>): CalendarEvent {
  const kind = row.kind;
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    notes: String(row.notes ?? ""),
    event_date: String(row.event_date ?? ""),
    event_time: String(row.event_time ?? "").slice(0, 5),
    kind: kind === "tarea" || kind === "evento" ? (kind as EventKind) : "recordatorio",
    done: row.done === true,
    repeat: ["daily", "weekly", "monthly", "yearly"].includes(String(row.repeat)) ? (row.repeat as RepeatKind) : "none",
    repeat_until: (row.repeat_until as string | null) ?? null,
    done_dates: strings(row.done_dates),
    skip_dates: strings(row.skip_dates),
    created_at: String(row.created_at ?? ""),
  };
}

/**
 * Eventos que pueden verse entre dos fechas (YYYY-MM-DD, inclusivo): los de
 * ese rango más todas las series que empezaron antes del final del rango. Qué
 * días caen dentro de cada serie lo decide recurrence.ts.
 */
export async function getEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .or(`and(event_date.gte.${from},event_date.lte.${to}),and(repeat.neq.none,event_date.lte.${to})`)
    .order("event_date");
  if (error) throw error;
  return (data ?? []).map(normalize);
}

export async function addEvent(fields: EventFields): Promise<CalendarEvent> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({ user_id: user.id, ...fields })
    .select("*")
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function updateEvent(
  id: string,
  fields: Partial<EventFields> & { done?: boolean; done_dates?: string[]; skip_dates?: string[] }
): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from("calendar_events")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) throw error;
}
