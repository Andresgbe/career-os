import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import ProjectCard from "./components/ProjectCard";
import ProjectModal from "./components/ProjectModal";
import ProjectDetail from "./components/ProjectDetail";
import { getProjects } from "./api";
import type { ProjectRow, ProjectStatus } from "./types";
import { PROJECT_STATUSES } from "./types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<ProjectRow | null>(null);
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const startAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const startView = (project: ProjectRow) => setViewing(project);

  const startEdit = (project: ProjectRow) => {
    setViewing(null);
    setEditing(project);
    setShowModal(true);
  };

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
    setViewing(null);
  };

  const visibleProjects =
    statusFilter === "all"
      ? projects
      : projects.filter((p) => p.status === statusFilter);

  if (loading) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1">Project Management</h1>
          <p className="text-sm text-muted">
            Track your personal and freelance software projects.
          </p>
        </div>
        <button
          onClick={startAdd}
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

      {/* Status filter */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setStatusFilter("all")}
          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
            statusFilter === "all"
              ? "bg-primary text-white"
              : "bg-surface-hover text-muted hover:text-foreground"
          }`}
        >
          All ({projects.length})
        </button>
        {PROJECT_STATUSES.map((status) => {
          const count = projects.filter((p) => p.status === status.value).length;
          return (
            <button
              key={status.value}
              onClick={() => setStatusFilter(status.value)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                statusFilter === status.value
                  ? "bg-primary text-white"
                  : `${status.bg} ${status.color} hover:opacity-80`
              }`}
            >
              {status.label} ({count})
            </button>
          );
        })}
      </div>

      {visibleProjects.length === 0 ? (
        <p className="text-sm text-muted">No projects yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => startView(project)}
            />
          ))}
        </div>
      )}

      {viewing && (
        <ProjectDetail
          project={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => startEdit(viewing)}
          onDeleted={handleDeleted}
        />
      )}

      {showModal && (
        <ProjectModal
          project={editing}
          defaultStatus="planning"
          nextSortOrder={projects.length}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
