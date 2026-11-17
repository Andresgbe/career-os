import { supabase } from "../../lib/supabase";
import type { Author, BuzonMessage, BuzonNote, NoteFields } from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

const author = (v: unknown): Author => (v === "agent" ? "agent" : "andres");

function normalizeMessage(row: Record<string, unknown>): BuzonMessage {
  return {
    id: String(row.id),
    author: author(row.author),
    body: String(row.body ?? ""),
    created_at: String(row.created_at ?? ""),
    seen_by_agent_at: (row.seen_by_agent_at as string | null) ?? null,
  };
}

function normalizeNote(row: Record<string, unknown>): BuzonNote {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    pinned: row.pinned === true,
    updated_by: author(row.updated_by),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? row.created_at ?? ""),
  };
}

// ---------- Mensajes ----------

export async function getBuzonMessages(): Promise<BuzonMessage[]> {
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeMessage);
}

export async function sendBuzonMessage(body: string): Promise<BuzonMessage> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("assistant_messages")
    .insert({ user_id: user.id, author: "andres", body })
    .select("*")
    .single();
  if (error) throw error;
  return normalizeMessage(data);
}

export async function deleteBuzonMessage(id: string): Promise<void> {
  const { error } = await supabase.from("assistant_messages").delete().eq("id", id);
  if (error) throw error;
}

/** Llama onInsert por cada mensaje nuevo (por ejemplo la respuesta del asistente). */
export function subscribeToBuzon(onInsert: (row: BuzonMessage) => void): () => void {
  const channel = supabase
    .channel("assistant-messages")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "assistant_messages" }, (payload) =>
      onInsert(normalizeMessage(payload.new))
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------- Notas ----------

export async function getNotes(): Promise<BuzonNote[]> {
  const { data, error } = await supabase.from("assistant_notes").select("*");
  if (error) throw error;
  return (data ?? []).map(normalizeNote);
}

export async function addNote(fields: NoteFields): Promise<BuzonNote> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("assistant_notes")
    .insert({ user_id: user.id, ...fields, updated_by: "andres" })
    .select("*")
    .single();
  if (error) throw error;
  return normalizeNote(data);
}

export async function updateNote(id: string, fields: Partial<NoteFields>): Promise<BuzonNote> {
  const { data, error } = await supabase
    .from("assistant_notes")
    .update({ ...fields, updated_by: "andres", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeNote(data);
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from("assistant_notes").delete().eq("id", id);
  if (error) throw error;
}
