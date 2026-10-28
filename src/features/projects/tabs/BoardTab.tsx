import { useEffect, useState } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, Calendar } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { errorMessage } from "../../../lib/errors";
import ConfirmDialog from "../../../components/ConfirmDialog";
import BoardTaskModal from "../components/BoardTaskModal";
import {
  getBoard,
  addBoardColumn,
  updateBoardColumn,
  reorderBoardColumns,
  deleteBoardColumn,
  addBoardTask,
  updateBoardTask,
  moveBoardTasks,
  deleteBoardTask,
} from "../api";
import type { BoardColumnRow, BoardTaskRow } from "../types";
import { BOARD_COLORS, DEFAULT_BOARD_COLUMNS, formatDue } from "../types";

interface BoardTabProps {
  projectId: string;
  canEdit: boolean;
}

// A project created after the board landed starts with no columns: it gets
// the usual three. Shared per project so a second mount (StrictMode, a quick
// tab switch) waits on the same inserts instead of creating them twice.
const seeding = new Map<string, Promise<BoardColumnRow[]>>();

function seedColumns(projectId: string): Promise<BoardColumnRow[]> {
  let pending = seeding.get(projectId);
  if (!pending) {
    pending = Promise.all(
      DEFAULT_BOARD_COLUMNS.map((c, i) => addBoardColumn(projectId, c.name, c.color, i))
    );
    seeding.set(projectId, pending);
  }
  return pending;
}

