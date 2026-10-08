// Chat module types.
// A message queue between NEXUS and a Claude Code worker running on the
// user's own machine: the web app writes a "user" row, the worker picks it
// up, runs Claude against the nexus MCP server, and writes the reply back.

export type ChatRole = "user" | "assistant";

// pending = waiting for the worker, running = the worker took it,
// done = answered, error = the run failed (content holds the reason) or
// Andrés lo detuvo desde el chat
export type ChatStatus = "pending" | "running" | "done" | "error";

// Una conversación del historial. Cada una tiene su propia sesión de Claude
// Code, que es lo que hace que empezar una nueva arranque de cero en vez de
// arrastrar todo lo anterior.
export interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  user_id: string;
  conversation_id: string | null;
  role: ChatRole;
  content: string;
  status: ChatStatus;
  image_path: string | null; // file inside the private "chat-files" bucket
  session_id: string | null; // Claude Code session, so the chat keeps context
  created_at: string;
}

// A message is still waiting on the worker
export function isWaiting(message: ChatMessageRow): boolean {
  return (
    message.role === "user" &&
    (message.status === "pending" || message.status === "running")
  );
}

export const NEW_CONVERSATION_TITLE = "Nueva conversación";

// Título a partir del primer mensaje, para no dejar todo llamándose igual
export function titleFrom(content: string): string {
  const clean = content.trim().replace(/\s+/g, " ");
  if (!clean) return NEW_CONVERSATION_TITLE;
  return clean.length > 40 ? `${clean.slice(0, 40)}…` : clean;
}
