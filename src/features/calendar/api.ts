import { supabase } from "../../lib/supabase";
import type { CalendarEvent, EventFields, EventKind } from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

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
    created_at: String(row.created_at ?? ""),
  };
}

/** Eventos entre dos fechas (YYYY-MM-DD, inclusivo): lo que muestra la grilla. */
export async function getEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .gte("event_date", from)
    .lte("event_date", to)
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
  fields: Partial<EventFields> & { done?: boolean }
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
