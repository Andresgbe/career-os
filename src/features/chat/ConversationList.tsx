import { useState } from "react";
import { MessageSquare, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import ConfirmDialog from "../../components/ConfirmDialog";
import type { ConversationRow } from "./types";

interface ConversationListProps {
  conversations: ConversationRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (conversation: ConversationRow) => void;
  onClose?: () => void;
}

// El historial de conversaciones. En el teléfono se abre como panel sobre
// el chat; en desktop vive fijo al costado.
export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onClose,
}: ConversationListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<ConversationRow | null>(
    null
  );

  function commitRename(conversation: ConversationRow) {
    const title = draft.trim();
    setEditingId(null);
    if (title && title !== conversation.title) onRename(conversation.id, title);
  }

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <button
          onClick={onCreate}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded text-muted hover:bg-surface-hover lg:hidden"
            aria-label="Cerrar historial"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <ul className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {conversations.length === 0 && (
          <li className="text-xs text-muted p-3">Todavía no hay chats.</li>
        )}

        {conversations.map((conversation) => {
          const active = conversation.id === activeId;
          const editing = editingId === conversation.id;
          return (
            <li key={conversation.id}>
              {editing ? (
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(conversation);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 min-w-0 bg-background border border-border rounded px-2 py-1 text-sm outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => commitRename(conversation)}
                    className="p-1 rounded text-emerald-400 hover:bg-surface-hover"
                    aria-label="Guardar nombre"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors ${
                    active ? "bg-primary/15" : "hover:bg-surface-hover"
                  }`}
                >
                  <button
                    onClick={() => onSelect(conversation.id)}
                    className="flex-1 min-w-0 flex items-center gap-2 text-left"
                  >
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        active ? "text-primary" : "text-muted"
                      }`}
                    />
                    <span
                      className={`truncate text-sm ${active ? "text-primary" : ""}`}
                    >
                      {conversation.title}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(conversation.id);
                      setDraft(conversation.title);
                    }}
                    className="p-1 rounded text-muted hover:text-primary shrink-0"
                    aria-label="Renombrar"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(conversation)}
                    className="p-1 rounded text-muted hover:text-red-400 shrink-0"
                    aria-label="Eliminar chat"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {confirmDelete && (
        <ConfirmDialog
          title="Eliminar chat"
          message={`Se elimina "${confirmDelete.title}" con todos sus mensajes. Lo que Claude ya hizo en NEXUS (tareas, gastos, notas) se queda.`}
          confirmLabel="Eliminar"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            const target = confirmDelete;
            setConfirmDelete(null);
            onDelete(target);
          }}
        />
      )}
    </div>
  );
}
