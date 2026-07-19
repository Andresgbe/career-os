import { useEffect, useState } from "react";
import { Plus, ExternalLink, Trash2 } from "lucide-react";
import {
  getToBuyItems,
  addToBuyItem,
  updateToBuyStatus,
  deleteToBuyItem,
  type ToBuyRow,
} from "../api";

export default function ToBuyTab() {
  const [items, setItems] = useState<ToBuyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    getToBuyItems()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Error loading"))
      .finally(() => setLoading(false));
  }, []);

  const add = async () => {
    if (!name.trim()) return;
    try {
      const row = await addToBuyItem(name.trim(), url.trim());
      setItems([...items, row]);
      setName("");
      setUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error adding item");
    }
  };

  const toggleStatus = async (item: ToBuyRow) => {
    const newStatus = item.status === "pending" ? "purchased" : "pending";
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i))
    );
    try {
      await updateToBuyStatus(item.id, newStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error updating item");
    }
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await deleteToBuyItem(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error deleting item");
    }
  };

  if (loading) return <p className="text-muted">Loading...</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="bg-surface border border-border rounded-xl divide-y divide-border">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-4">
            <button
              onClick={() => toggleStatus(item)}
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
              {item.reference_url && (
                <a
                  href={item.reference_url}
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

        {items.length === 0 && (
          <p className="text-sm text-muted p-4">No items yet.</p>
        )}
      </div>

      {/* Add new item */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          placeholder="Item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none flex-1"
        />
        <input
          placeholder="Reference link (optional)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
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
