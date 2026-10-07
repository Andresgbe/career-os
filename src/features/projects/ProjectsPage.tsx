import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Table2, LayoutGrid, Search } from "lucide-react";
import ProjectCard from "./components/ProjectCard";
import ProjectTable from "./components/ProjectTable";
import ProjectModal from "./components/ProjectModal";
import { getProjects } from "./api";
import { getTasks } from "../tasks/api";
import type { ProjectRow } from "./types";

type ViewMode = "table" | "cards";
const VIEW_KEY = "projects-view";

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [openTaskCount, setOpenTaskCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "cards" ? "cards" : "table";
    } catch {
      return "table";
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

    // Open task count per project, shown as a property on each row
    getTasks()
      .then((tasks) => {
        const counts: Record<string, number> = {};
        for (const t of tasks) {
          if (!t.project_id || t.done) continue;
          counts[t.project_id] = (counts[t.project_id] ?? 0) + 1;
        }
        setOpenTaskCount(counts);
      })
      .catch(() => {
        // tasks are a nice-to-have here; the project list still works
      });
  }, []);

  const openProject = (project: ProjectRow) => navigate(`/projects/${project.id}`);

  const handleSaved = (saved: ProjectRow) => {
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      return exists
        ? prev.map((p) => (p.id === saved.id ? saved : p))
        : [...prev, saved];
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

  if (loading) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1">Project Management</h1>
          <p className="text-sm text-muted">
            Track your personal and freelance software projects.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add project
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl">
          {error}
        </div>
      )}

      {/* View switcher + search, the way a Notion database header works */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
          <button
            onClick={() => setView("table")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              view === "table"
                ? "bg-surface-hover text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Table2 className="w-3.5 h-3.5" />
            Tabla
          </button>
          <button
            onClick={() => setView("cards")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              view === "cards"
                ? "bg-surface-hover text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Tarjetas
          </button>
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            type="text"
            placeholder="Buscar proyecto, cliente o stack..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:border-primary outline-none"
          />
        </div>

        <span className="text-xs text-muted">
          {visibleProjects.length} de {projects.length}
        </span>
      </div>

      {visibleProjects.length === 0 ? (
        <p className="text-sm text-muted">
          {projects.length === 0
            ? "No projects yet."
            : "Ningún proyecto coincide con la búsqueda."}
        </p>
      ) : view === "table" ? (
        <ProjectTable
          projects={visibleProjects}
          openTaskCount={openTaskCount}
          onOpen={openProject}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              openTasks={openTaskCount[project.id] ?? 0}
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
