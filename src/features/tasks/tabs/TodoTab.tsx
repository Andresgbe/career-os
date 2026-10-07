import { errorMessage } from "../../../lib/errors";
import { useEffect, useState } from "react";
import { Plus, Check, Trash2, X, CalendarPlus } from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import { getTasks, addTask, updateTask, deleteTask } from "../api";
import type { TaskRow, Priority } from "../types";
import {
  PRIORITY_LABELS,
  PRIORITY_RANK,
  PRIORITY_DOT,
  PRIORITY_CHIP,
  todayIso,
} from "../types";

const PRIORITIES: Priority[] = ["alta", "media", "baja"];

export default function TodoTab() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("media");
  const [newDue, setNewDue] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [toDelete, setToDelete] = useState<TaskRow | null>(null);
  const [showDone, setShowDone] = useState(false);
  // Rows show a small calendar button until you actually set a date, so an
  // empty "mm/dd/yyyy" isn't repeated down the whole list on a phone.
  const [dateEditId, setDateEditId] = useState<string | null>(null);

  useEffect(() => {
    getTasks()
      // Personal list only — tasks created inside a project stay in that
      // project's Tasks tab, so this section stays a plain to-do list.
      .then((rows) => setTasks(rows.filter((t) => !t.project_id)))
      .catch(report)
      .finally(() => setLoading(false));
  }, []);

  function report(err: unknown) {
    setError(errorMessage(err, "Algo salió mal"));
  }

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      const row = await addTask({
        title,
        priority: newPriority,
        due: newDue || null,
      });
      setTasks((prev) => [...prev, row]);
      setNewTitle("");
      setNewDue("");
      setNewPriority("media");
    } catch (err) {
      report(err);
    } finally {
      setAdding(false);
    }
  }

  function toggleDone(task: TaskRow) {
    const done = !task.done;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done } : t)));
    updateTask(task.id, { done }).catch(report);
  }

  function cyclePriority(task: TaskRow) {
    const next =
      PRIORITIES[(PRIORITIES.indexOf(task.priority) + 1) % PRIORITIES.length];
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, priority: next } : t))
    );
    updateTask(task.id, { priority: next }).catch(report);
  }

  function changeDue(task: TaskRow, due: string) {
    const value = due || null;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, due: value } : t)));
    updateTask(task.id, { due: value }).catch(report);
  }

  function startEdit(task: TaskRow) {
    setEditingId(task.id);
    setEditTitle(task.title);
  }

  function saveEdit() {
    const id = editingId;
    const title = editTitle.trim();
    setEditingId(null);
    if (!id || !title) return;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
    updateTask(id, { title }).catch(report);
  }

  function confirmDelete() {
    const task = toDelete;
    setToDelete(null);
    if (!task) return;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    deleteTask(task.id).catch(report);
  }

  if (loading) return <p className="text-sm text-muted">Cargando...</p>;

  const today = todayIso();
  // Highest priority first, then by due date, soonest first
  const byPriority = (a: TaskRow, b: TaskRow) => {
    const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rank !== 0) return rank;
    if (a.due && b.due) return a.due.localeCompare(b.due);
    if (a.due) return -1;
    if (b.due) return 1;
    return 0;
  };

  const pending = tasks.filter((t) => !t.done).sort(byPriority);
  const done = tasks.filter((t) => t.done).sort(byPriority);

  const renderTask = (task: TaskRow) => {
    const overdue = !task.done && task.due !== null && task.due < today;

    return (
      <li
        key={task.id}
        className="group flex items-center gap-2.5 px-3 py-3 border-b border-border last:border-0"
      >
        <button
          onClick={() => toggleDone(task)}
          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
            task.done
              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
              : "border-border text-transparent hover:border-primary active:border-primary"
          }`}
          aria-label={task.done ? "Marcar pendiente" : "Marcar hecha"}
        >
          <Check className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1 min-w-0">
          {editingId === task.id ? (
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") setEditingId(null);
              }}
              className="w-full bg-background border border-primary rounded px-2 py-1 text-sm outline-none"
            />
          ) : (
            <span
              onClick={() => startEdit(task)}
              className={`block text-sm cursor-text break-words ${
                task.done ? "line-through text-muted" : ""
              }`}
            >
              {task.title}
            </span>
          )}

          {/* Secondary row: on a phone this sits under the title */}
          <div className="flex items-center gap-2 mt-1 sm:hidden">
            <button
              onClick={() => cyclePriority(task)}
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PRIORITY_CHIP[task.priority]}`}
            >
              {PRIORITY_LABELS[task.priority]}
            </button>
            {task.due || dateEditId === task.id ? (
              <input
                type="date"
                autoFocus={dateEditId === task.id}
                value={task.due ?? ""}
                onChange={(e) => changeDue(task, e.target.value)}
                onBlur={() => setDateEditId(null)}
                className={`bg-transparent text-[11px] outline-none ${
                  overdue ? "text-red-400 font-semibold" : "text-muted"
                }`}
              />
            ) : (
              <button
                onClick={() => setDateEditId(task.id)}
                className="text-muted hover:text-primary transition-colors"
                aria-label="Poner fecha"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Same controls inline from sm up, where there's room */}
        <button
          onClick={() => cyclePriority(task)}
          className="hidden sm:flex items-center gap-1.5 shrink-0 px-1.5 py-1 rounded hover:bg-surface-hover transition-colors"
          title="Cambiar prioridad"
        >
          <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[task.priority]}`} />
          <span className="text-xs text-muted">{PRIORITY_LABELS[task.priority]}</span>
        </button>

        {task.due || dateEditId === task.id ? (
          <input
            type="date"
            autoFocus={dateEditId === task.id}
            value={task.due ?? ""}
            onChange={(e) => changeDue(task, e.target.value)}
            onBlur={() => setDateEditId(null)}
            title="Fecha"
            className={`hidden sm:block shrink-0 bg-transparent text-xs outline-none cursor-pointer ${
              overdue ? "text-red-400 font-semibold" : "text-muted"
            }`}
          />
        ) : (
          <button
            onClick={() => setDateEditId(task.id)}
            title="Poner fecha"
            className="hidden sm:block p-1 rounded text-muted hover:text-primary hover:bg-surface-hover transition-colors shrink-0"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={() => setToDelete(task)}
          className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-surface-hover transition-colors shrink-0 sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="Eliminar"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {error && (
        <p className="text-sm text-red-400 flex items-center gap-2">
          {error}
          <button onClick={() => setError("")} aria-label="Cerrar">
            <X className="w-3.5 h-3.5" />
          </button>
        </p>
      )}

      {/* Quick add — stacks on a phone, one row from sm up */}
      <div className="bg-surface border border-border rounded-xl p-3 flex flex-col sm:flex-row gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="¿Qué tenés que hacer?"
          className="flex-1 min-w-0 bg-background border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <div className="flex gap-2">
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as Priority)}
            className="flex-1 sm:flex-none bg-background border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            className="flex-1 sm:flex-none bg-background border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newTitle.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-40 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Agregar</span>
          </button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <p className="text-sm text-muted">
            No tenés tareas. Agregá la primera arriba.
          </p>
        </div>
      ) : (
        <>
          <section className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-border">
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                Pendientes ({pending.length})
              </span>
            </div>
            {pending.length === 0 ? (
              <p className="text-sm text-muted px-3 py-5 text-center">
                Nada pendiente. Todo listo.
              </p>
            ) : (
              <ul>{pending.map(renderTask)}</ul>
            )}
          </section>

          {done.length > 0 && (
            <section className="bg-surface border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setShowDone((v) => !v)}
                className="w-full px-3 py-2 border-b border-border flex items-center justify-between text-left hover:bg-surface-hover/50 transition-colors"
              >
                <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                  Completadas ({done.length})
                </span>
                <span className="text-xs text-muted">
                  {showDone ? "Ocultar" : "Mostrar"}
                </span>
              </button>
              {showDone && <ul>{done.map(renderTask)}</ul>}
            </section>
          )}
        </>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Eliminar tarea"
          message={`Eliminar "${toDelete.title}"?`}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
