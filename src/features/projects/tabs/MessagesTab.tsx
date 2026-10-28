import { useEffect, useRef, useState } from "react";
import { Send, Trash2, Link2, X } from "lucide-react";
import { errorMessage } from "../../../lib/errors";
import { useAuth } from "../../../hooks/useAuth";
import { usePermissions } from "../../../hooks/usePermissions";
import {
  getProjectMessages,
  sendProjectMessage,
  deleteProjectMessage,
  subscribeToProjectMessages,
  markMessagesRead,
  getBoard,
} from "../api";
import type { BoardTaskRow, ProjectMessageRow } from "../types";

interface MessagesTabProps {
  projectId: string;
  onRead: () => void;
}

// Backup for when realtime isn't enabled on the table yet
const POLL_MS = 10000;

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoy";
  if (d.toDateString() === yesterday.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" });
}

// The project's conversation between Andrés and its client. Both sides see
// the same thread; each message carries who wrote it and when.
export default function MessagesTab({ projectId, onRead }: MessagesTabProps) {
  const { user } = useAuth();
  const { profile } = usePermissions();
  const [messages, setMessages] = useState<ProjectMessageRow[]>([]);
  const [tasks, setTasks] = useState<BoardTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [linkedTask, setLinkedTask] = useState<string | null>(null);
  const [pickingTask, setPickingTask] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const myName =
    profile?.display_name?.trim() || user?.email?.split("@")[0] || "Yo";

  function merge(rows: ProjectMessageRow[]) {
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const r of rows) byId.set(r.id, r);
      return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([getProjectMessages(projectId), getBoard(projectId)])
      .then(([rows, board]) => {
        if (cancelled) return;
        setMessages(rows);
        setTasks(board.tasks);
      })
      .catch((err) => !cancelled && setError(errorMessage(err, "No se pudieron cargar los mensajes")))
      .finally(() => !cancelled && setLoading(false));

    const unsubscribe = subscribeToProjectMessages(projectId, (row) => merge([row]));
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      getProjectMessages(projectId).then(merge).catch(() => {});
    }, POLL_MS);

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(timer);
    };
  }, [projectId]);

  // Opening the tab, and every new message seen while it's open, counts as read
  useEffect(() => {
    if (loading) return;
    markMessagesRead(projectId).then(onRead).catch(() => {});
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading, projectId, onRead]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      const row = await sendProjectMessage(projectId, myName, body, linkedTask);
      merge([row]);
      setDraft("");
      setLinkedTask(null);
    } catch (err) {
      setError(errorMessage(err, "No se pudo enviar el mensaje"));
    } finally {
      setSending(false);
    }
  }

  function remove(id: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    deleteProjectMessage(id).catch((err) => setError(errorMessage(err, "No se pudo borrar")));
  }

  const taskTitle = new Map(tasks.map((t) => [t.id, t.title]));
  const linked = linkedTask ? taskTitle.get(linkedTask) : null;

  return (
    <section className="flex flex-col rounded-2xl bg-surface border border-border overflow-hidden h-[calc(100dvh-20rem)] min-h-[440px]">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 flex flex-col gap-3.5 bg-[#131317]">
        {loading ? (
          <p className="text-sm text-muted">Cargando...</p>
        ) : messages.length === 0 ? (
          <div className="m-auto text-center max-w-sm space-y-1.5">
            <p className="text-sm font-medium">Todavía no hay mensajes</p>
            <p className="text-sm text-muted">
              Lo que escribas aquí lo ven tú y el cliente de este proyecto.
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.user_id === user?.id;
            const showDay =
              i === 0 || dayLabel(messages[i - 1].created_at) !== dayLabel(m.created_at);
            const name = mine ? "Tú" : m.author_name || "Cliente";
            const initial = (m.author_name || "?").charAt(0).toUpperCase();
            return (
              <div key={m.id} className="flex flex-col gap-3.5">
                {showDay && (
                  <div className="flex items-center gap-3 my-1 text-xs text-muted">
                    <span className="flex-1 h-px bg-border" />
                    <span className="capitalize">{dayLabel(m.created_at)}</span>
                    <span className="flex-1 h-px bg-border" />
                  </div>
                )}
                <div
                  className={`group flex gap-2.5 items-start max-w-[85%] sm:max-w-[75%] ${
                    mine ? "self-end flex-row-reverse" : "self-start"
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[13px] font-semibold ${
                      mine ? "bg-primary/20 text-primary-hover" : "bg-sky-500/20 text-sky-300"
                    }`}
                  >
                    {initial}
                  </span>
                  <div className={`flex flex-col gap-1.5 min-w-0 ${mine ? "items-end" : "items-start"}`}>
                    <div className={`flex items-baseline gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                      <span className="text-[13px] font-semibold">{name}</span>
                      <span className="text-xs text-muted">{timeLabel(m.created_at)}</span>
                      {mine && (
                        <button
                          onClick={() => remove(m.id)}
                          className="p-0.5 rounded text-muted opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                          aria-label="Borrar mensaje"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div
                      className={`px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        mine
                          ? "rounded-[14px_4px_14px_14px] bg-primary text-white"
                          : "rounded-[4px_14px_14px_14px] bg-surface-hover border border-[#2c2c34]"
                      }`}
                    >
                      {m.body}
                    </div>
                    {m.task_id && taskTitle.has(m.task_id) && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-hover border border-[#2c2c34] text-xs text-[#d4d4d8]">
                        <span className="w-2 h-2 rounded-sm bg-primary-hover" />
                        Tarea: {taskTitle.get(m.task_id)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="relative px-3 sm:px-4 pt-3 pb-3.5 border-t border-border space-y-2">
        {error && <p className="text-sm text-red-400">{error}</p>}

        {linked && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 text-xs text-primary-hover">
            Tarea: {linked}
            <button onClick={() => setLinkedTask(null)} aria-label="Quitar tarea">
              <X className="w-3 h-3" />
            </button>
          </span>
        )}

        {pickingTask && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setPickingTask(false)} />
            <div className="absolute bottom-full left-3 z-20 mb-2 w-80 max-h-64 overflow-y-auto p-1.5 rounded-xl bg-surface border border-border shadow-xl">
              {tasks.length === 0 ? (
                <p className="text-sm text-muted p-2.5">El tablero no tiene tareas.</p>
              ) : (
                tasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setLinkedTask(t.id);
                      setPickingTask(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-sm hover:bg-surface-hover truncate"
                  >
                    {t.title}
                  </button>
                ))
              )}
            </div>
          </>
        )}

        <div className="flex items-end gap-2 p-1.5 rounded-2xl bg-background border border-[#3a3a44] focus-within:border-primary transition-colors">
          <button
            onClick={() => setPickingTask((v) => !v)}
            className="w-11 h-11 shrink-0 rounded-xl bg-surface-hover text-muted hover:text-foreground flex items-center justify-center"
            aria-label="Vincular una tarea"
            title="Vincular una tarea del tablero"
          >
            <Link2 className="w-[18px] h-[18px]" />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Escribe un mensaje…"
            className="flex-1 min-w-0 resize-none bg-transparent outline-none text-sm leading-relaxed py-3 px-1 max-h-40"
          />
          <button
            onClick={send}
            disabled={sending || !draft.trim()}
            className="w-11 h-11 shrink-0 rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-40 flex items-center justify-center"
            aria-label="Enviar"
          >
            <Send className="w-[18px] h-[18px]" />
          </button>
        </div>
        <p className="text-xs text-muted px-1">Enter para enviar · Shift + Enter para salto de línea</p>
      </div>
    </section>
  );
}
