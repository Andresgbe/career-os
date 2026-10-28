import { errorMessage } from "../../lib/errors";
import { useEffect, useRef, useState } from "react";
import {
  Send, Loader2, Trash2, AlertCircle, Clock, Paperclip, X as XIcon,
  Square, History, Plus, RefreshCw, WifiOff, Wifi,
} from "lucide-react";
import ConfirmDialog from "../../components/ConfirmDialog";
import ConversationList from "./ConversationList";
import {
  getConversations,
  createConversation,
  renameConversation,
  deleteConversation,
  getMessages,
  sendMessage,
  clearMessages,
  cancelMessage,
  uploadChatImage,
  getChatImageUrl,
  getWorkerLastSeen,
} from "./api";
import type { ChatMessageRow, ConversationRow } from "./types";
import { isWaiting } from "./types";

const POLL_MS = 2000;
// El worker da una vuelta cada ~3s (incluso en pausa) y escribe su latido en
// cada una. Más de 4 vueltas sin noticias y es más probable que esté apagado
// que una demora de red — ahí se deja de contarlo como "escuchando".
const WORKER_ONLINE_MS = 12000;

function formatAgo(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return "hace unos segundos";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `hace ${hours} h`;
}

const SUGGESTIONS = [
  "¿Cuánto llevo gastado este mes?",
  "¿Qué clases tengo hoy?",
  "Actualiza las tasas",
];

