import { useEffect, useMemo, useState } from "react";
import { Bot, Pin, PinOff, Plus, Trash2, X } from "lucide-react";
import ConfirmDialog from "../../components/ConfirmDialog";
import { errorMessage } from "../../lib/errors";
import { renderMarkdown, TASK_MD_CLASS } from "../tasks/markdown";
import { addNote, deleteNote, getNotes, updateNote } from "./api";
import { sortNotes, type BuzonNote } from "./types";
import { timeAgo } from "../tasks/types";

const inputClass =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-primary";

const REFRESH_MS = 30000;

/** Notas que Andrés le deja al asistente (Markdown, se pueden fijar). */
export default function NotesView() {
  const [notes, setNotes] = useState<BuzonNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // null = cerrado, "new" = nota nueva, o la nota que se edita
  const [editing, setEditing] = useState<BuzonNote | "new" | null>(null);
  const [deleting, setDeleting] = useState<BuzonNote | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      getNotes()
        .then((r) => !cancelled && (setNotes(r), setError("")))
        .catch((e) => !cancelled && setError(errorMessage(e, "No pude cargar las notas")))
        .finally(() => !cancelled && setLoading(false));
    refresh();
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const sorted = useMemo(() => [...notes].sort(sortNotes), [notes]);
  const upsert = (n: BuzonNote) =>
    setNotes((prev) => (prev.some((x) => x.id === n.id) ? prev.map((x) => (x.id === n.id ? n : x)) : [n, ...prev]));

  async function togglePin(n: BuzonNote) {
    try {
      upsert(await updateNote(n.id, { pinned: !n.pinned }));
    } catch (e) {
      setError(errorMessage(e, "No pude fijar la nota"));
    }
  }

  async function remove(n: BuzonNote) {
    setDeleting(null);
    try {
      await deleteNote(n.id);
      setNotes((prev) => prev.filter((x) => x.id !== n.id));
    } catch (e) {
      setError(errorMessage(e, "No pude borrar la nota"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Notas para tu asistente: contexto, preferencias o cosas para que no olvide.</p>
        <button
          onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva nota
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted py-6">Cargando…</p>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <p className="text-sm text-muted">Todavía no hay notas. Crea la primera con "Nueva nota".</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((n) => (
            <li
              key={n.id}
              onClick={() => setEditing(n)}
              className="group cursor-pointer bg-surface border border-border hover:border-primary/50 rounded-xl p-4 flex flex-col gap-2 transition-colors min-h-[8rem]"
            >
              <div className="flex items-start gap-2">
                <h3 className="flex-1 text-sm font-semibold break-words">{n.title || "Sin título"}</h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin(n);
                  }}
                  aria-label={n.pinned ? "Desfijar" : "Fijar"}
                  className={`p-1 rounded transition ${
                    n.pinned ? "text-primary-hover" : "text-muted opacity-60 sm:opacity-0 group-hover:opacity-100 hover:text-foreground"
                  }`}
                >
                  {n.pinned ? <Pin className="w-4 h-4 fill-current" /> : <PinOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleting(n);
                  }}
                  aria-label="Borrar nota"
                  className="p-1 rounded text-muted opacity-60 sm:opacity-0 group-hover:opacity-100 hover:text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div
                className={`${TASK_MD_CLASS} text-xs text-muted max-h-40 overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]`}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(n.body) }}
              />
              <p className="mt-auto pt-1 flex items-center gap-1.5 text-[11px] text-muted">
                {n.updated_by === "agent" && <Bot className="w-3 h-3 text-primary-hover" />}
                {timeAgo(n.updated_at)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <NoteModal
          note={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(n) => {
            upsert(n);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Borrar nota"
          message={`¿Borrar "${deleting.title || "Sin título"}"? No se puede deshacer.`}
          confirmLabel="Borrar"
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function NoteModal({
  note,
  onClose,
  onSaved,
}: {
  note: BuzonNote | null;
  onClose: () => void;
  onSaved: (n: BuzonNote) => void;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!title.trim() && !body.trim()) {
      setError("Escribe un título o el contenido de la nota.");
      return;
    }
    setSaving(true);
    try {
      const fields = { title: title.trim(), body: body.trim(), pinned };
      onSaved(note ? await updateNote(note.id, fields) : await addNote(fields));
    } catch (e) {
      setError(errorMessage(e, "No pude guardar la nota"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="relative bg-surface border border-border rounded-xl p-4 sm:p-7 w-full max-w-4xl max-h-[92dvh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover"
        >
          <X className="w-4 h-4" />
        </button>
        <h3 className="text-lg font-semibold pr-8">{note ? "Editar nota" : "Nueva nota"}</h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título"
          maxLength={200}
          className={`${inputClass} text-base font-medium`}
          autoFocus={!note}
        />
        <div className="text-xs text-muted space-y-1">
          <div className="flex items-center justify-between">
            <span>Contenido (Markdown)</span>
            <span className="flex gap-1">
              {[false, true].map((p) => (
                <button
                  key={String(p)}
                  type="button"
                  onClick={() => setPreview(p)}
                  className={`px-2 py-0.5 rounded ${preview === p ? "bg-surface-hover text-foreground" : "hover:text-foreground"}`}
                >
                  {p ? "Vista previa" : "Escribir"}
                </button>
              ))}
            </span>
          </div>
          {preview ? (
            <div
              className={`${TASK_MD_CLASS} min-h-[12rem] sm:min-h-[20rem] rounded-lg border border-border bg-background px-3 py-2`}
              dangerouslySetInnerHTML={{ __html: body.trim() ? renderMarkdown(body) : "<p class='text-muted'>Nada que mostrar.</p>" }}
            />
          ) : (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Lo que quieres que tu asistente sepa o recuerde…"
              className={`${inputClass} resize-y sm:min-h-[20rem]`}
            />
          )}
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-primary" />
            Fijar arriba
          </label>
          <button
            onClick={save}
            disabled={saving}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
