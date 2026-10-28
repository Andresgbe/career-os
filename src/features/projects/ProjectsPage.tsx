import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import ProjectCard from "./components/ProjectCard";
import ProjectTable from "./components/ProjectTable";
import ProjectModal from "./components/ProjectModal";
import PendingTasksPanel, { type PendingTask } from "./components/PendingTasksPanel";
import { getProjects, getBoardSummaries, getProjectAccess } from "./api";
import type { BoardColumnRow, ColumnCount, ProjectAccess, ProjectRow } from "./types";
import { usePermissions } from "../../hooks/usePermissions";

type ViewMode = "table" | "cards";
const VIEW_KEY = "projects-view";

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [boards, setBoards] = useState<Record<string, ColumnCount[]>>({});
  const [boardColumns, setBoardColumns] = useState<BoardColumnRow[]>([]);
  const [boardTasks, setBoardTasks] = useState<PendingTask[]>([]);
  const [access, setAccess] = useState<Record<string, ProjectAccess>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "cards";
    } catch {
      return "cards";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // private mode — the view choice just won't persist
    }
  }, [view]);

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    // How many tasks sit in each column, shown on every project. A
    // nice-to-have: the list still works if the board tables aren't there.
    getBoardSummaries()
      .then(({ columns, tasks }) => {
        const counts = new Map<string, number>();
        for (const t of tasks) counts.set(t.column_id, (counts.get(t.column_id) ?? 0) + 1);
        const byProject: Record<string, ColumnCount[]> = {};
        for (const c of columns) {
          (byProject[c.project_id] ??= []).push({
            name: c.name,
            color: c.color,
            count: counts.get(c.id) ?? 0,
          });
        }
        setBoards(byProject);
        setBoardColumns(columns);
        setBoardTasks(tasks);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    getProjectAccess().then(setAccess).catch(() => {});
  }, [isAdmin]);

  const openProject = (project: ProjectRow) => navigate(`/projects/${project.id}`);

  const handleSaved = (saved: ProjectRow) => {
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved];
    });
    setShowModal(false);
  };

  const handleDeleted = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setShowModal(false);
  };

  const needle = search.trim().toLowerCase();
  const visibleProjects = needle
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.client.toLowerCase().includes(needle) ||
          p.tech_stack.some((t) => t.toLowerCase().includes(needle))
      )
    : projects;

  if (loading) return <p className="text-sm text-muted">Cargando...</p>;

  const totalTasks = Object.values(boards)
    .flat()
    .reduce((sum, c) => sum + c.count, 0);
  const sharedCount = Object.values(access).filter((a) => a !== "private").length;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Proyectos</h1>
          <p className="text-sm text-muted mt-1">
            {isAdmin
              ? "Tus proyectos de la agencia y lo que cada cliente puede ver."
              : "Los proyectos que compartieron contigo."}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 h-11 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo proyecto
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Stat label="Proyectos" value={projects.length} />
          <Stat label="Tareas en tableros" value={totalTasks} />
          <Stat label="Compartidos con clientes" value={sharedCount} />
        </div>
      )}

      {isAdmin && (
        <PendingTasksPanel projects={projects} columns={boardColumns} tasks={boardTasks} />
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl">{error}</div>
      )}

      <div className="flex items-center gap-2.5 flex-wrap">
        {isAdmin && (
          <label className="flex-1 min-w-0 flex items-center gap-2 h-[42px] px-3.5 rounded-xl bg-surface border border-border focus-within:border-primary transition-colors">
            <Search className="w-4 h-4 text-muted shrink-0" />
            <span className="sr-only">Buscar proyectos</span>
            <input
              type="search"
              placeholder="Buscar por nombre o stack"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 bg-transparent outline-none text-sm"
            />
          </label>
        )}
        <div className="flex gap-1 p-1 rounded-xl bg-surface border border-border">
          {(["cards", "table"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={`px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                view === mode ? "bg-surface-hover text-foreground font-semibold" : "text-muted hover:text-foreground"
              }`}
            >
              {mode === "cards" ? "Tarjetas" : "Tabla"}
            </button>
          ))}
        </div>
      </div>

      {visibleProjects.length === 0 ? (
        <p className="text-sm text-muted">
          {projects.length === 0 ? "Todavía no hay proyectos." : "Ningún proyecto coincide con la búsqueda."}
        </p>
      ) : view === "table" ? (
        <ProjectTable
          projects={visibleProjects}
          boards={boards}
          access={isAdmin ? access : null}
          onOpen={openProject}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {visibleProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              columns={boards[project.id] ?? []}
              access={isAdmin ? (access[project.id] ?? "private") : null}
              onClick={() => openProject(project)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <ProjectModal
          project={null}
          nextSortOrder={projects.length}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-3 sm:px-[18px] py-3 sm:py-4 rounded-2xl bg-surface border border-border min-w-0">
      <p className="text-[11px] sm:text-[13px] text-muted leading-tight">{label}</p>
      <p className="text-xl sm:text-[26px] font-bold mt-1.5 leading-none">{value}</p>
    </div>
  );
}