export default function ChatPanel() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [draft, setDraft] = useState("");
  // Última conversación cuyos mensajes ya llegaron
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  // Si ni siquiera se pudo traer la lista de chats, no tiene sentido seguir
  // diciendo "Cargando...": ya se mostró el error y no va a llegar nada.
  const [bootFailed, setBootFailed] = useState(false);
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
  // Milisegundos desde el último latido del worker; null = todavía no se
  // comprobó, o nunca escribió uno (jamás lo corriste, o falta el BLOQUE 10).
  const [workerMs, setWorkerMs] = useState<number | null>(null);
  const [checkingWorker, setCheckingWorker] = useState(false);

  const waiting = messages.some(isWaiting);
  // El mensaje que estamos esperando, para poder cancelarlo
  const pendingMessage = messages.find(isWaiting) ?? null;

  async function handleCancel() {
    if (!pendingMessage) return;
    // Se marca local primero: el botón tiene que responder al toque, no
    // esperar el viaje de ida y vuelta.
    setMessages((prev) =>
      prev.map((m) =>
        m.id === pendingMessage.id ? { ...m, status: "error" as const } : m
      )
    );
    try {
      await cancelMessage(pendingMessage.id);
    } catch (err) {
      report(err);
      if (activeId) getMessages(activeId).then(setMessages).catch(report);
    }
  }

  // El botón "Reintentar": revisa el latido del worker y, de paso, si la
  // cola ya se resolvió, en vez de esperar al próximo tick automático.
  async function checkWorker() {
    setCheckingWorker(true);
    try {
      const ms = await getWorkerLastSeen();
      setWorkerMs(ms);
    } catch {
      // sin la tabla todavía, se queda como "no se sabe" — no es un error
      // que haya que mostrarle
    }
    if (activeId) {
      try {
        setMessages(await getMessages(activeId));
      } catch (err) {
        report(err);
      }
    }
    setCheckingWorker(false);
  }

  async function handleNewConversation() {
    setHistoryOpen(false);
    try {
      const created = await createConversation();
      setConversations((prev) => [created, ...prev]);
      setMessages([]);
      setActiveId(created.id);
    } catch (err) {
      report(err);
    }
  }

  async function handleRename(id: string, title: string) {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
    try {
      await renameConversation(id, title);
    } catch (err) {
      report(err);
    }
  }

  async function handleDeleteConversation(conversation: ConversationRow) {
    const remaining = conversations.filter((c) => c.id !== conversation.id);
    setConversations(remaining);
    try {
      await deleteConversation(conversation.id);
    } catch (err) {
      report(err);
      return;
    }
    if (activeId !== conversation.id) return;
    // Se borró la que estaba abierta: se pasa a la siguiente, o se crea una
    if (remaining.length > 0) {
      setActiveId(remaining[0].id);
    } else {
      await handleNewConversation();
    }
  }
  // "running" means the worker claimed it, so the PC is on and Claude is
  // working. "pending" means nothing has picked it up yet — most likely the
  // PC is off, and it'll be answered whenever the worker next starts.
  const queuedOnly =
    waiting && !messages.some((m) => m.role === "user" && m.status === "running");

  // Al abrir: la lista de chats, y se entra al más reciente. Si no hay
  // ninguno todavía, se crea uno para poder empezar a escribir.
  useEffect(() => {
    getConversations()
      .then(async (rows) => {
        if (rows.length > 0) {
          setConversations(rows);
          setActiveId(rows[0].id);
          return;
        }
        const created = await createConversation();
        setConversations([created]);
        setActiveId(created.id);
      })
      .catch((err) => {
        report(err);
        setBootFailed(true);
      });
  }, []);

  // "Cargando" se deriva de qué conversación tiene ya sus mensajes, en vez
  // de encenderse a mano dentro del efecto.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    getMessages(activeId)
      .then((rows) => {
        if (cancelled) return;
        setMessages(rows);
      })
      .catch(report)
      .finally(() => {
        if (!cancelled) setLoadedFor(activeId);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // While the worker owes us an answer, keep checking for it — y de paso,
  // si sigue escuchando, para que el aviso de conexión no quede viejo.
  useEffect(() => {
    if (!waiting || !activeId) return;
    getWorkerLastSeen().then(setWorkerMs).catch(() => {});
    const timer = setInterval(() => {
      getMessages(activeId).then(setMessages).catch(report);
      getWorkerLastSeen().then(setWorkerMs).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, activeId]);

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
      if (!activeId) return;
      const text = content || "Archivá esta foto donde corresponda en NEXUS.";
      const row = await sendMessage(activeId, text, pendingImage?.path ?? null);
      setMessages((prev) => [...prev, row]);
      setDraft("");
      setPendingImage(null);
      // El título lo pone sendMessage si la conversación seguía sin nombre
      getConversations().then(setConversations).catch(() => {});
    } catch (err) {
      report(err);
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    setConfirmClear(false);
    if (!activeId) return;
    setMessages([]);
    try {
      await clearMessages(activeId);
    } catch (err) {
      report(err);
    }
  }

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? null;
  const loading = !bootFailed && (!activeId || loadedFor !== activeId);

  return (
    <div className="flex gap-4 w-full h-[calc(100dvh-13rem)] min-h-[460px]">
      {/* Historial fijo, solo en pantallas anchas */}
      <aside className="hidden lg:block w-[280px] shrink-0">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={setActiveId}
          onCreate={handleNewConversation}
          onRename={handleRename}
          onDelete={handleDeleteConversation}
        />
      </aside>

      <section className="relative flex flex-col flex-1 min-w-0 rounded-2xl bg-surface border border-border overflow-hidden">
        {/* Barra del chat: qué conversación es, historial y acciones */}
        <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-border">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="p-2 rounded-lg text-muted hover:bg-surface-hover transition-colors lg:hidden shrink-0"
            aria-label="Historial de chats"
          >
            <History className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-semibold truncate">
              {activeConversation?.title ?? "Chat"}
            </h2>
            <p className="text-xs text-muted truncate">
              Claude lee y escribe en tus módulos de NEXUS
            </p>
          </div>
          <button
            onClick={handleNewConversation}
            className="lg:hidden p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors shrink-0"
            aria-label="Nueva conversación"
          >
            <Plus className="w-4 h-4" />
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => setConfirmClear(true)}
              className="p-2 rounded-lg text-muted hover:text-red-400 hover:bg-surface-hover transition-colors shrink-0"
              aria-label="Limpiar conversación"
              title="Limpiar conversación"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* En el teléfono el historial tapa el chat; en desktop va al costado */}
        {historyOpen && (
          <div className="absolute inset-0 z-20 lg:hidden">
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              onSelect={(id) => {
                setActiveId(id);
                setHistoryOpen(false);
              }}
              onCreate={handleNewConversation}
              onRename={handleRename}
              onDelete={handleDeleteConversation}
              onClose={() => setHistoryOpen(false)}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-[#131317] px-4 sm:px-6 py-5 flex flex-col gap-[18px]">
          {error && <p className="text-sm text-red-400">{error}</p>}

          {loading ? (
            <p className="text-sm text-muted">Cargando...</p>
          ) : messages.length === 0 ? (
            <div className="m-auto flex flex-col items-center text-center gap-3 max-w-sm">
              <span className="w-11 h-11 rounded-xl bg-surface-hover text-[#c4b5fd] flex items-center justify-center font-bold">
                N
              </span>
              <p className="text-sm text-muted">
                Escribe un gasto, una pregunta o pega una foto. Tiene acceso a tu
                horario, materias, proyectos, finanzas y tu perfil.
              </p>
            </div>
          ) : (
            messages.map((message) => {
              const mine = message.role === "user";
              const failed = message.status === "error";
              const image = message.image_path && (
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
              );

              if (mine) {
                return (
                  <div
                    key={message.id}
                    className="self-end max-w-[85%] sm:max-w-[70%] px-[15px] py-[11px] rounded-[16px_16px_4px_16px] bg-primary text-white text-sm leading-relaxed whitespace-pre-wrap break-words"
                  >
                    {image}
                    {message.content}
                  </div>
                );
              }

              return (
                <div key={message.id} className="flex gap-3 max-w-[90%] sm:max-w-[78%]">
                  <span
                    className={`w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0 text-[13px] font-bold ${
                      failed ? "bg-red-400/15 text-red-400" : "bg-surface-hover text-[#c4b5fd]"
                    }`}
                  >
                    {failed ? <AlertCircle className="w-4 h-4" /> : "N"}
                  </span>
                  <div
                    className={`min-w-0 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      failed
                        ? "px-3.5 py-2.5 rounded-xl bg-red-400/10 text-red-400"
                        : "pt-1"
                    }`}
                  >
                    {image}
                    {message.content}
                  </div>
                </div>
              );
            })
          )}

          {waiting && (
            <div className="flex gap-3 max-w-[90%] sm:max-w-[78%]">
              <span className="w-[30px] h-[30px] rounded-[9px] bg-surface-hover text-[#c4b5fd] flex items-center justify-center shrink-0 text-[13px] font-bold">
                {queuedOnly ? <Clock className="w-4 h-4 text-amber-400" /> : "N"}
              </span>
              <div className="px-3.5 py-2.5 rounded-xl bg-surface border border-dashed border-[#3f3f48]">
                {queuedOnly ? (
                  <div className="flex items-start gap-2">
                    <div>
                      <p className="text-sm">En cola</p>
                      <p className="text-xs text-muted mt-0.5">
                        Se responde sola en cuanto se pueda: cuando tu PC esté
                        encendida y Claude esté disponible. Si está topado el
                        uso, reintenta solo. Podés cerrar esto, no se pierde.
                      </p>

                      {workerMs !== null && workerMs < WORKER_ONLINE_MS ? (
                        <p className="flex items-center gap-1.5 text-xs text-emerald-400 mt-2">
                          <Wifi className="w-3.5 h-3.5 shrink-0" />
                          Tu PC está escuchando — se responde en cualquier momento.
                        </p>
                      ) : (
                        <p className="flex items-center gap-1.5 text-xs text-amber-400 mt-2">
                          <WifiOff className="w-3.5 h-3.5 shrink-0" />
                          {workerMs === null
                            ? "No detecto tu PC escuchando."
                            : `Tu PC no responde (última señal ${formatAgo(workerMs)}).`}{" "}
                          Corré{" "}
                          <code className="bg-surface-hover px-1 py-0.5 rounded">
                            npm run worker
                          </code>{" "}
                          ahí.
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-1.5">
                        <button
                          onClick={checkWorker}
                          disabled={checkingWorker}
                          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted hover:text-primary hover:bg-surface-hover transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${checkingWorker ? "animate-spin" : ""}`} />
                          {checkingWorker ? "Revisando..." : "Reintentar conexión"}
                        </button>
                        <CancelButton onClick={handleCancel} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1" aria-hidden="true">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-hover animate-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-hover/70 animate-pulse [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-hover/40 animate-pulse [animation-delay:300ms]" />
                    </span>
                    <span className="text-sm text-muted">Pensando…</span>
                    <CancelButton onClick={handleCancel} />
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="px-3 sm:px-5 pt-3 pb-4 border-t border-border flex flex-col gap-2.5">
          {!draft && !pendingImage && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="px-3 py-1.5 rounded-full border border-[#2f2f37] text-xs text-[#d4d4d8] hover:border-primary hover:text-foreground whitespace-nowrap transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {pendingImage && (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-background border border-border">
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

          <div className="flex items-end gap-2.5 p-2 rounded-[14px] bg-background border border-[#3a3a44] focus-within:border-primary transition-colors">
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
              className="w-11 h-11 rounded-[10px] bg-surface-hover text-muted hover:text-foreground flex items-center justify-center disabled:opacity-40 shrink-0 transition-colors"
              aria-label="Adjuntar foto"
            >
              {uploading ? (
                <Loader2 className="w-[18px] h-[18px] animate-spin" />
              ) : (
                <Paperclip className="w-[18px] h-[18px]" />
              )}
            </button>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder="Escribe un gasto, una pregunta o pega una foto…"
              className="flex-1 min-w-0 resize-none bg-transparent outline-none text-sm leading-relaxed py-3 px-1 max-h-40 placeholder:text-muted"
            />
            <button
              onClick={() => handleSend()}
              disabled={sending || (!draft.trim() && !pendingImage)}
              className="w-11 h-11 rounded-[10px] bg-primary hover:bg-primary-hover text-white flex items-center justify-center disabled:opacity-40 shrink-0 transition-colors"
              aria-label="Enviar"
            >
              <Send className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {confirmClear && (
          <ConfirmDialog
            title="Limpiar el chat"
            confirmLabel="Limpiar"
            message="Se borran los mensajes de esta conversación y Claude empieza de cero en ella. Los cambios que ya hizo en NEXUS se quedan."
            onConfirm={handleClear}
            onCancel={() => setConfirmClear(false)}
          />
        )}
      </section>
    </div>
  );
}

// Botón para cortar un mensaje que está en cola o corriendo. Se muestra
// dentro de la burbuja de espera, que es donde el ojo ya está mirando.
function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted hover:text-red-400 hover:bg-surface-hover transition-colors"
    >
      <Square className="w-3 h-3 fill-current" />
      Detener
    </button>
  );
}
