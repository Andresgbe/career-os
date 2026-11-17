import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import ConfirmDialog from "../../components/ConfirmDialog";
import { errorMessage } from "../../lib/errors";
import { addTask, deleteTask, getTasks, updateTask } from "./api";
import {
  caracasToday,
  formatDue,
  isOverdue,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  sortDone,
  sortOpen,
  STATUS_CLASS,
  STATUS_LABEL,
  STATUS_ORDER,
  type TaskFields,
  type TaskPriority,
  type TaskRow,
  type TaskStatus,
} from "./types";

type Filter = "abiertas" | "hechas" | "todas";

// Cada cuánto se vuelve a leer la lista, para ver lo que el asistente fue
// marcando desde el chat sin tener que recargar.
const REFRESH_MS = 30000;

const EMPTY_DRAFT: TaskFields = { title: "", details: "", priority: "media", due_date: null };

const inputClass =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-primary";

/**
 * Tareas que Andrés le deja al asistente. El asistente las ve por MCP
 * (tasks_list), avanza con ellas y deja su reporte con task_update; acá se
 * lleva el control.
 */
export default function TasksPanel() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("abiertas");
  const [draft, setDraft] = useState<TaskFields>(EMPTY_DRAFT);
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [deleting, setDeleting] = useState<TaskRow | null>(null);

  const load = useCallback(
    () =>
      getTasks()
        .then((rows) => {
          setTasks(rows);
          setError("");
        })
        .catch((e) => setError(errorMessage(e, "No pude cargar las tareas")))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      getTasks()
        .then((rows) => {
          if (cancelled) return;
          setTasks(rows);
          setError("");
        })
        .catch((e) => !cancelled && setError(errorMessage(e, "No pude cargar las tareas")))
        .finally(() => !cancelled && setLoading(false));
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const replace = (row: TaskRow) => setTasks((prev) => prev.map((t) => (t.id === row.id ? row : t)));

  const open = useMemo(() => tasks.filter((t) => t.status !== "hecha").sort(sortOpen), [tasks]);
  const done = useMemo(() => tasks.filter((t) => t.status === "hecha").sort(sortDone), [tasks]);
  const visible = filter === "abiertas" ? open : filter === "hechas" ? done : [...open, ...done];
  const overdueCount = open.filter((t) => isOverdue(t)).length;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.title.trim();
    if (!title || saving) return;
    setSaving(true);
    try {
      const maxOrder = tasks.reduce((m, t) => Math.max(m, t.sort_order), 0);
      const row = await addTask({ ...draft, title, details: draft.details.trim() }, maxOrder + 1);
      setTasks((prev) => [...prev, row]);
      setDraft(EMPTY_DRAFT);
      setShowMore(false);
      if (filter === "hechas") setFilter("abiertas");
    } catch (err) {
      setError(errorMessage(err, "No pude guardar la tarea"));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(task: TaskRow, status: TaskStatus) {
    try {
      replace(await updateTask(task.id, { status }));
    } catch (err) {
      setError(errorMessage(err, "No pude cambiar el estado"));
    }
  }

  async function handleDelete(task: TaskRow) {
    setDeleting(null);
    try {
      await deleteTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (err) {
      setError(errorMessage(err, "No pude borrar la tarea"));
    }
  }

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "abiertas", label: "Abiertas", count: open.length },
    { id: "hechas", label: "Hechas", count: done.length },
    { id: "todas", label: "Todas", count: tasks.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Tareas para el asistente</h2>
          <p className="text-sm text-muted">
            Déjale tareas y sigue su avance. En el chat, pídele por ejemplo{" "}
            <span className="text-foreground">"revisa mis tareas pendientes"</span>.
          </p>
        </div>
        <button
          onClick={() => load()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          title="Volver a cargar"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {/* Nueva tarea */}
      <form onSubmit={handleAdd} className="bg-surface border border-border rounded-xl p-3 space-y-3">
        <div className="flex gap-2">
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Nueva tarea, por ejemplo: Prepara el guion del video del lunes"
            className={inputClass}
            maxLength={300}
          />
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="shrink-0 flex items-center gap-1 px-3 rounded-lg text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            aria-expanded={showMore}
          >
            Más
            <ChevronDown className={`w-4 h-4 transition-transform ${showMore ? "rotate-180" : ""}`} />
          </button>
          <button
            type="submit"
            disabled={!draft.title.trim() || saving}
            className="shrink-0 flex items-center gap-1.5 px-4 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold disabled:opacity-40 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        </div>
        {showMore && (
          <div className="grid gap-3 sm:grid-cols-[1fr_160px_170px]">
            <textarea
              value={draft.details}
              onChange={(e) => setDraft({ ...draft, details: e.target.value })}
              placeholder="Detalles: qué tiene que hacer, dónde, cómo sabes que está listo…"
              rows={3}
              className={`${inputClass} resize-y`}
            />
            <label className="text-xs text-muted space-y-1">
              Prioridad
              <PrioritySelect value={draft.priority} onChange={(priority) => setDraft({ ...draft, priority })} />
            </label>
            <label className="text-xs text-muted space-y-1">
              Fecha límite
              <input
                type="date"
                value={draft.due_date ?? ""}
                onChange={(e) => setDraft({ ...draft, due_date: e.target.value || null })}
                className={inputClass}
              />
            </label>
          </div>
        )}
      </form>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === f.id ? "bg-surface-hover text-foreground font-medium" : "text-muted hover:text-foreground"
            }`}
          >
            {f.label} <span className="text-muted">{f.count}</span>
          </button>
        ))}
        {overdueCount > 0 && (
          <span className="ml-auto text-xs text-red-300">
            {overdueCount === 1 ? "1 tarea vencida" : `${overdueCount} tareas vencidas`}
          </span>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted py-6">Cargando…</p>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <p className="text-sm text-muted">
            {filter === "hechas"
              ? "Todavía no hay tareas hechas."
              : "No hay tareas abiertas. Escribe una arriba para dejársela al asistente."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={() => setStatus(task, task.status === "hecha" ? "pendiente" : "hecha")}
              onStatus={(s) => setStatus(task, s)}
              onEdit={() => setEditing(task)}
              onDelete={() => setDeleting(task)}
            />
          ))}
        </ul>
      )}

      {editing && (
        <TaskEditModal
          task={editing}
          onClose={() => setEditing(null)}
          onSaved={(row) => {
            replace(row);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Borrar tarea"
          message={`¿Borrar "${deleting.title}"? No se puede deshacer.`}
          confirmLabel="Borrar"
          onConfirm={() => handleDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

// ============================================
// UNA TAREA
// ============================================

function TaskItem({
  task,
  onToggle,
  onStatus,
  onEdit,
  onDelete,
}: {
  task: TaskRow;
  onToggle: () => void;
  onStatus: (s: TaskStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isDone = task.status === "hecha";
  const overdue = isOverdue(task, caracasToday());

  return (
    <li className="group bg-surface border border-border rounded-xl p-3 flex gap-3">
      <button
        onClick={onToggle}
        aria-label={isDone ? "Marcar como pendiente" : "Marcar como hecha"}
        className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
          isDone ? "bg-emerald-500 border-emerald-500" : "border-muted/50 hover:border-primary"
        }`}
      >
        {isDone && <Check className="w-3.5 h-3.5 text-white" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            onClick={onEdit}
            className={`text-left text-sm font-medium hover:text-primary-hover transition-colors ${
              isDone ? "line-through text-muted" : ""
            }`}
          >
            {task.title}
          </button>
          {!isDone && (
            <span className={`text-[11px] font-medium ${PRIORITY_CLASS[task.priority]}`}>
              {PRIORITY_LABEL[task.priority]}
            </span>
          )}
          {task.due_date && (
            <span
              className={`flex items-center gap-1 text-[11px] ${overdue ? "text-red-300" : "text-muted"}`}
              title={overdue ? "Vencida" : "Fecha límite"}
            >
              <CalendarDays className="w-3 h-3" />
              {formatDue(task.due_date)}
              {overdue && " · vencida"}
            </span>
          )}
          {task.updated_by === "agent" && (
            <span
              className="flex items-center gap-1 text-[11px] text-primary-hover"
              title="El asistente fue el último en tocarla"
            >
              <Bot className="w-3 h-3" />
              Asistente
            </span>
          )}
        </div>

        {task.details && (
          <p className="mt-1 text-xs text-muted line-clamp-2 whitespace-pre-line">{task.details}</p>
        )}

        {task.result && (
          <div className="mt-2 rounded-lg bg-background border border-border px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted mb-0.5">Reporte del asistente</p>
            <p className="text-xs text-foreground whitespace-pre-line line-clamp-4">{task.result}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <select
          value={task.status}
          onChange={(e) => onStatus(e.target.value as TaskStatus)}
          aria-label="Estado"
          className={`text-[11px] font-medium rounded-md px-2 py-1 border-0 cursor-pointer focus:outline-none ${STATUS_CLASS[task.status]}`}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s} className="bg-surface text-foreground">
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          onClick={onDelete}
          aria-label="Borrar tarea"
          className="p-1 rounded text-muted opacity-60 sm:opacity-0 group-hover:opacity-100 hover:text-red-400 transition"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
}

// ============================================
// EDITAR
// ============================================

function TaskEditModal({
  task,
  onClose,
  onSaved,
}: {
  task: TaskRow;
  onClose: () => void;
  onSaved: (row: TaskRow) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [details, setDetails] = useState(task.details);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [result, setResult] = useState(task.result);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!title.trim()) {
      setError("La tarea necesita un título.");
      return;
    }
    setSaving(true);
    try {
      const row = await updateTask(task.id, {
        title: title.trim(),
        details: details.trim(),
        priority,
        due_date: dueDate || null,
        result: result.trim(),
        ...(status !== task.status ? { status } : {}),
      });
      onSaved(row);
    } catch (e) {
      setError(errorMessage(e, "No pude guardar los cambios"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="relative bg-surface border border-border rounded-xl p-5 w-full max-w-lg max-h-[90dvh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover"
        >
          <X className="w-4 h-4" />
        </button>
        <h3 className="font-semibold pr-8">Editar tarea</h3>

        <label className="block text-xs text-muted space-y-1">
          Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} maxLength={300} />
        </label>
        <label className="block text-xs text-muted space-y-1">
          Detalles
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} className={`${inputClass} resize-y`} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted space-y-1">
            Estado
            <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className={inputClass}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted space-y-1">
            Prioridad
            <PrioritySelect value={priority} onChange={setPriority} />
          </label>
          <label className="text-xs text-muted space-y-1">
            Fecha límite
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </label>
        </div>
        <label className="block text-xs text-muted space-y-1">
          Reporte del asistente
          <textarea
            value={result}
            onChange={(e) => setResult(e.target.value)}
            rows={3}
            placeholder="Lo escribe el asistente al avanzar o terminar."
            className={`${inputClass} resize-y`}
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-center pt-1">
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PrioritySelect({ value, onChange }: { value: TaskPriority; onChange: (p: TaskPriority) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as TaskPriority)} className={inputClass}>
      {(["alta", "media", "baja"] as TaskPriority[]).map((p) => (
        <option key={p} value={p}>
          {PRIORITY_LABEL[p]}
        </option>
      ))}
    </select>
  );
}
