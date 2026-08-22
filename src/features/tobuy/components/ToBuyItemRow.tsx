import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import type { ToBuyItemRow } from "../types";

interface ToBuyItemRowProps {
  item: ToBuyItemRow;
  onToggle: (checked: boolean) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}

// One shopping-list row inside a category column: a checkbox to mark it
// bought, click-to-edit title text, delete on hover. Draggable wrapper
// lives in the parent board.
export default function ToBuyItemRow({
  item,
  onToggle,
  onRename,
  onDelete,
}: ToBuyItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);

  const startEdit = () => {
    setTitle(item.title);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const trimmed = title.trim();
    if (trimmed && trimmed !== item.title) onRename(trimmed);
  };

  return (
    <div className="group flex items-center gap-2 bg-surface border border-border rounded-lg px-2.5 py-2 hover:border-primary/40 transition-colors">
      <button
        onClick={() => onToggle(!item.checked)}
        className={`shrink-0 w-4 h-4 rounded flex items-center justify-center border transition-colors ${
          item.checked
            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
            : "border-border text-transparent hover:border-primary"
        }`}
        title={item.checked ? "Mark as not bought" : "Mark as bought"}
      >
        <Check className="w-3 h-3" />
      </button>

      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="flex-1 min-w-0 bg-background border border-primary rounded px-1.5 py-0.5 text-sm outline-none"
        />
      ) : (
        <span
          onClick={startEdit}
          className={`flex-1 min-w-0 text-sm truncate cursor-text ${
            item.checked ? "line-through text-muted" : "text-foreground"
          }`}
        >
          {item.title}
        </span>
      )}

      <button
        onClick={onDelete}
        className="shrink-0 p-1 rounded text-muted opacity-0 group-hover:opacity-100 hover:bg-surface-hover hover:text-red-400 transition-all"
        title="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
