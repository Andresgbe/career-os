import { useState } from "react";
import {
  X,
  Pencil,
  Trash2,
  Link2,
  KeyRound,
  Image as ImageIcon,
  StickyNote,
  Eye,
  EyeOff,
  ExternalLink,
  CheckSquare,
  Square,
  DollarSign,
} from "lucide-react";
import { deleteProject, getProjectFileUrl } from "../api";
import type { ProjectRow, ResourceType } from "../types";
import { PAYMENT_STATUSES, PROJECT_STATUSES, RESOURCE_TYPES } from "../types";
import ConfirmDialog from "./ConfirmDialog";

const RESOURCE_ICON: Record<ResourceType, typeof Link2> = {
  link: Link2,
  credential: KeyRound,
  image: ImageIcon,
  note: StickyNote,
};

const PAYMENT_STYLE: Record<ProjectRow["payment_status"], string> = {
  unpaid: "text-red-400 bg-red-400/10",
  partial: "text-amber-400 bg-amber-400/10",
  paid: "text-emerald-400 bg-emerald-400/10",
};

interface ProjectDetailProps {
  project: ProjectRow;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: (id: string) => void;
}

export default function ProjectDetail({
  project,
  onClose,
  onEdit,
  onDeleted,
}: ProjectDetailProps) {
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  const status = PROJECT_STATUSES.find((s) => s.value === project.status)!;
  const paymentLabel = PAYMENT_STATUSES.find(
    (p) => p.value === project.payment_status
  )?.label;

  const togglePassword = (id: string) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const viewImage = async (path: string) => {
    try {
      const url = await getProjectFileUrl(path);
      window.open(url, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open image");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProject(project.id);
      onDeleted(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setConfirmingDelete(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-xl font-bold truncate">{project.name}</h2>
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${status.bg} ${status.color}`}
              >
                {status.label}
              </span>
            </div>
            {project.client && (
              <p className="text-sm text-muted">{project.client}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-muted hover:bg-surface-hover shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        <div className="space-y-5">
          {project.description && (
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {project.description}
            </p>
          )}

          {(project.budget !== null || project.payment_status !== "unpaid") && (
            <div className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${PAYMENT_STYLE[project.payment_status]}`}
              >
                <DollarSign className="w-4 h-4" />
                {project.budget !== null
                  ? project.budget.toLocaleString()
                  : "—"}
                <span className="text-xs font-normal opacity-80">
                  ({paymentLabel})
                </span>
              </span>
            </div>
          )}

          {project.tech_stack.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted font-medium mb-2">
                Tech stack
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {project.tech_stack.map((tech) => (
                  <span
                    key={tech}
                    className="text-xs px-2 py-1 bg-surface-hover rounded-full text-foreground"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {project.milestones.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted font-medium mb-2">
                Milestones
              </h3>
              <ul className="space-y-1.5">
                {project.milestones.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    {m.done ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-muted shrink-0" />
                    )}
                    <span
                      className={m.done ? "text-muted line-through" : "text-foreground"}
                    >
                      {m.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {project.resources.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted font-medium mb-2">
                Resources
              </h3>
              <div className="space-y-2">
                {project.resources.map((resource) => {
                  const Icon = RESOURCE_ICON[resource.type];
                  const typeLabel = RESOURCE_TYPES.find(
                    (t) => t.value === resource.type
                  )?.label;

                  return (
                    <div
                      key={resource.id}
                      className="bg-background border border-border rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-medium truncate">
                          {resource.label || typeLabel}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-muted ml-auto shrink-0">
                          {typeLabel}
                        </span>
                      </div>

                      {resource.type === "link" && resource.value && (
                        <a
                          href={resource.value}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-sm text-primary hover:underline break-all"
                        >
                          {resource.value}
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        </a>
                      )}

                      {resource.type === "note" && resource.value && (
                        <p className="text-sm text-muted whitespace-pre-wrap font-mono">
                          {resource.value}
                        </p>
                      )}

                      {resource.type === "credential" && (
                        <div className="text-sm space-y-1">
                          {resource.username && (
                            <p>
                              <span className="text-muted">User: </span>
                              {resource.username}
                            </p>
                          )}
                          {resource.password && (
                            <p className="flex items-center gap-2">
                              <span className="text-muted">Password: </span>
                              <span className="font-mono">
                                {visiblePasswords.has(resource.id)
                                  ? resource.password
                                  : "•".repeat(resource.password.length)}
                              </span>
                              <button
                                onClick={() => togglePassword(resource.id)}
                                className="text-muted hover:text-primary"
                              >
                                {visiblePasswords.has(resource.id) ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </p>
                          )}
                        </div>
                      )}

                      {resource.type === "image" && resource.file_path && (
                        <button
                          onClick={() => viewImage(resource.file_path)}
                          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View image
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <button
            onClick={() => setConfirmingDelete(true)}
            className="flex items-center gap-2 px-4 py-2 rounded text-red-400 hover:bg-surface-hover text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete project?"
          message={`"${project.name}" will be permanently deleted.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
