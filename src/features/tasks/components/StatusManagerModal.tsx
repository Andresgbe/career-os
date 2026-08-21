import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { STATUS_COLOR_PRESETS, type TaskStatusRow } from "../types";

interface StatusManagerModalProps {
  statuses: TaskStatusRow[];
  onClose: () => void;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRecolor: (id: string, color: string) => void;
  onToggleDone: (id: string, isDone: boolean) => void;
  onDelete: (id: string) => void;
}

export default function StatusManagerModal({
  statuses,
  onClose,
  onAdd,
  onRename,
  onRecolor,
  onToggleDone,
  onDelete,
}: StatusManagerModalProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  function startRename(s: TaskStatusRow) {
    setEditingId(s.id);
    setEditingName(s.name);
  }

  function saveRename() {
    const id = editingId;
    setEditingId(null);
    if (!id) return;
    const name = editingName.trim();
    if (!name) return;
    onRename(id, name);
  }

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    onAdd(name);
    setNewName("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl p-5 w-full max-w-sm max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Estados de tareas</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-muted hover:bg-surface-hover"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-2">
          {statuses.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2"
            >
              <div className="flex gap-1 flex-shrink-0">
                {STATUS_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => onRecolor(s.id, c)}
                    className={`w-4 h-4 rounded-full ${
                      s.color === c ? "ring-2 ring-offset-1 ring-offset-background ring-foreground" : ""
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>

              {editingId === s.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={saveRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 min-w-0 bg-surface border border-primary rounded px-2 py-1 text-sm focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => startRename(s)}
                  className="flex-1 min-w-0 text-left text-sm truncate"
                >
                  {s.name}
                </button>
              )}

              <label className="flex items-center gap-1.5 text-[11px] text-muted flex-shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={s.is_done}
                  onChange={(e) => onToggleDone(s.id, e.target.checked)}
                  className="w-3.5 h-3.5 accent-primary"
                />
                Completa
              </label>

              <button
                onClick={() => onDelete(s.id)}
                disabled={statuses.length <= 1}
                className="p-1 rounded text-muted hover:text-red-400 hover:bg-surface-hover disabled:opacity-30 disabled:hover:text-muted flex-shrink-0"
                title="Eliminar estado"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
          <input
            type="text"
            placeholder="Nuevo estado..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleAdd}
            className="p-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors flex-shrink-0"
            title="Agregar"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
