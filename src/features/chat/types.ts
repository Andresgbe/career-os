// Chat module types.
// A message queue between NEXUS and a Claude Code worker running on the
// user's own machine: the web app writes a "user" row, the worker picks it
// up, runs Claude against the nexus MCP server, and writes the reply back.

export type ChatRole = "user" | "assistant";

// pending = waiting for the worker, running = the worker took it,
// done = answered, error = the run failed (content holds the reason)
export type ChatStatus = "pending" | "running" | "done" | "error";

export interface ChatMessageRow {
  id: string;
  user_id: string;
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
