import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { getCategories, addCategory, updateCategory, deleteCategory } from "../api";
import type { CategoryRow } from "../types";

const DEFAULT_COLORS = [
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#ef4444", // red
  "#10b981", // emerald
  "#ec4899", // pink
  "#3b82f6", // blue
  "#f97316", // orange
];

export default function CategoriesTab() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New category form
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]);
  const [adding, setAdding] = useState(false);

  // Inline editing
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) {
      setError("Enter a category name.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const row = await addCategory(newName.trim(), newColor);
      setCategories((prev) => [...prev, row]);
      setNewName("");
      // Cycle to next color
      const idx = DEFAULT_COLORS.indexOf(newColor);
      setNewColor(DEFAULT_COLORS[(idx + 1) % DEFAULT_COLORS.length]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error adding category");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (cat: CategoryRow) => {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
    setError("");
  };

  const cancelEdit = () => {
    setEditId(null);
  };

  const saveEdit = async () => {
    if (!editId || !editName.trim()) return;
    setError("");
    try {
      const updated = await updateCategory(editId, {
        name: editName.trim(),
        color: editColor,
      });
      setCategories((prev) =>
        prev.map((c) => (c.id === editId ? updated : c))
      );
      setEditId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating category");
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    try {
      await deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting category");
    }
  };

  return (
    <div className="space-y-6">
      {/* Add new category */}
      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-4">New Category</h2>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder="Category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none flex-1"
          />

          {/* Color picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Color:</span>
            <div className="flex gap-1.5">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full transition-all ${
                    newColor === c
                      ? "ring-2 ring-offset-2 ring-offset-background scale-110"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        {newName.trim() && (
          <div className="mb-4">
            <span className="text-xs text-muted mr-2">Preview:</span>
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{
                backgroundColor: newColor + "30",
                color: newColor,
              }}
            >
              {newName.trim()}
            </span>
          </div>
        )}

        <button
          onClick={handleAdd}
          disabled={adding}
          className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {adding ? "Adding..." : "Add category"}
        </button>
      </section>

      {/* Categories list */}
      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-4">Your Categories</h2>

        {loading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted">
            No categories yet. Create one above to organize your content ideas.
          </p>
        ) : (
          <ul className="space-y-2">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center gap-3 bg-background border border-border rounded-lg p-3"
              >
                {editId === cat.id ? (
                  /* ========== EDIT MODE ========== */
                  <div className="flex items-center gap-3 flex-1 flex-wrap">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      className="bg-surface border border-border rounded px-3 py-1.5 text-sm focus:border-primary outline-none flex-1 min-w-[120px]"
                    />
                    <div className="flex gap-1.5">
                      {DEFAULT_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setEditColor(c)}
                          className={`w-5 h-5 rounded-full transition-all ${
                            editColor === c
                              ? "ring-2 ring-offset-1 ring-offset-background scale-110"
                              : "hover:scale-110"
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={saveEdit}
                        className="p-1.5 rounded text-emerald-400 hover:bg-surface-hover transition-colors"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-1.5 rounded text-muted hover:bg-surface-hover transition-colors"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ========== VIEW MODE ========== */
                  <>
                    <span
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span
                      className="text-sm font-semibold px-3 py-0.5 rounded-full flex-1"
                      style={{
                        backgroundColor: cat.color + "20",
                        color: cat.color,
                      }}
                    >
                      {cat.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(cat)}
                        className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