// The project's Kanban board. Whoever can edit the project creates the
// columns, adds tasks and drags them around; a read-only client sees the
// same board without any of the controls.
export default function BoardTab({ projectId, canEdit }: BoardTabProps) {
  const [columns, setColumns] = useState<BoardColumnRow[]>([]);
  const [tasks, setTasks] = useState<BoardTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [addingTaskIn, setAddingTaskIn] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  const [columnDraft, setColumnDraft] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [deletingColumn, setDeletingColumn] = useState<BoardColumnRow | null>(null);
  const [openTask, setOpenTask] = useState<BoardTaskRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBoard(projectId)
      .then(async ({ columns, tasks }) => {
        if (columns.length === 0 && canEdit) columns = await seedColumns(projectId);
        if (cancelled) return;
        setColumns(columns);
        setTasks(tasks);
      })
      .catch((err) => !cancelled && report(err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, canEdit]);

  function report(err: unknown) {
    setError(errorMessage(err, "Algo salió mal con el tablero"));
  }

  const ordered = [...columns].sort((a, b) => a.sort_order - b.sort_order);
  const tasksIn = (columnId: string) =>
    tasks.filter((t) => t.column_id === columnId).sort((a, b) => a.sort_order - b.sort_order);

  // ----- tasks -----

  async function submitTask(columnId: string) {
    const title = taskDraft.trim();
    if (!title) {
      setAddingTaskIn(null);
      return;
    }
    setTaskDraft("");
    try {
      const row = await addBoardTask(projectId, columnId, title, tasksIn(columnId).length);
      setTasks((prev) => [...prev, row]);
    } catch (err) {
      report(err);
    }
  }

  function saveTask(id: string, fields: Pick<BoardTaskRow, "title" | "tag" | "assignee" | "due">) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)));
    updateBoardTask(id, fields).catch(report);
  }

  function removeTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    deleteBoardTask(id).catch(report);
  }

  // ----- columns -----

  async function submitColumn() {
    const name = columnDraft.trim();
    setColumnDraft("");
    setAddingColumn(false);
    if (!name) return;
    const sortOrder = ordered.length ? ordered[ordered.length - 1].sort_order + 1 : 0;
    const color = BOARD_COLORS[ordered.length % BOARD_COLORS.length];
    try {
      const row = await addBoardColumn(projectId, name, color, sortOrder);
      setColumns((prev) => [...prev, row]);
    } catch (err) {
      report(err);
    }
  }

  function commitRename() {
    const id = renamingId;
    const name = renameDraft.trim();
    setRenamingId(null);
    if (!id || !name) return;
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    updateBoardColumn(id, { name }).catch(report);
  }

  function setColumnColor(id: string, color: string) {
    setMenuFor(null);
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, color } : c)));
    updateBoardColumn(id, { color }).catch(report);
  }

  function confirmDeleteColumn() {
    const col = deletingColumn;
    setDeletingColumn(null);
    if (!col) return;
    setColumns((prev) => prev.filter((c) => c.id !== col.id));
    setTasks((prev) => prev.filter((t) => t.column_id !== col.id));
    deleteBoardColumn(col.id).catch(report);
  }

  // ----- drag and drop -----

  function handleDragEnd(result: DropResult) {
    const { source, destination, type } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === "COLUMN") {
      const next = [...ordered];
      const [moved] = next.splice(source.index, 1);
      next.splice(destination.index, 0, moved);
      const updates = next.map((c, i) => ({ id: c.id, sort_order: i }));
      setColumns(next.map((c, i) => ({ ...c, sort_order: i })));
      reorderBoardColumns(updates).catch(report);
      return;
    }

    const from = tasksIn(source.droppableId);
    const [moved] = from.splice(source.index, 1);
    if (!moved) return;
    const sameColumn = source.droppableId === destination.droppableId;
    const to = sameColumn ? from : tasksIn(destination.droppableId);
    to.splice(destination.index, 0, { ...moved, column_id: destination.droppableId });

    const updates = (sameColumn ? [to] : [from, to]).flatMap((list) =>
      list.map((t, i) => ({ id: t.id, column_id: t.column_id, sort_order: i }))
    );
    const byId = new Map(updates.map((u) => [u.id, u]));
    setTasks((prev) => prev.map((t) => (byId.has(t.id) ? { ...t, ...byId.get(t.id)! } : t)));
    moveBoardTasks(updates).catch(report);
  }

  if (loading) return <p className="text-sm text-muted">Cargando tablero...</p>;

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="board" direction="horizontal" type="COLUMN" isDropDisabled={!canEdit}>
          {(boardProvided) => (
            <div
              ref={boardProvided.innerRef}
              {...boardProvided.droppableProps}
              className="flex items-start gap-3.5 overflow-x-auto pb-3"
            >
              {ordered.map((column, columnIndex) => {
                const items = tasksIn(column.id);
                return (
                  <Draggable
                    key={column.id}
                    draggableId={`column-${column.id}`}
                    index={columnIndex}
                    isDragDisabled={!canEdit}
                  >
                    {(columnProvided) => (
                      <section
                        ref={columnProvided.innerRef}
                        {...columnProvided.draggableProps}
                        className="w-72 sm:w-[300px] shrink-0 flex flex-col gap-2.5 p-3 rounded-2xl bg-[#131317] border border-border"
                      >
                        <div
                          {...columnProvided.dragHandleProps}
                          className="relative flex items-center gap-2 px-1 py-0.5"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                            style={{ backgroundColor: column.color }}
                          />
                          {renamingId === column.id ? (
                            <input
                              autoFocus
                              value={renameDraft}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onBlur={commitRename}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename();
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              className="flex-1 min-w-0 bg-background border border-primary rounded-md px-2 py-1 text-sm outline-none"
                            />
                          ) : (
                            <h3 className="flex-1 min-w-0 truncate text-sm font-semibold">{column.name}</h3>
                          )}
                          <span className="text-xs text-muted px-2 py-0.5 rounded-full bg-surface-hover">
                            {items.length}
                          </span>
                          {canEdit && (
                            <button
                              onClick={() => setMenuFor(menuFor === column.id ? null : column.id)}
                              className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-surface-hover"
                              aria-label="Opciones de la columna"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          )}

                          {menuFor === column.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                              <div className="absolute right-0 top-9 z-20 w-52 p-1.5 rounded-xl bg-surface border border-border shadow-xl">
                                <button
                                  onClick={() => {
                                    setMenuFor(null);
                                    setRenamingId(column.id);
                                    setRenameDraft(column.name);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm hover:bg-surface-hover"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-muted" />
                                  Renombrar
                                </button>
                                <div className="flex flex-wrap gap-1.5 px-2.5 py-2">
                                  {BOARD_COLORS.map((color) => (
                                    <button
                                      key={color}
                                      onClick={() => setColumnColor(column.id, color)}
                                      className={`w-5 h-5 rounded-md ${
                                        column.color === color ? "ring-2 ring-offset-2 ring-offset-surface ring-foreground" : ""
                                      }`}
                                      style={{ backgroundColor: color }}
                                      aria-label={`Color ${color}`}
                                    />
                                  ))}
                                </div>
                                <button
                                  onClick={() => {
                                    setMenuFor(null);
                                    setDeletingColumn(column);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-red-400 hover:bg-surface-hover"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Eliminar columna
                                </button>
                              </div>
                            </>
                          )}
                        </div>

                        <Droppable droppableId={column.id} type="TASK" isDropDisabled={!canEdit}>
                          {(listProvided, listSnapshot) => (
                            <div
                              ref={listProvided.innerRef}
                              {...listProvided.droppableProps}
                              className={`flex flex-col gap-2 min-h-[44px] rounded-xl transition-colors ${
                                listSnapshot.isDraggingOver ? "bg-primary/5" : ""
                              }`}
                            >
                              {items.map((task, index) => (
                                <Draggable
                                  key={task.id}
                                  draggableId={task.id}
                                  index={index}
                                  isDragDisabled={!canEdit}
                                >
                                  {(taskProvided, taskSnapshot) => (
                                    <article
                                      ref={taskProvided.innerRef}
                                      {...taskProvided.draggableProps}
                                      {...taskProvided.dragHandleProps}
                                      onClick={() => canEdit && setOpenTask(task)}
                                      className={`flex flex-col gap-2 p-3 rounded-xl bg-[#1a1a1f] border transition-colors ${
                                        taskSnapshot.isDragging
                                          ? "border-primary shadow-xl"
                                          : "border-[#2c2c34] hover:border-primary/40"
                                      } ${canEdit ? "cursor-pointer" : ""}`}
                                    >
                                      <p className="text-[13.5px] font-medium leading-snug break-words">{task.title}</p>
                                      {(task.tag || task.due || task.assignee) && (
                                        <div className="flex items-center gap-2 flex-wrap text-xs">
                                          {task.tag && (
                                            <span className="px-2 py-0.5 rounded-md bg-surface-hover text-[#d4d4d8]">
                                              {task.tag}
                                            </span>
                                          )}
                                          {task.due && (
                                            <span className="flex items-center gap-1 text-muted">
                                              <Calendar className="w-3 h-3" />
                                              {formatDue(task.due)}
                                            </span>
                                          )}
                                          <span className="flex-1" />
                                          {task.assignee && (
                                            <span
                                              title={task.assignee}
                                              className="w-6 h-6 rounded-full bg-primary/20 text-primary-hover flex items-center justify-center text-[11px] font-semibold"
                                            >
                                              {task.assignee.charAt(0).toUpperCase()}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </article>
                                  )}
                                </Draggable>
                              ))}
                              {listProvided.placeholder}
                            </div>
                          )}
                        </Droppable>

                        {canEdit &&
                          (addingTaskIn === column.id ? (
                            <input
                              autoFocus
                              value={taskDraft}
                              onChange={(e) => setTaskDraft(e.target.value)}
                              onBlur={() => submitTask(column.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") submitTask(column.id);
                                if (e.key === "Escape") {
                                  setTaskDraft("");
                                  setAddingTaskIn(null);
                                }
                              }}
                              placeholder="Título de la tarea, Enter para guardar"
                              className="h-10 px-3 rounded-xl bg-background border border-primary text-sm outline-none placeholder:text-muted"
                            />
                          ) : (
                            <button
                              onClick={() => {
                                setAddingTaskIn(column.id);
                                setTaskDraft("");
                              }}
                              className="flex items-center gap-2 h-10 px-2.5 rounded-xl text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                              Añadir tarea
                            </button>
                          ))}
                      </section>
                    )}
                  </Draggable>
                );
              })}
              {boardProvided.placeholder}

              {canEdit &&
                (addingColumn ? (
                  <div className="w-72 shrink-0 p-3 rounded-2xl bg-surface border border-border flex flex-col gap-2">
                    <input
                      autoFocus
                      value={columnDraft}
                      onChange={(e) => setColumnDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitColumn();
                        if (e.key === "Escape") setAddingColumn(false);
                      }}
                      placeholder="Nombre de la columna"
                      className="h-10 px-3 rounded-xl bg-background border border-border text-sm outline-none focus:border-primary"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setAddingColumn(false)}
                        className="px-3 py-1.5 text-sm text-muted hover:text-foreground"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={submitColumn}
                        className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover"
                      >
                        Crear
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingColumn(true)}
                    className="w-64 shrink-0 h-14 rounded-2xl border border-dashed border-[#3f3f48] text-muted hover:text-foreground hover:border-primary flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Añadir columna
                  </button>
                ))}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {!canEdit && ordered.length === 0 && (
        <p className="text-sm text-muted">Este proyecto todavía no tiene tablero.</p>
      )}

      {openTask && (
        <BoardTaskModal
          task={openTask}
          onClose={() => setOpenTask(null)}
          onSave={(fields) => {
            saveTask(openTask.id, fields);
            setOpenTask(null);
          }}
          onDelete={() => {
            removeTask(openTask.id);
            setOpenTask(null);
          }}
        />
      )}

      {deletingColumn && (
        <ConfirmDialog
          title="Eliminar columna"
          message={`Se elimina "${deletingColumn.name}" junto con sus ${
            tasksIn(deletingColumn.id).length
          } tareas.`}
          confirmLabel="Eliminar"
          onConfirm={confirmDeleteColumn}
          onCancel={() => setDeletingColumn(null)}
        />
      )}
    </div>
  );
}
