import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Search } from "lucide-react";
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

const GROUPS = ["Hoy", "Ayer", "Esta semana", "Antes"] as const;

function groupOf(iso: string): (typeof GROUPS)[number] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const t = new Date(iso).getTime();
  const day = 86400000;
  if (t >= startOfToday.getTime()) return "Hoy";
  if (t >= startOfToday.getTime() - day) return "Ayer";
  if (t >= startOfToday.getTime() - 6 * day) return "Esta semana";
  return "Antes";
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return groupOf(iso) === "Hoy" || groupOf(iso) === "Ayer"
    ? d.toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("es-VE", { day: "numeric", month: "short" });
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
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<ConversationRow | null>(null);

  function commitRename(conversation: ConversationRow) {
    const title = draft.trim();
    setEditingId(null);
    if (title && title !== conversation.title) onRename(conversation.id, title);
  }

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? conversations.filter((c) => c.title.toLowerCase().includes(needle))
    : conversations;

  return (
    <div className="flex flex-col h-full gap-3 p-3.5 rounded-2xl bg-surface border border-border overflow-hidden">
      <div className="flex items-center gap-2">
        <button
          onClick={onCreate}
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-[10px] bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva conversación
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2.5 rounded-lg text-muted hover:bg-surface-hover lg:hidden"
            aria-label="Cerrar historial"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <label className="flex items-center gap-2 h-[38px] px-3 rounded-[10px] bg-background border border-border focus-within:border-primary transition-colors">
        <Search className="w-3.5 h-3.5 text-muted shrink-0" />
        <span className="sr-only">Buscar conversaciones</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar"
          className="flex-1 min-w-0 bg-transparent outline-none text-[13px]"
        />
      </label>

      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-3">
        {visible.length === 0 && (
          <p className="text-xs text-muted px-1 py-2">
            {conversations.length === 0 ? "Todavía no hay chats." : "Ningún chat coincide."}
          </p>
        )}

        {GROUPS.map((group) => {
          const items = visible.filter((c) => groupOf(c.updated_at) === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="space-y-1">
              <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8e8e98]">
                {group}
              </p>
              <ul className="space-y-1">
                {items.map((conversation) => {
                  const active = conversation.id === activeId;
                  const editing = editingId === conversation.id;
                  return (
                    <li key={conversation.id}>
                      {editing ? (
                        <div className="flex items-center gap-1 px-1 py-1">
                          <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(conversation);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="flex-1 min-w-0 bg-background border border-primary rounded-lg px-2.5 py-1.5 text-sm outline-none"
                          />
                          <button
                            onClick={() => commitRename(conversation)}
                            className="p-1.5 rounded text-emerald-400 hover:bg-surface-hover"
                            aria-label="Guardar nombre"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          className={`group flex items-center gap-1 rounded-[10px] border transition-colors ${
                            active
                              ? "bg-primary/15 border-primary/35"
                              : "border-transparent hover:bg-surface-hover"
                          }`}
                        >
                          <button
                            onClick={() => onSelect(conversation.id)}
                            className="flex-1 min-w-0 flex flex-col gap-0.5 text-left px-3 py-2.5"
                          >
                            <span className={`truncate text-[13px] ${active ? "font-semibold" : "font-medium"}`}>
                              {conversation.title}
                            </span>
                            <span className="text-xs text-muted">{timeOf(conversation.updated_at)}</span>
                          </button>
                          <div className="flex items-center pr-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingId(conversation.id);
                                setDraft(conversation.title);
                              }}
                              className="p-1.5 rounded text-muted hover:text-foreground"
                              aria-label="Renombrar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(conversation)}
                              className="p-1.5 rounded text-muted hover:text-red-400"
                              aria-label="Eliminar chat"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Eliminar chat"
          message={`Se elimina "${confirmDelete.title}" con todos sus mensajes. Lo que Claude ya hizo en NEXUS (gastos, notas) se queda.`}
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
