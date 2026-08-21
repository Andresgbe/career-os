import { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { getTasks, addTask, updateTask, deleteTask, reorderTasks } from "./api";
import {
  BUCKET_DEFS,
  PRIORITY_LABELS,
  PRIORITY_RANK,
  bucketOf,
  formatDueShort,
  todayIso,
} from "./types";
import type { BucketKey, Priority, Subtask, SubtaskStatus, TaskRow } from "./types";

const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatTodayHeader(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(d, 10)} de ${MONTHS_LONG[parseInt(m, 10) - 1]}`;
}

const PRIORITY_DOT_CLASS: Record<Priority, string> = {
  alta: "bg-red-400",
  media: "bg-amber-400",
  baja: "bg-zinc-500",
};

const SUBTASK_STATUS_LABELS: Record<SubtaskStatus, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  hecho: "Hecha",
};

const SUBTASK_STATUS_CLASS: Record<SubtaskStatus, string> = {
  pendiente: "bg-white/5 text-muted",
  en_progreso: "bg-primary/15 text-primary-hover",
  hecho: "bg-emerald-500/10 text-emerald-300",
};

const NEXT_SUBTASK_STATUS: Record<SubtaskStatus, SubtaskStatus> = {
  pendiente: "en_progreso",
  en_progreso: "hecho",
  hecho: "pendiente",
};

function chipClass(active: boolean): string {
  return active
    ? "bg-primary text-white font-semibold"
    : "bg-surface border border-border text-muted font-medium";
}

export default function TasksPage() {
  const today = todayIso();

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [expandedGroups, setExpandedGroups] = useState<Record<BucketKey, boolean>>({
    atrasadas: true,
    hoy: true,
    semana: true,
    mas_adelante: true,
    sin_fecha: true,
    completadas: false,
  });
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string>>({});

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("media");
  const [newProject, setNewProject] = useState("");

  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<"all" | Priority>("all");
  const [sortBy, setSortBy] = useState<"fecha" | "prioridad">("fecha");

  useEffect(() => {
    getTasks()
      .then(setTasks)
      .catch((err) => setError(err instanceof Error ? err.message : "Error loading tasks"))
      .finally(() => setLoading(false));
  }, []);

  function reportError(err: unknown) {
    setError(err instanceof Error ? err.message : "Something went wrong");
  }

  function toggleGroup(key: BucketKey) {
    setExpandedGroups((s) => ({ ...s, [key]: !s[key] }));
  }

  function toggleTaskExpand(id: string) {
    setExpandedTaskIds((s) => ({ ...s, [id]: !s[id] }));
  }

  function toggleDone(task: TaskRow) {
    const done = !task.done;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done } : t)));
    updateTask(task.id, { done }).catch(reportError);
  }

  function handleDeleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    deleteTask(id).catch(reportError);
  }

  function startEdit(task: TaskRow) {
    setEditingId(task.id);
    setEditText(task.title);
  }

  function saveEdit() {
    const id = editingId;
    if (!id) return;
    const text = editText.trim();
    setEditingId(null);
    if (!text) return;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title: text } : t)));
    updateTask(id, { title: text }).catch(reportError);
  }

  function submitNewTask() {
    const title = newTitle.trim();
    if (!title) return;
    addTask({
      title,
      priority: newPriority,
      due: newDue || null,
      project: newProject.trim(),
    })
      .then((task) => setTasks((prev) => [...prev, task]))
      .catch(reportError);
    setNewTitle("");
    setNewDue("");
    setNewPriority("media");
    setNewProject("");
    setShowAddForm(false);
  }

  function updateSubtasks(taskId: string, subtasks: Subtask[]) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, subtasks } : t)));
    updateTask(taskId, { subtasks }).catch(reportError);
  }

  function addSubtask(taskId: string) {
    const text = (subtaskDrafts[taskId] || "").trim();
    if (!text) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    updateSubtasks(taskId, [
      ...task.subtasks,
      { id: crypto.randomUUID(), title: text, status: "pendiente" },
    ]);
    setSubtaskDrafts((s) => ({ ...s, [taskId]: "" }));
  }

  function cycleSubtaskStatus(taskId: string, subId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    updateSubtasks(
      taskId,
      task.subtasks.map((st) =>
        st.id === subId ? { ...st, status: NEXT_SUBTASK_STATUS[st.status] } : st
      )
    );
  }

  function deleteSubtask(taskId: string, subId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    updateSubtasks(taskId, task.subtasks.filter((st) => st.id !== subId));
  }

  // ============================================
  // Derived view state
  // ============================================

  const todayRelevant = tasks.filter(
    (t) => t.due === today || (!!t.due && t.due < today && !t.done)
  );
  const agendaDoneCount = todayRelevant.filter((t) => t.done).length;
  const agendaPendingCount = todayRelevant.filter((t) => !t.done).length;
  const agendaTotal = agendaDoneCount + agendaPendingCount;
  const agendaPct = agendaTotal ? Math.round((agendaDoneCount / agendaTotal) * 100) : 0;

  const projectOptions: string[] = [];
  tasks.forEach((t) => {
    if (t.project && !projectOptions.includes(t.project)) projectOptions.push(t.project);
  });
  const hasNoProject = tasks.some((t) => !t.project);

  const filtered = tasks
    .filter((t) => {
      if (filterProject === "all") return true;
      if (filterProject === "none") return !t.project;
      return t.project === filterProject;
    })
    .filter((t) => filterPriority === "all" || t.priority === filterPriority);

  const comparator =
    sortBy === "prioridad"
      ? (a: TaskRow, b: TaskRow) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      : (a: TaskRow, b: TaskRow) => (a.due || "9999-99-99").localeCompare(b.due || "9999-99-99");

  const groups = BUCKET_DEFS.map((g) => ({
    key: g.key,
    label: g.label,
    rows: filtered.filter((t) => bucketOf(t, today) === g.key).sort(comparator),
  })).filter((g) => g.rows.length > 0);

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const groupKey = result.source.droppableId;
    if (result.destination.droppableId !== groupKey) return;
    const group = groups.find((g) => g.key === groupKey);
    if (!group) return;
    const draggedId = group.rows[result.source.index]?.id;
    const targetId = group.rows[result.destination.index]?.id;
    if (!draggedId || !targetId || draggedId === targetId) return;

    setTasks((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((t) => t.id === draggedId);
      const toIdx = arr.findIndex((t) => t.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      reorderTasks(arr.map((t, i) => ({ id: t.id, sort_order: i }))).catch(reportError);
      return arr;
    });
  }

  if (loading) {
    return <p className="text-sm text-muted">Cargando...</p>;
  }

  return (
    <div className="flex flex-col gap-5 max-w-[900px]">
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Tareas</h1>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="bg-primary text-white font-semibold text-sm px-[18px] py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
        >
          + Nueva tarea
        </button>
      </div>

      {/* Agenda summary */}
      <div className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-5 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <div className="text-[15px] font-semibold text-foreground">
            Hoy &middot; {formatTodayHeader(today)}
          </div>
          <div className="text-xs text-muted">
            {agendaPendingCount} pendientes &middot; {agendaDoneCount} completadas
          </div>
        </div>
        <div className="flex-1 min-w-[120px] h-1.5 rounded-full bg-surface-hover overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${agendaPct}%` }}
          />
        </div>
        <div className="text-sm text-primary-hover font-bold flex-shrink-0">{agendaPct}%</div>
      </div>

      {/* Inline add-task form */}
      {showAddForm && (
        <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
          <input
            type="text"
            autoFocus
            placeholder="¿Qué tenés que hacer?"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNewTask();
            }}
            className="bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary"
          />
          <div className="flex gap-2.5 flex-wrap items-center">
            <input
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
            <div className="flex gap-1.5">
              {(["alta", "media", "baja"] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNewPriority(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs ${chipClass(newPriority === p)}`}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Proyecto / etiqueta (opcional)"
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
              className="flex-1 min-w-[160px] bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex gap-2.5 justify-end">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-lg text-sm text-muted hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submitNewTask}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              Agregar
            </button>
          </div>
        </div>
      )}

      {/* Filter / sort bar */}
      <div className="flex items-center gap-3.5 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterProject("all")}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${chipClass(filterProject === "all")}`}
          >
            Todos
          </button>
          {projectOptions.map((p) => (
            <button
              key={p}
              onClick={() => setFilterProject(p)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${chipClass(filterProject === p)}`}
            >
              {p}
            </button>
          ))}
          {hasNoProject && (
            <button
              onClick={() => setFilterProject("none")}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${chipClass(filterProject === "none")}`}
            >
              Sin proyecto
            </button>
          )}
        </div>
        <div className="w-px h-5 bg-border flex-shrink-0" />
        <div className="flex gap-1.5">
          {(["all", "alta", "media", "baja"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${chipClass(filterPriority === p)}`}
            >
              {p === "all" ? "Todas" : PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-border flex-shrink-0" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted/70">Ordenar:</span>
          <div className="flex gap-1.5">
            {(["fecha", "prioridad"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${chipClass(sortBy === s)}`}
              >
                {s === "fecha" ? "Fecha" : "Prioridad"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grouped task list */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const expanded = !!expandedGroups[group.key];
            return (
              <div key={group.key} className="flex flex-col gap-2">
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="flex items-center gap-2 text-left w-fit select-none"
                >
                  <span className="text-muted text-[10px]">{expanded ? "▾" : "▸"}</span>
                  <span className="text-xs font-bold tracking-wide text-muted uppercase">
                    {group.label}
                  </span>
                  <span className="text-xs text-muted/50">({group.rows.length})</span>
                </button>

                {expanded && (
                  <Droppable droppableId={group.key}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="bg-surface border border-border rounded-2xl overflow-hidden"
                      >
                        {group.rows.map((task, index) => {
                          const overdue = !task.done && !!task.due && task.due < today;
                          const taskExpanded = !!expandedTaskIds[task.id];
                          const subTotal = task.subtasks.length;
                          const subDone = task.subtasks.filter((st) => st.status === "hecho").length;
                          const subtaskPct = subTotal > 0 ? Math.round((subDone / subTotal) * 100) : 0;

                          return (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(dragProvided, snapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  className={`border-b border-border/60 last:border-b-0 ${
                                    snapshot.isDragging ? "bg-surface-hover" : ""
                                  }`}
                                >
                                  <div className="flex items-center gap-3 px-[18px] py-3.5">
                                    <span
                                      {...dragProvided.dragHandleProps}
                                      className="text-[13px] text-muted/40 cursor-grab active:cursor-grabbing flex-shrink-0 tracking-tighter"
                                    >
                                      &#8942;&#8942;
                                    </span>

                                    <button onClick={() => toggleDone(task)} className="flex-shrink-0">
                                      {task.done ? (
                                        <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold">
                                          &#10003;
                                        </span>
                                      ) : (
                                        <span className="w-5 h-5 rounded-full border-[1.5px] border-muted/40 block" />
                                      )}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                      {editingId === task.id ? (
                                        <input
                                          autoFocus
                                          value={editText}
                                          onChange={(e) => setEditText(e.target.value)}
                                          onBlur={saveEdit}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") saveEdit();
                                            if (e.key === "Escape") setEditingId(null);
                                          }}
                                          className="w-full bg-background border border-primary rounded px-2 py-1.5 text-sm focus:outline-none"
                                        />
                                      ) : (
                                        <span
                                          onClick={() => startEdit(task)}
                                          className={`text-sm cursor-text ${
                                            task.done ? "line-through text-muted/60" : "text-foreground/90"
                                          }`}
                                        >
                                          {task.title}
                                        </span>
                                      )}
                                    </div>

                                    {task.project && (
                                      <span className="text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary-hover flex-shrink-0 whitespace-nowrap">
                                        {task.project}
                                      </span>
                                    )}

                                    <span className="flex items-center gap-1.5 flex-shrink-0">
                                      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT_CLASS[task.priority]}`} />
                                      <span className="text-xs text-muted">{PRIORITY_LABELS[task.priority]}</span>
                                    </span>

                                    {task.due && (
                                      <span
                                        className={`text-xs flex-shrink-0 ${
                                          overdue ? "text-red-400 font-semibold" : "text-muted"
                                        }`}
                                      >
                                        {formatDueShort(task.due)}
                                      </span>
                                    )}

                                    {subTotal > 0 && (
                                      <button
                                        onClick={() => toggleTaskExpand(task.id)}
                                        className="flex items-center gap-1.5 text-xs text-muted bg-surface-hover px-2.5 py-1 rounded-md flex-shrink-0"
                                      >
                                        <span>
                                          {subDone}/{subTotal} subtareas
                                        </span>
                                        <span>{taskExpanded ? "▲" : "▾"}</span>
                                      </button>
                                    )}

                                    <button
                                      onClick={() => handleDeleteTask(task.id)}
                                      className="w-5 h-5 flex items-center justify-center text-muted/60 hover:text-red-400 flex-shrink-0"
                                    >
                                      &times;
                                    </button>
                                  </div>

                                  {subTotal > 0 && (
                                    <div className="px-[18px] pb-1 pl-11">
                                      <div className="h-1 rounded-full bg-surface-hover overflow-hidden max-w-[260px]">
                                        <div
                                          className="h-full rounded-full bg-primary"
                                          style={{ width: `${subtaskPct}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {taskExpanded && (
                                    <div className="px-[18px] pb-4 pl-11 pt-1.5 flex flex-col gap-2.5">
                                      <div className="flex flex-wrap gap-2">
                                        {task.subtasks.map((st) => (
                                          <div
                                            key={st.id}
                                            className="bg-surface-hover border border-border rounded-lg px-3 py-2.5 flex flex-col gap-2 min-w-[160px] max-w-[240px]"
                                          >
                                            <div className="flex items-start justify-between gap-2">
                                              <span className="text-[13px] text-foreground/90 leading-snug">
                                                {st.title}
                                              </span>
                                              <button
                                                onClick={() => deleteSubtask(task.id, st.id)}
                                                className="text-muted/50 hover:text-red-400 text-[13px] flex-shrink-0"
                                              >
                                                &times;
                                              </button>
                                            </div>
                                            <button
                                              onClick={() => cycleSubtaskStatus(task.id, st.id)}
                                              className={`w-fit text-[11px] font-semibold px-2.5 py-1 rounded-md ${SUBTASK_STATUS_CLASS[st.status]}`}
                                            >
                                              {SUBTASK_STATUS_LABELS[st.status]}
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          placeholder="Agregar subtarea..."
                                          value={subtaskDrafts[task.id] || ""}
                                          onChange={(e) =>
                                            setSubtaskDrafts((s) => ({ ...s, [task.id]: e.target.value }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") addSubtask(task.id);
                                          }}
                                          className="flex-1 max-w-[280px] bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                                        />
                                        <button
                                          onClick={() => addSubtask(task.id)}
                                          className="text-primary-hover text-xs font-semibold px-1 py-2 whitespace-nowrap"
                                        >
                                          + Agregar
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                )}
              </div>
            );
          })}

          {groups.length === 0 && (
            <div className="text-center p-8 text-muted bg-surface border border-border rounded-2xl">
              No hay tareas con estos filtros.
            </div>
          )}
        </div>
      </DragDropContext>
    </div>
  );
}
