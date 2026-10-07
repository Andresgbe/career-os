import { errorMessage } from "../../lib/errors";
import { useEffect, useRef, useState } from "react";
import {
  Send, Loader2, Trash2, Bot, User, AlertCircle, Clock, Paperclip, X as XIcon,
} from "lucide-react";
import ConfirmDialog from "../../components/ConfirmDialog";
import {
  getMessages,
  sendMessage,
  clearMessages,
  uploadChatImage,
  getChatImageUrl,
} from "./api";
import type { ChatMessageRow } from "./types";
import { isWaiting } from "./types";

const POLL_MS = 2000;

const SUGGESTIONS = [
  "¿Qué tengo pendiente hoy?",
  "Anota una tarea: llamar al cliente el viernes",
  "Agrega café y papel a la lista de compras",
  "¿Cuánto llevo acumulado en Álgebra Lineal?",
];

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  // Attachment staged for the next message, plus a local preview
  const [pendingImage, setPendingImage] = useState<{ path: string; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  // Signed URLs for the thumbnails already in the conversation
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const waiting = messages.some(isWaiting);
  // "running" means the worker claimed it, so the PC is on and Claude is
  // working. "pending" means nothing has picked it up yet — most likely the
  // PC is off, and it'll be answered whenever the worker next starts.
  const queuedOnly =
    waiting && !messages.some((m) => m.role === "user" && m.status === "running");

  useEffect(() => {
    getMessages()
      .then(setMessages)
      .catch(report)
      .finally(() => setLoading(false));
  }, []);

  // While the worker owes us an answer, keep checking for it
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      getMessages().then(setMessages).catch(report);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [waiting]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, waiting]);

  // The bucket is private, so each attachment needs its own signed URL
  useEffect(() => {
    for (const m of messages) {
      if (!m.image_path || imageUrls[m.id]) continue;
      getChatImageUrl(m.image_path)
        .then((url) => setImageUrls((prev) => ({ ...prev, [m.id]: url })))
        .catch(() => {
          // a broken thumbnail shouldn't take the conversation down
        });
    }
  }, [messages, imageUrls]);

  function report(err: unknown) {
    setError(errorMessage(err, "Algo salió mal"));
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const path = await uploadChatImage(file);
      setPendingImage({ path, preview: URL.createObjectURL(file) });
    } catch (err) {
      report(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSend(text?: string) {
    const content = (text ?? draft).trim();
    // A photo on its own is a valid message: "archivá esto donde vaya"
    if ((!content && !pendingImage) || sending) return;
    setSending(true);
    setError("");
    try {
      const row = await sendMessage(
        content || "Archivá esta foto donde corresponda en NEXUS.",
        pendingImage?.path ?? null
      );
      setMessages((prev) => [...prev, row]);
      setDraft("");
      setPendingImage(null);
    } catch (err) {
      report(err);
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    setConfirmClear(false);
    setMessages([]);
    try {
      await clearMessages();
    } catch (err) {
      report(err);
    }
  }

  return (
    <div className="flex flex-col w-full h-[calc(100dvh-15rem)] min-h-[420px]">
      {messages.length > 0 && (
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <button
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-muted hover:text-red-400 hover:bg-surface-hover transition-colors shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpiar
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      <div className="flex-1 overflow-y-auto bg-surface border border-border rounded-xl p-4 sm:p-5 space-y-4 sm:space-y-5">
        {loading ? (
          <p className="text-sm text-muted">Cargando...</p>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4">
            <Bot className="w-8 h-8 text-muted" />
            <p className="text-sm text-muted max-w-sm">
              Escribe lo que necesites. Tiene acceso a tus tareas, compras,
              horario, materias, proyectos y tu perfil.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="px-3 py-1.5 rounded-full border border-border text-xs text-muted hover:border-primary hover:text-primary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const mine = message.role === "user";
            const failed = message.status === "error";
            return (
              <div
                key={message.id}
                className={`flex gap-2.5 ${mine ? "justify-end" : "justify-start"}`}
              >
                {!mine && (
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      failed ? "bg-red-400/15" : "bg-primary/15"
                    }`}
                  >
                    {failed ? (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    ) : (
                      <Bot className="w-4 h-4 text-primary" />
                    )}
                  </span>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[72%] rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words ${
                    mine
                      ? "bg-primary text-white"
                      : failed
                        ? "bg-red-400/10 text-red-400"
                        : "bg-background border border-border"
                  }`}
                >
                  {message.image_path && (
                    <a
                      href={imageUrls[message.id]}
                      target="_blank"
                      rel="noreferrer"
                      className="block mb-2"
                    >
                      {imageUrls[message.id] ? (
                        <img
                          src={imageUrls[message.id]}
                          alt="Adjunto"
                          className="rounded-lg max-h-48 w-auto border border-white/15"
                        />
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs opacity-80">
                          <Paperclip className="w-3 h-3" />
                          Cargando imagen...
                        </span>
                      )}
                    </a>
                  )}
                  {message.content}
                </div>
                {mine && (
                  <span className="w-7 h-7 rounded-full bg-surface-hover flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-muted" />
                  </span>
                )}
              </div>
            );
          })
        )}

        {waiting && (
          <div className="flex gap-2.5">
            <span className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              {queuedOnly ? (
                <Clock className="w-4 h-4 text-amber-400" />
              ) : (
                <Bot className="w-4 h-4 text-primary" />
              )}
            </span>
            <div className="bg-background border border-border rounded-xl px-3.5 py-2.5">
              {queuedOnly ? (
                <div className="flex items-start gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm">En cola</p>
                    <p className="text-xs text-muted mt-0.5">
                      Se responde sola cuando tu PC esté encendida. Podés
                      cerrar esto, el mensaje no se pierde.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" />
                  <span className="text-sm text-muted">Pensando...</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {pendingImage && (
        <div className="flex items-center gap-2 mt-3 p-2 bg-surface border border-border rounded-xl">
          <img
            src={pendingImage.preview}
            alt="Adjunto"
            className="w-12 h-12 object-cover rounded-lg shrink-0"
          />
          <span className="text-xs text-muted flex-1 min-w-0">
            Imagen lista. Decile dónde va, o mandá sin texto y que decida él.
          </span>
          <button
            onClick={() => setPendingImage(null)}
            className="p-1.5 rounded text-muted hover:text-red-400 shrink-0"
            aria-label="Quitar imagen"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !!pendingImage}
          className="flex items-center justify-center px-3 py-3 rounded-xl bg-surface border border-border text-muted hover:text-primary hover:border-primary transition-colors disabled:opacity-40 shrink-0"
          aria-label="Adjuntar foto"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Paperclip className="w-4 h-4" />
          )}
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Anota una tarea, pregunta algo..."
          className="flex-1 min-w-0 bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => handleSend()}
          disabled={sending || (!draft.trim() && !pendingImage)}
          className="flex items-center justify-center px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-40 shrink-0"
          aria-label="Enviar"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Limpiar el chat"
          message="Se borran todos los mensajes. Las tareas y cambios que ya hizo en NEXUS se quedan."
          onConfirm={handleClear}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
