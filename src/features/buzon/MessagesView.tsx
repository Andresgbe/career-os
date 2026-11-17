import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, Send, Trash2 } from "lucide-react";
import { errorMessage } from "../../lib/errors";
import { renderMarkdown, TASK_MD_CLASS } from "../tasks/markdown";
import { deleteBuzonMessage, getBuzonMessages, sendBuzonMessage, subscribeToBuzon } from "./api";
import { dayLabel, timeLabel, type BuzonMessage } from "./types";

// Respaldo por si realtime no está activo en la tabla
const POLL_MS = 8000;

/**
 * Hilo con el asistente, estilo "Mensajes" de los proyectos. Lo que escribes
 * queda guardado; el asistente lo lee con buzon_read y contesta con
 * buzon_reply. "Visto" aparece cuando ya lo leyó.
 */
export default function MessagesView() {
  const [messages, setMessages] = useState<BuzonMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function merge(rows: BuzonMessage[]) {
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const r of rows) byId.set(r.id, r);
      return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }

  useEffect(() => {
    let cancelled = false;
    getBuzonMessages()
      .then((rows) => !cancelled && setMessages(rows))
      .catch((e) => !cancelled && setError(errorMessage(e, "No pude cargar los mensajes")))
      .finally(() => !cancelled && setLoading(false));
    const unsubscribe = subscribeToBuzon((row) => merge([row]));
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") getBuzonMessages().then(merge).catch(() => {});
    }, POLL_MS);
    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      merge([await sendBuzonMessage(body)]);
      setDraft("");
    } catch (e) {
      setError(errorMessage(e, "No pude enviar el mensaje"));
    } finally {
      setSending(false);
    }
  }

  function remove(id: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    deleteBuzonMessage(id).catch((e) => setError(errorMessage(e, "No pude borrar")));
  }

  // "Visto" solo en el último mensaje mío que el asistente ya leyó
  const lastSeenId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].author === "andres" && messages[i].seen_by_agent_at) return messages[i].id;
    }
    return null;
  }, [messages]);

  return (
    <section className="flex flex-col rounded-2xl bg-surface border border-border overflow-hidden h-[calc(100dvh-22rem)] min-h-[420px]">
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-5 flex flex-col gap-3.5 bg-[#131317]">
        {loading ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : messages.length === 0 ? (
          <div className="m-auto text-center max-w-sm space-y-1.5">
            <p className="text-sm font-medium">Todavía no hay mensajes</p>
            <p className="text-sm text-muted">
              Déjale un recado a tu asistente. Lo lee la próxima vez que revise el buzón y te responde aquí mismo.
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.author === "andres";
            const showDay = i === 0 || dayLabel(messages[i - 1].created_at) !== dayLabel(m.created_at);
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
                  className={`group flex gap-2.5 items-start max-w-[92%] sm:max-w-[75%] ${
                    mine ? "self-end flex-row-reverse" : "self-start"
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[13px] font-semibold ${
                      mine ? "bg-primary/20 text-primary-hover" : "bg-sky-500/20 text-sky-300"
                    }`}
                  >
                    {mine ? "A" : <Bot className="w-4 h-4" />}
                  </span>
                  <div className={`flex flex-col gap-1.5 min-w-0 ${mine ? "items-end" : "items-start"}`}>
                    <div className={`flex items-baseline gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                      <span className="text-[13px] font-semibold">{mine ? "Tú" : "Asistente"}</span>
                      <span className="text-xs text-muted">{timeLabel(m.created_at)}</span>
                      {mine && (
                        <button
                          onClick={() => remove(m.id)}
                          className="p-0.5 rounded text-muted opacity-60 sm:opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                          aria-label="Borrar mensaje"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {mine ? (
                      <div className="px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words rounded-[14px_4px_14px_14px] bg-primary text-white">
                        {m.body}
                      </div>
                    ) : (
                      <div
                        className={`${TASK_MD_CLASS} px-3.5 py-2 leading-relaxed rounded-[4px_14px_14px_14px] bg-surface-hover border border-[#2c2c34]`}
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(m.body) }}
                      />
                    )}
                    {m.id === lastSeenId && (
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        <Check className="w-3 h-3" />
                        Visto por el asistente
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

      <div className="px-3 sm:px-4 pt-3 pb-3.5 border-t border-border space-y-2">
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex items-end gap-2 p-1.5 rounded-2xl bg-background border border-[#3a3a44] focus-within:border-primary transition-colors">
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
            placeholder="Escríbele a tu asistente…"
            className="flex-1 min-w-0 resize-none bg-transparent outline-none text-sm leading-relaxed py-3 px-2 max-h-40"
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
        <p className="hidden sm:block text-xs text-muted px-1">Enter para enviar · Shift + Enter para salto de línea</p>
      </div>
    </section>
  );
}
