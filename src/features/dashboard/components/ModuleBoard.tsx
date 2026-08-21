import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, X, ChevronDown, ChevronRight } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { MODULES } from "../../../lib/modules";
import { addColumn, updateColumn, deleteColumn, reorderModulePositions } from "../api";
import type { ColumnRow, ModulePositionRow } from "../types";
import { useBoardContext } from "../BoardContext";

export default function ModuleBoard() {
  const { columns, positions, loading, loadError, setColumns, setPositions } =
    useBoardContext();
  const [error, setError] = useState("");

  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  function reportError(err: unknown) {
    setError(err instanceof Error ? err.message : "Something went wrong");
  }

  function toggleCollapsed(col: ColumnRow) {
    const collapsed = !col.collapsed;
    setColumns((prev) => prev.map((c) => (c.id === col.id ? { ...c, collapsed } : c)));
    updateColumn(col.id, { collapsed }).catch(reportError);
  }

  function startRenameColumn(col: ColumnRow) {
    setEditingColumnId(col.id);
    setEditingColumnName(col.name);
  }

  function saveRenameColumn() {
    const id = editingColumnId;
    setEditingColumnId(null);
    if (!id) return;
    const name = editingColumnName.trim();
    if (!name) return;
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    updateColumn(id, { name }).catch(reportError);
  }

  function addNewColumn() {
    const name = newColumnName.trim() || "Nueva columna";
    const sortOrder = columns.length ? Math.max(...columns.map((c) => c.sort_order)) + 1 : 0;
    setNewColumnName("");
    setAddingColumn(false);
    addColumn(name, sortOrder)
      .then((col) => setColumns((prev) => [...prev, col]))
      .catch(reportError);
  }

  async function handleDeleteColumn(col: ColumnRow) {
    if (columns.length <= 1) return;
    const remaining = columns.filter((c) => c.id !== col.id);
    const target = remaining[0];
    const targetCount = positions.filter((p) => p.column_id === target.id).length;
    const moved = positions
      .filter((p) => p.column_id === col.id)
      .map((p, i) => ({ id: p.id, column_id: target.id, sort_order: targetCount + i }));

    setColumns(remaining);
    setPositions((prev) =>
      prev.map((p) => {
        const m = moved.find((x) => x.id === p.id);
        return m ? { ...p, column_id: m.column_id, sort_order: m.sort_order } : p;
      })
    );

    try {
      if (moved.length) await reorderModulePositions(moved);
      await deleteColumn(col.id);
    } catch (err) {
      reportError(err);
    }
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    setPositions((prev) => {
      const byCol = (colId: string) =>
        prev.filter((p) => p.column_id === colId).sort((a, b) => a.sort_order - b.sort_order);

      const sourceColId = source.droppableId;
      const destColId = destination.droppableId;

      const sourceList = byCol(sourceColId);
      const [moved] = sourceList.splice(source.index, 1);
      if (!moved) return prev;
      const destList = sourceColId === destColId ? sourceList : byCol(destColId);
      destList.splice(destination.index, 0, { ...moved, column_id: destColId });

      const touched = sourceColId === destColId ? [destList] : [sourceList, destList];
      const updates: { id: string; column_id: string; sort_order: number }[] = [];
      const byId = new Map(prev.map((p) => [p.id, p]));

      touched.forEach((list) => {
        list.forEach((p, i) => {
          const updated = { ...p, sort_order: i };
          byId.set(p.id, updated);
          updates.push({ id: p.id, column_id: updated.column_id, sort_order: i });
        });
      });

      reorderModulePositions(updates).catch(reportError);

      return Array.from(byId.values());
    });
  }

  if (loading) return null;

  const board = columns
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((col) => ({
      column: col,
      items: positions
        .filter((p) => p.column_id === col.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => ({ position: p, module: MODULES.find((m) => m.id === p.module_id) }))
        .filter((x): x is { position: ModulePositionRow; module: (typeof MODULES)[number] } => !!x.module),
    }));

  return (
    <div>
      {(loadError || error) && (
        <p className="text-sm text-red-400 mb-3">{loadError || error}</p>
      )}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex items-start gap-4 overflow-x-auto pb-2">
          {board.map(({ column, items }) =>
            column.collapsed ? (
              <button
                key={column.id}
                onClick={() => toggleCollapsed(column)}
                title={column.name}
                className="flex flex-col items-center gap-2 py-3 px-1.5 w-10 flex-shrink-0 bg-surface/60 border border-border rounded-xl hover:border-primary transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
                <span
                  className="text-xs font-semibold text-foreground truncate max-h-40"
                  style={{ writingMode: "vertical-rl" }}
                >
                  {column.name || "Sin nombre"}
                </span>
                <span className="text-[10px] text-muted flex-shrink-0">{items.length}</span>
              </button>
            ) : (
              <div
                key={column.id}
                className="bg-surface/60 border border-border rounded-xl w-72 flex-shrink-0 flex flex-col"
              >
                <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border">
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
                  ) : (
                    <button
                      onClick={() => startRenameColumn(column)}
                      className="flex-1 min-w-0 text-left text-sm font-semibold truncate"
                    >
                      {column.name || "Sin nombre"}
                    </button>
                  )}
                  <span className="text-xs text-muted flex-shrink-0">{items.length}</span>
                  <button
                    onClick={() => toggleCollapsed(column)}
                    className="p-1 text-muted hover:text-foreground flex-shrink-0"
                    title="Minimizar"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {columns.length > 1 && (
                    <button
                      onClick={() => handleDeleteColumn(column)}
                      className="p-1 text-muted hover:text-red-400 flex-shrink-0"
                      title="Eliminar columna"
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
                      {items.map(({ position, module }, index) => {
                        const Icon = module.icon;
                        return (
                          <Draggable key={position.id} draggableId={position.id} index={index}>
                            {(dragProvided, snapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                              >
                                <Link
                                  to={module.path}
                                  className={`group flex items-center gap-3 bg-surface border rounded-lg p-3 hover:border-primary transition-colors ${
                                    snapshot.isDragging ? "border-primary shadow-lg" : "border-border"
                                  }`}
                                >
                                  <div className="p-1.5 rounded-lg bg-surface-hover group-hover:bg-primary/20 transition-colors flex-shrink-0">
                                    <Icon className="w-4 h-4 text-primary" />
                                  </div>
                                  <span className="text-sm font-medium truncate">{module.name}</span>
                                </Link>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                      {items.length === 0 && (
                        <div className="text-xs text-muted/50 text-center py-3">Soltá tarjetas acá</div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          )}

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
                placeholder="Nombre de la columna"
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
              Agregar columna
            </button>
          )}
        </div>
      </DragDropContext>
    </div>
  );
}
