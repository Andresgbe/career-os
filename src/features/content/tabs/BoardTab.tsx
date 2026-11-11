import { useState } from "react";
import { Plus, X, ChevronDown, ChevronRight } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import ConfirmDialog from "../../../components/ConfirmDialog";
import type { CategoryRow, ContentIdeaRow } from "../types";
import { isDone } from "../types";
import IdeaCard from "../components/IdeaCard";
import { NO_CATEGORY_COLOR } from "../components/visuals";
import type { ContentStudio } from "../useContentStudio";

const UNASSIGNED = "unassigned";

interface BoardTabProps {
  studio: ContentStudio;
  onOpenIdea: (id: string) => void;
}

// Kanban of every idea still in production, one column per category.
// Finished ideas (all three steps ticked) move to "Publicadas".
export default function BoardTab({ studio, onOpenIdea }: BoardTabProps) {
  const { categories, ideas: allIdeas } = studio;
  const ideas = allIdeas.filter((i) => !isDone(i));

  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [deletingColumn, setDeletingColumn] = useState<CategoryRow | null>(null);
  const [deletingIdea, setDeletingIdea] = useState<ContentIdeaRow | null>(null);

  const [quickAddColumn, setQuickAddColumn] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");

  function saveRenameColumn() {
    const id = editingColumnId;
    setEditingColumnId(null);
    const name = editingColumnName.trim();
    if (id && name) studio.editCategory(id, { name });
  }

  function addNewColumn() {
    studio.createCategory(newColumnName.trim() || "Nueva categoría");
    setNewColumnName("");
    setAddingColumn(false);
  }

  function submitQuickAdd() {
    const columnId = quickAddColumn;
    const title = quickAddTitle.trim();
    setQuickAddColumn(null);
    setQuickAddTitle("");
    if (!columnId || !title) return;
    studio.createIdea({ title, category_id: columnId === UNASSIGNED ? null : columnId });
  }

  function handleDragEnd(result: DropResult) {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const colId = (d: string) => (d === UNASSIGNED ? null : d);
    const byCol = (columnId: string | null) =>
      ideas
        .filter((i) => i.category_id === columnId)
        .sort((a, b) => a.sort_order - b.sort_order);

    const sourceColId = colId(source.droppableId);
    const destColId = colId(destination.droppableId);
    const sourceList = byCol(sourceColId);
    const [moved] = sourceList.splice(source.index, 1);
    if (!moved) return;
    const destList = sourceColId === destColId ? sourceList : byCol(destColId);
    destList.splice(destination.index, 0, { ...moved, category_id: destColId });

    const touched = sourceColId === destColId ? [destList] : [sourceList, destList];
    studio.applyBoardOrder(
      touched.flatMap((list) =>
        list.map((idea, i) => ({ id: idea.id, category_id: idea.category_id, sort_order: i }))
      )
    );
  }

  const columns = [
    { id: UNASSIGNED, name: "Sin categoría", color: NO_CATEGORY_COLOR, collapsed: false, category: null as CategoryRow | null },
    ...categories
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({ id: c.id, name: c.name, color: c.color, collapsed: c.collapsed, category: c as CategoryRow | null })),
  ];

  return (
    <div className="space-y-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex items-start gap-3.5 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0">
          {columns.map((column) => {
            const items = ideas
              .filter((i) => (column.id === UNASSIGNED ? !i.category_id : i.category_id === column.id))
              .sort((a, b) => a.sort_order - b.sort_order);
            const cat = column.category;

            if (column.collapsed && cat) {
              return (
                <button
                  key={column.id}
                  onClick={() => studio.editCategory(cat.id, { collapsed: false })}
                  title={column.name}
                  className="flex flex-col items-center gap-2.5 py-4 px-1.5 w-12 flex-shrink-0 bg-[#131317] border border-border rounded-2xl hover:border-primary transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: column.color }} />
                  <span className="text-xs font-semibold truncate max-h-48" style={{ writingMode: "vertical-rl" }}>
                    {column.name}
                  </span>
                  <span className="text-[10px] text-muted flex-shrink-0">{items.length}</span>
                </button>
              );
            }

            return (
              <div
                key={column.id}
                className="relative bg-[#121216] border border-border rounded-3xl w-[84vw] max-w-[320px] sm:w-[320px] flex-shrink-0 flex flex-col p-3 gap-3 overflow-hidden"
              >
                <span
                  className="absolute inset-x-0 top-0 h-16 pointer-events-none opacity-60"
                  style={{ background: `linear-gradient(180deg, ${column.color}1f, transparent)` }}
                />
                <div className="relative flex items-center gap-2 px-1.5 pt-1">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
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
                      className="flex-1 min-w-0 bg-background border border-primary rounded-lg px-2 py-1 text-sm focus:outline-none"
                    />
                  ) : cat ? (
                    <button
                      onClick={() => {
                        setEditingColumnId(cat.id);
                        setEditingColumnName(cat.name);
                      }}
                      className="flex-1 min-w-0 text-left text-[15px] font-semibold truncate"
                      title="Renombrar"
                    >
                      {column.name}
                    </button>
                  ) : (
                    <span className="flex-1 min-w-0 text-[15px] font-semibold text-muted truncate">{column.name}</span>
                  )}
                  <span className="text-xs font-semibold text-muted px-2 py-0.5 rounded-full bg-white/5 flex-shrink-0 tabular-nums">
                    {items.length}
                  </span>
                  {cat && (
                    <>
                      <button
                        onClick={() => studio.editCategory(cat.id, { collapsed: true })}
                        className="p-1 rounded-md text-muted hover:text-foreground hover:bg-white/5 flex-shrink-0"
                        title="Minimizar"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingColumn(cat)}
                        className="p-1 rounded-md text-muted hover:text-red-400 hover:bg-white/5 flex-shrink-0"
                        title="Eliminar categoría"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`relative flex flex-col gap-2.5 min-h-[60px] rounded-2xl transition-colors ${
                        snapshot.isDraggingOver ? "bg-primary/5" : ""
                      }`}
                    >
                      {items.map((idea, index) => (
                        <Draggable key={idea.id} draggableId={idea.id} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={dragSnapshot.isDragging ? "rotate-[1.5deg] shadow-2xl" : ""}
                            >
                              <IdeaCard
                                idea={idea}
                                category={categories.find((c) => c.id === idea.category_id)}
                                onClick={() => onOpenIdea(idea.id)}
                                onDelete={() => setDeletingIdea(idea)}
                                onToggleStatus={(field, value) => studio.toggleStep(idea.id, field, value)}
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
                          placeholder="Título de la idea, Enter para guardar"
                          className="h-11 px-3.5 rounded-xl bg-background border border-primary text-sm outline-none placeholder:text-muted"
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setQuickAddColumn(column.id);
                            setQuickAddTitle("");
                          }}
                          className="flex items-center gap-2 h-11 px-3 rounded-xl text-sm text-muted hover:text-foreground hover:bg-white/5 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Añadir idea
                        </button>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}

          {addingColumn ? (
            <div className="w-72 flex-shrink-0 bg-surface border border-border rounded-2xl p-3 flex flex-col gap-2">
              <input
                autoFocus
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addNewColumn();
                  if (e.key === "Escape") setAddingColumn(false);
                }}
                placeholder="Nombre de la categoría"
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
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
                  className="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
                >
                  Agregar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingColumn(true)}
              className="w-64 h-14 flex-shrink-0 border border-dashed border-[#3f3f48] rounded-2xl flex items-center justify-center gap-2 text-sm font-medium text-muted hover:border-primary hover:text-foreground transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar categoría
            </button>
          )}
        </div>
      </DragDropContext>

      {deletingColumn && (
        <ConfirmDialog
          title="Eliminar categoría"
          confirmLabel="Eliminar"
          message={`Se elimina "${deletingColumn.name}". Sus ideas pasan a "Sin categoría".`}
          onConfirm={() => {
            studio.removeCategory(deletingColumn.id);
            setDeletingColumn(null);
          }}
          onCancel={() => setDeletingColumn(null)}
        />
      )}

      {deletingIdea && (
        <ConfirmDialog
          title="Eliminar idea"
          confirmLabel="Eliminar"
          message={`¿Eliminar "${deletingIdea.title}"? No se puede deshacer.`}
          onConfirm={() => {
            studio.removeIdea(deletingIdea.id);
            setDeletingIdea(null);
          }}
          onCancel={() => setDeletingIdea(null)}
        />
      )}
    </div>
  );
}
