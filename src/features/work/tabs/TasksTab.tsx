import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import type { TaskStatus, WorkTaskRow } from "../types";
import { TASK_STATUSES } from "../types";
import { getTasks, addTask, updateTask, deleteTask } from "../api";

function statusDef(status: TaskStatus) {
  return TASK_STATUSES.find((s) => s.value === status) ?? TASK_STATUSES[0];
}

export default function TasksTab() {
  const [tasks, setTasks] = useState<WorkTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New task
  const [newIdentifier, setNewIdentifier] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("pending");
  const [newConsulta, setNewConsulta] = useState("");
  const [adding, setAdding] = useState(false);

  // Edit task
  const [editId, setEditId] = useState<string | null>(null);
  const [editIdentifier, setEditIdentifier] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("pending");
  const [editConsulta, setEditConsulta] = useState("");

  useEffect(() => {
    getTasks()
      .then(setTasks)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!newIdentifier.trim() || !newDescription.trim()) {
      setError("Enter an identifier and description.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const row = await addTask({
        identifier: newIdentifier.trim(),
        description: newDescription.trim(),
        status: newStatus,
        consulta: newConsulta.trim(),
      });
      setTasks([...tasks, row]);
      setNewIdentifier("");
      setNewDescription("");
      setNewStatus("pending");
      setNewConsulta("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error adding task");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (task: WorkTaskRow) => {
    setEditId(task.id);
    setEditIdentifier(task.identifier);
    setEditDescription(task.description);
    setEditStatus(task.status);
    setEditConsulta(task.consulta);
    setError("");
  };

  const saveEdit = async () => {
    if (!editId || !editIdentifier.trim() || !editDescription.trim()) return;
    setError("");
    try {
      const updated = await updateTask(editId, {
        identifier: editIdentifier.trim(),
        description: editDescription.trim(),
        status: editStatus,
        consulta: editConsulta.trim(),
      });
      setTasks(tasks.map((t) => (t.id === editId ? updated : t)));
      setEditId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating task");
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    try {
      await deleteTask(id);
      setTasks(tasks.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting task");
    }
  };

  const quickStatusChange = async (task: WorkTaskRow, status: TaskStatus) => {
    setError("");
    try {
      const updated = await updateTask(task.id, { status });
      setTasks(tasks.map((t) => (t.id === task.id ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating task");
    }
  };

  if (loading) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted uppercase bg-surface-hover">
            <tr>
              <th className="px-4 py-3 rounded-tl-lg">Identifier</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Consulta</th>
              <th className="px-4 py-3 rounded-tr-lg text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tasks.map((task) => {
              const isEditing = editId === task.id;
              const status = statusDef(task.status);
              return (
                <tr key={task.id} className="hover:bg-surface-hover/50 align-top">
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editIdentifier}
                        onChange={(e) => setEditIdentifier(e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 w-28"
                      />
                    ) : (
                      <span className="font-medium font-mono">
                        {task.identifier}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {isEditing ? (
                      <textarea
                        rows={2}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 w-full resize-none"
                      />
                    ) : (
                      <span className="whitespace-pre-wrap">
                        {task.description}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        value={editStatus}
                        onChange={(e) =>
                          setEditStatus(e.target.value as TaskStatus)
                        }
                        className="bg-background border border-border rounded px-2 py-1"
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={task.status}
                        onChange={(e) =>
                          quickStatusChange(task, e.target.value as TaskStatus)
                        }
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 outline-none cursor-pointer ${status.bg} ${status.color}`}
                      >
                        {TASK_STATUSES.map((s) => (
                          <option
                            key={s.value}
                            value={s.value}
                            className="bg-surface text-foreground"
                          >
                            {s.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {isEditing ? (
                      <textarea
                        rows={2}
                        placeholder="Doubts about this task..."
                        value={editConsulta}
                        onChange={(e) => setEditConsulta(e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 w-full resize-none"
                      />
                    ) : (
                      <span className="text-muted whitespace-pre-wrap">
                        {task.consulta || "-"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={saveEdit}
                          className="p-1.5 rounded text-emerald-400 hover:bg-surface transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="p-1.5 rounded text-muted hover:bg-surface transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startEdit(task)}
                          className="p-1.5 rounded text-muted hover:text-primary hover:bg-surface transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-surface transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* Add new row */}
            <tr className="bg-surface-hover/30 align-top">
              <td className="px-4 py-2">
                <input
                  type="text"
                  placeholder="e.g. TASK-123"
                  value={newIdentifier}
                  onChange={(e) => setNewIdentifier(e.target.value)}
                  className="bg-background border border-border rounded px-2 py-1 w-28 text-sm"
                />
              </td>
              <td className="px-4 py-2">
                <textarea
                  rows={2}
                  placeholder="Description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="bg-background border border-border rounded px-2 py-1 w-full text-sm resize-none"
                />
              </td>
              <td className="px-4 py-2">
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
                  className="bg-background border border-border rounded px-2 py-1 text-sm"
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-2">
                <textarea
                  rows={2}
                  placeholder="Consulta"
                  value={newConsulta}
                  onChange={(e) => setNewConsulta(e.target.value)}
                  className="bg-background border border-border rounded px-2 py-1 w-full text-sm resize-none"
                />
              </td>
              <td className="px-4 py-2 text-right">
                <button
                  onClick={handleAdd}
                  disabled={adding}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {tasks.length === 0 && (
        <p className="text-sm text-muted text-center py-4">
          No tasks yet. Add one above.
        </p>
      )}
    </div>
  );
}
