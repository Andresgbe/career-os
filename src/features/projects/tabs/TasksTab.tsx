import { errorMessage } from "../../../lib/errors";
import { useEffect, useRef, useState } from "react";
import { Plus, FileText, Trash2, UserRound } from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import { getTasks, addTask, updateTask, deleteTask } from "../../tasks/api";
import type { TaskRow, Priority } from "../../tasks/types";
import {
  PRIORITY_LABELS,
  PRIORITY_RANK,
  PRIORITY_CHIP,
  todayIso,
  formatDueShort,
} from "../../tasks/types";

const PRIORITIES: Priority[] = ["alta", "media", "baja"];

interface TasksTabProps {
  projectId: string;
}

// Database-style table of this project's tasks: one row per task, each
// property editable in place (click the title to rename, the status or
// priority chip to cycle it), and a "+ Nueva tarea" row at the bottom.
export default function TasksTab({ projectId }: TasksTabProps) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [addingRow, setAddingRow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [toDelete, setToDelete] = useState<TaskRow | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getTasks()
      .then((rows) => setTasks(rows.filter((t) => t.project_id === projectId)))
      .catch(report)
      .finally(() => setLoading(false));
  }, [projectId]);

  function report(err: unknown) {
    setError(errorMessage(err, "Algo salió mal"));
  }

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title) {
      setAddingRow(false);
      return;
    }
    setNewTitle("");
    try {
      const row = await addTask({
        title,
        priority: "media",
        due: null,
        project_id: projectId,
      });
      setTasks((prev) => [...prev, row]);
      // keep the row open so several tasks can be typed in a row
      addInputRef.current?.focus();
    } catch (err) {
      report(err);
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

  function saveAssignee() {
    const id = assigneeId;
    const assignee = assigneeDraft.trim();
    setAssigneeId(null);
    if (!id) return;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, assignee } : t)));
    updateTask(id, { assignee }).catch(report);
  }

  function saveEdit() {
    const id = editId;
    const title = editTitle.trim();
    setEditId(null);
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
  const ordered = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  });
  const pendingCount = tasks.filter((t) => !t.done).length;

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-muted">
          {pendingCount} pendientes · {tasks.length} en total
        </span>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm text-left">
          <thead className="text-xs text-muted uppercase border-b border-border">
            <tr>
              <th className="px-4 py-2.5 font-medium">Tarea</th>
              <th className="px-4 py-2.5 font-medium w-[150px]">Responsable</th>
              <th className="px-4 py-2.5 font-medium w-[120px]">Estado</th>
              <th className="px-4 py-2.5 font-medium w-[110px]">Prioridad</th>
              <th className="px-4 py-2.5 font-medium w-[130px]">Fecha</th>
              <th className="px-2 py-2.5 w-[44px]" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ordered.map((task) => {
              const overdue = !task.done && task.due !== null && task.due < today;
              return (
                <tr key={task.id} className="group hover:bg-surface-hover/40">
                  <td className="px-4 py-2.5">
                    {editId === task.id ? (
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") setEditId(null);
                        }}
                        className="w-full bg-background border border-primary rounded px-2 py-1 text-sm outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setEditId(task.id);
                          setEditTitle(task.title);
                        }}
                        className="flex items-center gap-2 text-left w-full group/title"
                      >
                        <FileText className="w-3.5 h-3.5 text-muted shrink-0" />
                        <span
                          className={`font-medium group-hover/title:underline ${
                            task.done ? "line-through text-muted" : ""
                          }`}
                        >
                          {task.title}
                        </span>
                      </button>
                    )}
                  </td>

                  <td className="px-4 py-2.5">
                    {assigneeId === task.id ? (
                      <input
                        autoFocus
                        value={assigneeDraft}
                        onChange={(e) => setAssigneeDraft(e.target.value)}
                        onBlur={saveAssignee}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveAssignee();
                          if (e.key === "Escape") setAssigneeId(null);
                        }}
                        placeholder="Nombre"
                        className="w-full bg-background border border-primary rounded px-2 py-1 text-xs outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setAssigneeId(task.id);
                          setAssigneeDraft(task.assignee);
                        }}
                        className="flex items-center gap-1.5 text-xs"
                        title="Asignar responsable"
                      >
                        {task.assignee ? (
                          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 text-primary-hover font-medium">
                            <UserRound className="w-3 h-3" />
                            {task.assignee}
                          </span>
                        ) : (
                          <span className="text-muted hover:text-foreground transition-colors">
                            —
                          </span>
                        )}
                      </button>
                    )}
                  </td>

                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => toggleDone(task)}
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        task.done
                          ? "bg-emerald-400/15 text-emerald-400"
                          : "bg-surface-hover text-muted hover:text-foreground"
                      }`}
                    >
                      {task.done ? "Hecha" : "Pendiente"}
                    </button>
                  </td>

                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => cyclePriority(task)}
                      className={`text-xs font-medium px-2 py-1 rounded ${PRIORITY_CHIP[task.priority]}`}
                      title="Cambiar prioridad"
                    >
                      {PRIORITY_LABELS[task.priority]}
                    </button>
                  </td>

                  <td className="px-4 py-2.5">
                    <label
                      className={`relative cursor-pointer text-xs ${
                        overdue ? "text-red-400 font-semibold" : "text-muted"
                      }`}
                    >
                      {task.due ? formatDueShort(task.due) : "—"}
                      <input
                        type="date"
                        value={task.due ?? ""}
                        onChange={(e) => changeDue(task, e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full"
                      />
                    </label>
                  </td>

                  <td className="px-2 py-2.5">
                    <button
                      onClick={() => setToDelete(task)}
                      className="p-1.5 rounded text-muted hover:text-red-400 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* "+ Nueva tarea" row, the way a Notion database adds a page */}
            <tr>
              <td colSpan={6} className="px-4 py-2">
                {addingRow ? (
                  <input
                    ref={addInputRef}
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onBlur={handleAdd}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAdd();
                      if (e.key === "Escape") {
                        setNewTitle("");
                        setAddingRow(false);
                      }
                    }}
                    placeholder="Título de la tarea, Enter para guardar"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
                  />
                ) : (
                  <button
                    onClick={() => setAddingRow(true)}
                    className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nueva tarea
                  </button>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

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
