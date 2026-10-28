import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import type { BoardTaskRow } from "../types";

interface BoardTaskModalProps {
  task: BoardTaskRow;
  onClose: () => void;
  onSave: (fields: Pick<BoardTaskRow, "title" | "tag" | "assignee" | "due">) => void;
  onDelete: () => void;
}

// Edits one board task: its title plus the optional label, owner and date
// shown on the card.
export default function BoardTaskModal({ task, onClose, onSave, onDelete }: BoardTaskModalProps) {
  const [title, setTitle] = useState(task.title);
  const [tag, setTag] = useState(task.tag);
  const [assignee, setAssignee] = useState(task.assignee);
  const [due, setDue] = useState(task.due ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const input =
    "w-full h-10 px-3 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary";

  function save() {
    if (!title.trim()) return;
    onSave({ title: title.trim(), tag: tag.trim(), assignee: assignee.trim(), due: due || null });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-surface border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Tarea</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Título</span>
            <textarea
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary resize-none"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Etiqueta</span>
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Pagos, Diseño..."
                className={input}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Responsable</span>
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Nombre"
                className={input}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Fecha</span>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={input} />
          </label>
        </div>

        <footer className="flex items-center gap-2 px-5 py-4 border-t border-border">
          {confirmingDelete ? (
            <>
              <span className="text-sm text-red-400 flex-1">¿Eliminar esta tarea?</span>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="px-3 py-2 rounded-lg text-sm text-muted hover:text-foreground"
              >
                No
              </button>
              <button
                onClick={onDelete}
                className="px-3 py-2 rounded-lg bg-red-500/15 text-red-400 text-sm font-medium hover:bg-red-500/25"
              >
                Eliminar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted hover:text-red-400 hover:bg-surface-hover"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
              <span className="flex-1" />
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-surface-hover text-sm font-medium hover:bg-border"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={!title.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-50"
              >
                Guardar
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
