// Buzón: canal asíncrono entre Andrés y su asistente (BLOQUE 34).
//  - assistant_messages: hilo tipo "Mensajes" de los proyectos. El asistente lo
//    lee/responde por MCP (buzon_read / buzon_reply); seen_by_agent_at marca
//    cuándo lo leyó para mostrar "Visto".
//  - assistant_notes: notas sueltas que Andrés le deja (y que el asistente
//    también puede escribir).

export type Author = "andres" | "agent";

export interface BuzonMessage {
  id: string;
  author: Author;
  body: string;
  created_at: string;
  /** Cuándo lo leyó el asistente (solo aplica a mensajes de Andrés). */
  seen_by_agent_at: string | null;
}

export interface BuzonNote {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  updated_by: Author;
  created_at: string;
  updated_at: string;
}

export type NoteFields = Pick<BuzonNote, "title" | "body" | "pinned">;

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoy";
  if (d.toDateString() === yesterday.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" });
}

/** Fijadas primero, luego la más recientemente editada. */
export function sortNotes(a: BuzonNote, b: BuzonNote): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return b.updated_at.localeCompare(a.updated_at);
}
