import { useEffect, useState } from "react";
import { Plus, FolderKanban, Link2 } from "lucide-react";
import ProjectModal from "../components/ProjectModal";
import { getWorkProjects } from "../api";
import type { WorkProjectRow } from "../types";

export default function ProjectsTab() {
  const [projects, setProjects] = useState<WorkProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<WorkProjectRow | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    getWorkProjects()
      .then(setProjects)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const startAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const startEdit = (project: WorkProjectRow) => {
    setEditing(project);
    setShowModal(true);
  };

  const handleSaved = (saved: WorkProjectRow) => {
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

  if (loading) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Projects</h2>
        <button
          onClick={startAdd}
          className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add project
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {projects.length === 0 ? (
        <p className="text-sm text-muted">No projects yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => startEdit(project)}
              className="group bg-surface border border-border rounded-xl p-5 hover:border-primary transition-all cursor-pointer hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <FolderKanban className="w-6 h-6 text-primary" />
                </div>
                {project.resources.length > 0 && (
                  <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 bg-surface-hover rounded-full text-muted">
                    <Link2 className="w-3 h-3" />
                    {project.resources.length}
                  </span>
                )}
              </div>

              <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors truncate">
                {project.name}
              </h3>

              {project.description && (
                <p className="text-sm text-muted line-clamp-3">
                  {project.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ProjectModal
          project={editing}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
