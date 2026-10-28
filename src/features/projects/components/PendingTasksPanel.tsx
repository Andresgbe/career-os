import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ListTodo } from "lucide-react";
import { todayIso } from "../../../lib/dates";
import { formatDue, projectAccent, projectInitials } from "../types";
import type { BoardColumnRow, BoardTaskRow, ProjectRow } from "../types";

export type PendingTask = Pick<
  BoardTaskRow,
  "id" | "project_id" | "column_id" | "title" | "tag" | "due" | "created_at"
>;

interface PendingTasksPanelProps {
  projects: ProjectRow[];
  columns: BoardColumnRow[];
  tasks: PendingTask[];
}

type SortMode = "due" | "recent";

const OPEN_KEY = "projects-pending-open";
const LIMIT = 10;

// Columns are user-made, so "done" is guessed from the name.
const DONE_COLUMN = /hecho|done|terminad|complet|listo|cerrad|finaliz/i;

// Tasks from every project's board in one list, so it's clear what's
// pending without opening each project.
export default function PendingTasksPanel({ projects, columns, tasks }: PendingTasksPanelProps) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [sort, setSort] = useState<SortMode>("due");
  const [showAll, setShowAll] = useState(false);

  const toggleOpen = () => {
    setOpen((prev) => {
      try {
        localStorage.setItem(OPEN_KEY, prev ? "0" : "1");
      } catch {
        // private mode — it just won't be remembered
      }
      return !prev;
    });
  };

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const columnById = new Map(columns.map((c) => [c.id, c]));
  const today = todayIso();

  const pending = tasks.filter((t) => {
    const column = columnById.get(t.column_id);
    return column && projectById.has(t.project_id) && !DONE_COLUMN.test(column.name);
  });

  const sorted = [...pending].sort((a, b) => {
    if (sort === "recent") return b.created_at.localeCompare(a.created_at);
    // By due date, soonest first; tasks without one go last, newest first
    if (a.due && b.due) return a.due.localeCompare(b.due);
    if (a.due) return -1;
    if (b.due) return 1;
    return b.created_at.localeCompare(a.created_at);
  });
  const visible = showAll ? sorted : sorted.slice(0, LIMIT);
  const overdue = pending.filter((t) => t.due && t.due < today).length;

  return (
    <section className="bg-surface border border-border rounded-2xl">
      <button
        onClick={toggleOpen}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 text-left"
      >
        <span className="w-9 h-9 rounded-[10px] bg-primary/15 text-primary-hover flex items-center justify-center shrink-0">
          <ListTodo className="w-4 h-4" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-sm">Pendientes</span>
          <span className="block text-xs text-muted">
            {pending.length === 0
              ? "Nada pendiente en los tableros"
              : `${pending.length} tareas en ${new Set(pending.map((t) => t.project_id)).size} proyectos`}
            {overdue > 0 && <span className="text-red-400"> · {overdue} vencidas</span>}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>

      {open && pending.length > 0 && (
        <div className="px-3 sm:px-5 pb-4 sm:pb-5 space-y-3">
          <div className="flex gap-1 p-1 w-fit rounded-xl bg-background border border-border">
            {(
              [
                { id: "due", label: "Por fecha límite" },
                { id: "recent", label: "Más recientes" },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                onClick={() => setSort(mode.id)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  sort === mode.id
                    ? "bg-surface-hover text-foreground font-semibold"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
            {visible.map((task) => {
              const project = projectById.get(task.project_id)!;
              const column = columnById.get(task.column_id)!;
              const accent = projectAccent(project.name);
              const late = task.due !== null && task.due < today;
              const dueToday = task.due === today;
              return (
                <li key={task.id}>
                  <Link
                    to={`/projects/${project.id}`}
                    className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-3.5 py-2.5 bg-background hover:bg-surface-hover transition-colors"
                  >
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
                      style={{ backgroundColor: `${accent}22`, color: accent }}
                      title={project.name}
                    >
                      {projectInitials(project.name)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm truncate">{task.title || "Sin título"}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted">
                        <span className="truncate">{project.name}</span>
                        <span className="shrink-0">·</span>
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: column.color }}
                        />
                        <span className="truncate">{column.name}</span>
                        {task.tag && (
                          <span className="hidden sm:inline shrink-0 px-1.5 rounded bg-surface-hover">
                            {task.tag}
                          </span>
                        )}
                      </span>
                    </span>
                    {task.due && (
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                          late
                            ? "bg-red-500/15 text-red-400"
                            : dueToday
                              ? "bg-amber-400/15 text-amber-300"
                              : "bg-surface-hover text-muted"
                        }`}
                      >
                        {late && <span className="hidden sm:inline">Vencida · </span>}
                        {dueToday && "Hoy · "}
                        {formatDue(task.due)}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {sorted.length > LIMIT && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="text-xs text-muted hover:text-foreground"
            >
              {showAll ? "Ver solo 10" : `Ver todas (${sorted.length})`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
