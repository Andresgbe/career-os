import { useState } from "react";
import { Check, Plus, Camera, Trash2 } from "lucide-react";
import { mockOilChanges } from "../mockData";
import type { OilChange } from "../types";

export default function OilChangeTab() {
  const [items, setItems] = useState<OilChange[]>(mockOilChanges);
  const [newKm, setNewKm] = useState("");

  const toggle = (id: string) =>
    setItems(
      items.map((i) =>
        i.id === id
          ? {
              ...i,
              done: !i.done,
              date: !i.done ? new Date().toISOString().slice(0, 10) : null,
            }
          : i
      )
    );

  const addMilestone = () => {
    const km = parseInt(newKm);
    if (!km) return;
    setItems(
      [
        ...items,
        { id: crypto.randomUUID(), km, done: false, date: null, receiptUrl: null },
      ].sort((a, b) => a.km - b.km)
    );
    setNewKm("");
  };

  const remove = (id: string) => setItems(items.filter((i) => i.id !== id));

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-xl divide-y divide-border">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-4">
            <button
              onClick={() => toggle(item.id)}
              className={`w-6 h-6 rounded flex items-center justify-center border transition-colors ${
                item.done
                  ? "bg-primary border-primary"
                  : "border-border hover:border-primary"
              }`}
            >
              {item.done && <Check className="w-4 h-4 text-white" />}
            </button>

            <span
              className={`font-medium ${item.done ? "text-muted line-through" : ""}`}
            >
              {item.km.toLocaleString()} km
            </span>

            {item.date && (
              <span className="text-xs text-muted">{item.date}</span>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                disabled
                title="Photo upload available after Supabase setup"
                className="p-1.5 rounded text-muted hover:bg-surface-hover cursor-not-allowed"
              >
                <Camera className="w-4 h-4" />
              </button>
              <button
                onClick={() => remove(item.id)}
                className="p-1.5 rounded text-muted hover:bg-surface-hover"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add new milestone */}
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Add km milestone"
          value={newKm}
          onChange={(e) => setNewKm(e.target.value)}
          className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none w-48"
        />
        <button
          onClick={addMilestone}
          className="flex items-center gap-1 px-3 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>
    </div>
  );
}