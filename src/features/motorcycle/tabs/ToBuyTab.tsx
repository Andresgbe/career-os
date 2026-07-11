import { useState } from "react";
import { Plus, ExternalLink, Trash2 } from "lucide-react";
import { mockToBuy } from "../mockData";
import type { ToBuyItem } from "../types";

export default function ToBuyTab() {
  const [items, setItems] = useState<ToBuyItem[]>(mockToBuy);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const add = () => {
    if (!name.trim()) return;
    setItems([
      ...items,
      { id: crypto.randomUUID(), name, referenceUrl: url, status: "pending" },
    ]);
    setName("");
    setUrl("");
  };

  const toggleStatus = (id: string) =>
    setItems(
      items.map((i) =>
        i.id === id
          ? { ...i, status: i.status === "pending" ? "purchased" : "pending" }
          : i
      )
    );

  const remove = (id: string) => setItems(items.filter((i) => i.id !== id));

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-xl divide-y divide-border">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-4">
            <button
              onClick={() => toggleStatus(item.id)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                item.status === "purchased"
                  ? "bg-primary/20 text-primary"
                  : "bg-surface-hover text-muted"
              }`}
            >
              {item.status === "purchased" ? "Purchased" : "Pending"}
            </button>

            <span
              className={item.status === "purchased" ? "text-muted line-through" : ""}
            >
              {item.name}
            </span>

            <div className="ml-auto flex items-center gap-2">
              {item.referenceUrl && (
                <a
                  href={item.referenceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded text-muted hover:bg-surface-hover"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
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

      {/* Add new item */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          placeholder="Item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none flex-1"
        />
        <input
          placeholder="Reference link (optional)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none flex-1"
        />
        <button
          onClick={add}
          className="flex items-center gap-1 px-3 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>
    </div>
  );
}