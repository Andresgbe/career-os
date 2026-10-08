import { useState } from "react";
import { Plus, Check, Pencil, Trash2, Tags, X } from "lucide-react";
import { errorMessage } from "../../../lib/errors";
import ConfirmDialog from "../../../components/ConfirmDialog";
import { addCategory, deleteCategory, updateCategory } from "../flowApi";
import type { CategoryKind, FinanceCategoryRow } from "../flow";

interface CategoryManagerProps {
  categories: FinanceCategoryRow[];
  onChange: (categories: FinanceCategoryRow[]) => void;
}

const COLORS = [
  "#10b981", "#f59e0b", "#06b6d4", "#ef4444", "#f97316",
  "#8b5cf6", "#ec4899", "#3b82f6", "#a855f7", "#14b8a6",
  "#eab308", "#64748b",
];

const KIND_LABEL: Record<CategoryKind, string> = {
  expense: "Gasto",
  income: "Ingreso",
  both: "Ambos",
};

// Cada categoría se edita sola, nunca en un formulario compartido.
export default function CategoryManager({
  categories,
  onChange,
}: CategoryManagerProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<CategoryKind>("expense");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<FinanceCategoryRow | null>(
    null
  );
  const [error, setError] = useState("");

  function report(err: unknown) {
    setError(errorMessage(err, "Algo salió mal con las categorías"));
  }

  async function create() {
    const name = newName.trim();
    setAdding(false);
    setNewName("");
    if (!name) return;
    try {
      const created = await addCategory({
        name,
        kind: newKind,
        color: COLORS[categories.length % COLORS.length],
        sort_order: categories.length,
      });
      onChange([...categories, created]);
      setError("");
    } catch (err) {
      report(err);
    }
  }

  async function rename(category: FinanceCategoryRow) {
    const name = draftName.trim();
    setEditingId(null);
    if (!name || name === category.name) return;
    const previous = categories;
    onChange(categories.map((c) => (c.id === category.id ? { ...c, name } : c)));
    try {
      await updateCategory(category.id, { name });
    } catch (err) {
      onChange(previous);
      report(err);
    }
  }

  async function setColor(category: FinanceCategoryRow, color: string) {
    const previous = categories;
    onChange(categories.map((c) => (c.id === category.id ? { ...c, color } : c)));
    try {
      await updateCategory(category.id, { color });
    } catch (err) {
      onChange(previous);
      report(err);
    }
  }

  async function remove(category: FinanceCategoryRow) {
    setConfirmDelete(null);
    const previous = categories;
    onChange(categories.filter((c) => c.id !== category.id));
    try {
      await deleteCategory(category.id);
    } catch (err) {
      onChange(previous);
      report(err);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Tags className="w-4 h-4 text-primary" />
          Categorías ({categories.length})
        </h3>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted hover:text-primary hover:bg-surface-hover transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nueva
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {adding && (
        <div className="flex flex-wrap items-center gap-2 bg-background border border-border rounded-lg p-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Nombre"
            className="flex-1 min-w-[120px] bg-transparent text-sm outline-none px-1"
          />
          <select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as CategoryKind)}
            className="bg-surface border border-border rounded px-2 py-1 text-xs outline-none"
          >
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
            <option value="both">Ambos</option>
          </select>
          <button
            onClick={create}
            className="p-1 rounded text-emerald-400 hover:bg-surface-hover"
            aria-label="Crear categoría"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => setAdding(false)}
            className="p-1 rounded text-muted hover:bg-surface-hover"
            aria-label="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <ul className="space-y-1">
        {categories.map((category) => (
          <li
            key={category.id}
            className="group flex items-center gap-2 text-sm py-1.5 border-b border-border last:border-0"
          >
            <input
              type="color"
              value={category.color}
              onChange={(e) => setColor(category, e.target.value)}
              className="w-4 h-4 rounded shrink-0 bg-transparent border-0 cursor-pointer p-0"
              aria-label={`Color de ${category.name}`}
            />

            {editingId === category.id ? (
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={() => rename(category)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") rename(category);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="flex-1 min-w-0 bg-background border border-border rounded px-2 py-1 text-sm outline-none focus:border-primary"
              />
            ) : (
              <span className="flex-1 min-w-0 truncate">{category.name}</span>
            )}

            <span className="text-xs text-muted shrink-0">
              {KIND_LABEL[category.kind]}
            </span>

            <button
              onClick={() => {
                setEditingId(category.id);
                setDraftName(category.name);
              }}
              className="p-1 rounded text-muted hover:text-primary hover:bg-surface-hover shrink-0"
              aria-label={`Editar ${category.name}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(category)}
              className="p-1 rounded text-muted hover:text-red-400 hover:bg-surface-hover shrink-0"
              aria-label={`Eliminar ${category.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {confirmDelete && (
        <ConfirmDialog
          title="Eliminar categoría"
          message={`Se elimina "${confirmDelete.name}". Los movimientos que la tengan NO se borran: quedan como "Sin categoría".`}
          confirmLabel="Eliminar"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => remove(confirmDelete)}
        />
      )}
    </div>
  );
}
