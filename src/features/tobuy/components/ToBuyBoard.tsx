import { useEffect, useState } from "react";
import { Plus, X, ChevronDown, ChevronRight } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import ConfirmDialog from "../../../components/ConfirmDialog";
import {
  getItems,
  getCategories,
  addItem,
  updateItem,
  deleteItem,
  reorderItems,
  addCategory,
  updateCategory,
  deleteCategory,
} from "../api";
import type { ToBuyCategoryRow, ToBuyItemRow } from "../types";
import ItemRow from "./ToBuyItemRow";

const DEFAULT_COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#ec4899",
  "#3b82f6",
  "#f97316",
];

const UNASSIGNED = "unassigned";

export default function ToBuyBoard() {
  const [categories, setCategories] = useState<ToBuyCategoryRow[]>([]);
  const [items, setItems] = useState<ToBuyItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [deletingColumn, setDeletingColumn] = useState<ToBuyCategoryRow | null>(
    null
  );

  const [quickAddColumn, setQuickAddColumn] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");

  useEffect(() => {
    Promise.all([getCategories(), getItems()])
      .then(([cats, allItems]) => {
        setCategories(cats);
        setItems(allItems);
      })
      .catch((err) => reportError(err))
      .finally(() => setLoading(false));
  }, []);

  function reportError(err: unknown) {
    setError(err instanceof Error ? err.message : "Something went wrong");
  }

  function toggleCollapsed(col: ToBuyCategoryRow) {
    const collapsed = !col.collapsed;
    setCategories((prev) =>
      prev.map((c) => (c.id === col.id ? { ...c, collapsed } : c))
    );
    updateCategory(col.id, { collapsed }).catch(reportError);
  }

  function startRenameColumn(col: ToBuyCategoryRow) {
    setEditingColumnId(col.id);
    setEditingColumnName(col.name);
  }

  function saveRenameColumn() {
    const id = editingColumnId;
    setEditingColumnId(null);
    if (!id) return;
    const name = editingColumnName.trim();
    if (!name) return;
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name } : c))
    );
    updateCategory(id, { name }).catch(reportError);
  }

  function addNewColumn() {
    const name = newColumnName.trim() || "Nueva categoría";
    const sortOrder = categories.length
      ? Math.max(...categories.map((c) => c.sort_order)) + 1
      : 0;
    const color = DEFAULT_COLORS[categories.length % DEFAULT_COLORS.length];
    setNewColumnName("");
    setAddingColumn(false);
    addCategory(name, color, sortOrder)
      .then((col) => setCategories((prev) => [...prev, col]))
      .catch(reportError);
  }

  async function confirmDeleteColumn() {
    const col = deletingColumn;
    setDeletingColumn(null);
    if (!col) return;

    setCategories((prev) => prev.filter((c) => c.id !== col.id));
    setItems((prev) =>
      prev.map((i) => (i.category_id === col.id ? { ...i, category_id: null } : i))
    );

    try {
      const orphaned = items.filter((i) => i.category_id === col.id);
      const base = items.filter((i) => !i.category_id && i.category_id !== col.id).length;
      if (orphaned.length) {
        await reorderItems(
          orphaned.map((i, idx) => ({
            id: i.id,
            category_id: null,
            sort_order: base + idx,
          }))
        );
      }
      await deleteCategory(col.id);
    } catch (err) {
      reportError(err);
    }
  }

  function startQuickAdd(columnId: string) {
    setQuickAddColumn(columnId);
    setQuickAddTitle("");
  }

  async function submitQuickAdd() {
    const columnId = quickAddColumn;
    const title = quickAddTitle.trim();
    setQuickAddColumn(null);
    setQuickAddTitle("");
    if (!columnId || !title) return;

    const categoryId = columnId === UNASSIGNED ? null : columnId;
    const sortOrder = items.filter((i) => i.category_id === categoryId).length;

    try {
      const row = await addItem({
        title,
        category_id: categoryId,
        sort_order: sortOrder,
      });
      setItems((prev) => [...prev, row]);
    } catch (err) {
      reportError(err);
    }
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const { source, destination } = result;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    setItems((prev) => {
      const colId = (d: string) => (d === UNASSIGNED ? null : d);
      const byCol = (columnId: string | null) =>
        prev
          .filter((i) => i.category_id === columnId)
          .sort((a, b) => a.sort_order - b.sort_order);

      const sourceColId = colId(source.droppableId);
      const destColId = colId(destination.droppableId);

      const sourceList = byCol(sourceColId);
      const [moved] = sourceList.splice(source.index, 1);
      if (!moved) return prev;
      const destList =
        sourceColId === destColId ? sourceList : byCol(destColId);
      destList.splice(destination.index, 0, {
        ...moved,
        category_id: destColId,
      });

      const touched =
        sourceColId === destColId ? [destList] : [sourceList, destList];
      const updates: { id: string; category_id: string | null; sort_order: number }[] =
        [];
      const byId = new Map(prev.map((i) => [i.id, i]));

      touched.forEach((list) => {
        list.forEach((item, i) => {
          const updated = { ...item, sort_order: i };
          byId.set(item.id, updated);
          updates.push({
            id: item.id,
            category_id: updated.category_id,
            sort_order: i,
          });
        });
      });

      reorderItems(updates).catch(reportError);

      return Array.from(byId.values());
    });
  }

  const handleToggle = async (id: string, checked: boolean) => {
    try {
      const updated = await updateItem(id, { checked });
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch (err) {
      reportError(err);
    }
  };

  const handleRename = async (id: string, title: string) => {
    try {
      const updated = await updateItem(id, { title });
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch (err) {
      reportError(err);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      reportError(err);
    }
  };

  if (loading) return <p className="text-sm text-muted">Loading...</p>;

  const columns: { id: string; name: string; color: string | null; collapsed: boolean; deletable: boolean }[] = [
    { id: UNASSIGNED, name: "Sin categoría", color: null, collapsed: false, deletable: false },
    ...categories
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        collapsed: c.collapsed,
        deletable: true,
      })),
  ];

  return (
    <div>
      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex items-start gap-4 overflow-x-auto pb-2">
          {columns.map((column) => {
            const columnItems = items
              .filter((i) => (column.id === UNASSIGNED ? !i.category_id : i.category_id === column.id))
              .sort((a, b) => a.sort_order - b.sort_order);
            const pendingCount = columnItems.filter((i) => !i.checked).length;

            if (column.collapsed) {
              return (
                <button
                  key={column.id}
                  onClick={() =>
                    toggleCollapsed(categories.find((c) => c.id === column.id)!)
                  }
                  title={column.name}
                  className="flex flex-col items-center gap-2 py-3 px-1.5 w-10 flex-shrink-0 bg-surface/60 border border-border rounded-xl hover:border-primary transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
                  <span
                    className="text-xs font-semibold text-foreground truncate max-h-40"
                    style={{ writingMode: "vertical-rl" }}
                  >
                    {column.name}
                  </span>
                  <span className="text-[10px] text-muted flex-shrink-0">
                    {pendingCount}
                  </span>
                </button>
              );
            }

            return (
              <div
                key={column.id}
                className="bg-surface/60 border border-border rounded-xl w-72 flex-shrink-0 flex flex-col"
              >
                <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border">
                  {column.color && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: column.color }}
                    />
                  )}
                  {editingColumnId === column.id ? (
                    <input
                      autoFocus
                      value={editingColumnName}
                      onChange={(e) => setEditingColumnName(e.target.value)}
                      onBlur={saveRenameColumn}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRenameColumn();
                        if (e.key === "Escape") setEditingColumnId(null);
                      }}
                      className="flex-1 min-w-0 bg-background border border-primary rounded px-2 py-1 text-sm focus:outline-none"
                    />
                  ) : column.deletable ? (
                    <button
                      onClick={() =>
                        startRenameColumn(categories.find((c) => c.id === column.id)!)
                      }
                      className="flex-1 min-w-0 text-left text-sm font-semibold truncate"
                    >
                      {column.name}
                    </button>
                  ) : (
                    <span className="flex-1 min-w-0 text-sm font-semibold text-muted truncate">
                      {column.name}
                    </span>
                  )}
                  <span className="text-xs text-muted flex-shrink-0">
                    {pendingCount}
                  </span>
                  {column.deletable && (
                    <button
                      onClick={() =>
                        toggleCollapsed(categories.find((c) => c.id === column.id)!)
                      }
                      className="p-1 text-muted hover:text-foreground flex-shrink-0"
                      title="Minimizar"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  )}
                  {column.deletable && (
                    <button
                      onClick={() =>
                        setDeletingColumn(categories.find((c) => c.id === column.id)!)
                      }
                      className="p-1 text-muted hover:text-red-400 flex-shrink-0"
                      title="Eliminar categoría"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <Droppable droppableId={column.id}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex flex-col gap-2 p-2.5 min-h-[48px]"
                    >
                      {columnItems.map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(dragProvided, snapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={snapshot.isDragging ? "shadow-lg" : ""}
                            >
                              <ItemRow
                                item={item}
                                onToggle={(checked) => handleToggle(item.id, checked)}
                                onRename={(title) => handleRename(item.id, title)}
                                onDelete={() => handleDeleteItem(item.id)}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {quickAddColumn === column.id ? (
                        <input
                          autoFocus
                          value={quickAddTitle}
                          onChange={(e) => setQuickAddTitle(e.target.value)}
                          onBlur={submitQuickAdd}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitQuickAdd();
                            if (e.key === "Escape") setQuickAddColumn(null);
                          }}
                          placeholder="Item title"
                          className="bg-background border border-primary rounded px-2.5 py-1.5 text-sm focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => startQuickAdd(column.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted hover:text-primary transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add item
                        </button>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}

          {addingColumn ? (
            <div className="w-72 flex-shrink-0 bg-surface border border-border rounded-xl p-3 flex flex-col gap-2">
              <input
                autoFocus
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addNewColumn();
                  if (e.key === "Escape") setAddingColumn(false);
                }}
                placeholder="Nombre de la categoría"
                className="bg-background border border-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setAddingColumn(false)}
                  className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={addNewColumn}
                  className="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded hover:bg-primary/90 transition-colors"
                >
                  Agregar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingColumn(true)}
              className="w-72 flex-shrink-0 border border-dashed border-border rounded-xl flex items-center justify-center gap-2 text-muted hover:border-primary hover:text-primary transition-colors py-4"
            >
              <Plus className="w-4 h-4" />
              Agregar categoría
            </button>
          )}
        </div>
      </DragDropContext>

      {deletingColumn && (
        <ConfirmDialog
          title="Delete category"
          message={`Delete "${deletingColumn.name}"? Its items move to "Sin categoría".`}
          onConfirm={confirmDeleteColumn}
          onCancel={() => setDeletingColumn(null)}
        />
      )}
    </div>
  );
}
