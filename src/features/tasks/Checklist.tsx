import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { newChecklistItem, type ChecklistItem } from "./types";

/** Lista de subtareas: marcar, agregar y quitar. Controlada por el padre. */
export default function Checklist({
  items,
  onChange,
  compact = false,
}: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  compact?: boolean;
}) {
  const [text, setText] = useState("");

  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([...items, newChecklistItem(t)]);
    setText("");
  };

  return (
    <div className="space-y-1">
      {items.map((it) => (
        <div key={it.id} className="group/item flex items-start gap-2">
          <button
            type="button"
            onClick={() => onChange(items.map((i) => (i.id === it.id ? { ...i, done: !i.done } : i)))}
            aria-label={it.done ? "Desmarcar" : "Marcar"}
            className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
              it.done ? "bg-emerald-500 border-emerald-500" : "border-muted/50 hover:border-primary"
            }`}
          >
            {it.done && <Check className="w-3 h-3 text-white" />}
          </button>
          <span className={`flex-1 text-sm break-words ${it.done ? "line-through text-muted" : ""}`}>{it.text}</span>
          <button
            type="button"
            onClick={() => onChange(items.filter((i) => i.id !== it.id))}
            aria-label="Quitar subtarea"
            className="p-0.5 rounded text-muted opacity-60 sm:opacity-0 group-hover/item:opacity-100 hover:text-red-400 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <div className={`flex items-center gap-2 ${compact ? "pt-1" : "pt-1.5"}`}>
        <Plus className="w-4 h-4 text-muted shrink-0" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder="Agregar subtarea…"
          maxLength={200}
          className="flex-1 bg-transparent text-sm placeholder:text-muted/60 focus:outline-none"
        />
      </div>
    </div>
  );
}
