import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import type { CategoryRow } from "../types";
import { isDone } from "../types";
import { CATEGORY_COLORS } from "../useContentStudio";
import type { ContentStudio } from "../useContentStudio";

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`w-7 h-7 rounded-full transition-transform ${
            value === c ? "ring-2 ring-white/80 ring-offset-2 ring-offset-surface scale-110" : "hover:scale-110"
          }`}
          style={{ backgroundColor: c }}
          aria-label={c}
        />
      ))}
    </div>
  );
}

// Manage the categories (board columns): name, color, and how many ideas
// each one holds.
export default function CategoriesTab({ studio }: { studio: ContentStudio }) {
  const { categories, ideas } = studio;

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[0]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);

  const handleAdd = () => {
    if (!newName.trim()) return;
    studio.createCategory(newName.trim(), newColor);
    setNewName("");
    const idx = CATEGORY_COLORS.indexOf(newColor);
    setNewColor(CATEGORY_COLORS[(idx + 1) % CATEGORY_COLORS.length]);
  };

  const saveEdit = () => {
    if (!editId || !editName.trim()) return;
    studio.editCategory(editId, { name: editName.trim(), color: editColor });
    setEditId(null);
  };

  const sorted = categories.slice().sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-5 items-start">
      <section className="rounded-3xl border border-border bg-surface p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold">Nueva categoría</h2>
          <p className="text-sm text-muted mt-1">Cada categoría es una columna del tablero de ideas.</p>
        </div>
        <input
          type="text"
          placeholder="Nombre (ej. Tutoriales, Opinión, Behind the scenes)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="w-full bg-background/60 border border-border rounded-xl px-3.5 py-2.5 text-sm focus:border-primary outline-none"
        />
        <ColorPicker value={newColor} onChange={setNewColor} />
        <div className="flex items-center justify-between gap-3">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
            style={{ backgroundColor: newColor + "26", color: newColor }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: newColor }} />
            {newName.trim() || "Vista previa"}
          </span>
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-6 space-y-4">
        <h2 className="text-lg font-bold">
          Tus categorías <span className="text-muted font-normal">· {categories.length}</span>
        </h2>

        {sorted.length === 0 ? (
          <p className="text-sm text-muted">Aún no hay categorías. Crea una para ordenar tus ideas.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-2.5">
            {sorted.map((cat) => {
              const inCat = ideas.filter((i) => i.category_id === cat.id);
              const done = inCat.filter(isDone).length;
              return (
                <li
                  key={cat.id}
                  className="relative flex items-center gap-3 rounded-2xl border border-border bg-background/50 p-3.5 overflow-hidden"
                >
                  <span className="absolute left-0 inset-y-0 w-1" style={{ backgroundColor: cat.color }} />
                  {editId === cat.id ? (
                    <div className="flex flex-col gap-3 flex-1 min-w-0">
                      <input
                        autoFocus
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") setEditId(null);
                        }}
                        className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm focus:border-primary outline-none"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <ColorPicker value={editColor} onChange={setEditColor} />
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={saveEdit} className="p-1.5 rounded-lg text-emerald-400 hover:bg-surface-hover" title="Guardar">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg text-muted hover:bg-surface-hover" title="Cancelar">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0 pl-1.5">
                        <p className="text-sm font-semibold truncate">{cat.name}</p>
                        <p className="text-xs text-muted">
                          {inCat.length} {inCat.length === 1 ? "idea" : "ideas"} · {done} terminadas
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setEditId(cat.id);
                          setEditName(cat.name);
                          setEditColor(cat.color);
                        }}
                        className="p-1.5 rounded-lg text-muted hover:bg-surface-hover hover:text-primary-hover transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleting(cat)}
                        className="p-1.5 rounded-lg text-muted hover:bg-surface-hover hover:text-red-400 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {deleting && (
        <ConfirmDialog
          title="Eliminar categoría"
          confirmLabel="Eliminar"
          message={`Se elimina "${deleting.name}". Sus ideas pasan a "Sin categoría".`}
          onConfirm={() => {
            studio.removeCategory(deleting.id);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
