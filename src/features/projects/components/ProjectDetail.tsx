import { useEffect, useState } from "react";
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
import type { ProjectRow } from "../types";
import { PAYMENT_STATUSES, PROJECT_STATUSES, RESOURCE_STYLE } from "../types";
import ConfirmDialog from "./ConfirmDialog";

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
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  const status = PROJECT_STATUSES.find((s) => s.value === project.status)!;
  const paymentLabel = PAYMENT_STATUSES.find(
    (p) => p.value === project.payment_status
  )?.label;

  const images = project.resources.filter((r) => r.type === "image" && r.file_path);
  const links = project.resources.filter((r) => r.type === "link");
  const credentials = project.resources.filter((r) => r.type === "credential");
  const notes = project.resources.filter((r) => r.type === "note");

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      images.map(async (img) => {
        try {
          const url = await getProjectFileUrl(img.file_path);
          return [img.id, url] as const;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const r of results) if (r) next[r[0]] = r[1];
      setImageUrls(next);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const togglePassword = (id: string) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
        className="bg-surface border border-border rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
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

        <div className="space-y-6">
          {project.description && (
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {project.description}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {(project.budget !== null || project.payment_status !== "unpaid") && (
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
            )}
            {project.tech_stack.map((tech) => (
              <span
                key={tech}
                className="text-xs px-2 py-1 bg-surface-hover rounded-full text-foreground"
              >
                {tech}
              </span>
            ))}
          </div>

          {project.milestones.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-wider text-muted font-semibold mb-2">
                Milestones
              </h3>
              <ul className="space-y-1.5">
                {project.milestones.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
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
            </section>
          )}

          {/* Images gallery */}
          {images.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-wider text-muted font-semibold mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                Images
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {images.map((img) => (
                  <a
                    key={img.id}
                    href={imageUrls[img.id] ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative aspect-video rounded-lg overflow-hidden border border-border bg-background block"
                  >
                    {imageUrls[img.id] ? (
                      <img
                        src={imageUrls[img.id]}
                        alt={img.label || "Project image"}
                        className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted">
                        <ImageIcon className="w-6 h-6 animate-pulse" />
                      </div>
                    )}
                    {img.label && (
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[11px] px-2 py-1 truncate">
                        {img.label}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Links */}
          {links.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-wider text-muted font-semibold mb-2 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                Links
              </h3>
              <div className="space-y-2">
                {links.map((resource) => (
                  <a
                    key={resource.id}
                    href={resource.value}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 bg-background border border-border rounded-lg p-3 hover:border-primary transition-colors"
                  >
                    <span className={`p-1.5 rounded shrink-0 ${RESOURCE_STYLE.link.bg}`}>
                      <Link2 className={`w-4 h-4 ${RESOURCE_STYLE.link.color}`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      {resource.label && (
                        <p className="text-sm font-medium truncate">{resource.label}</p>
                      )}
                      <p className="text-xs text-primary truncate">{resource.value}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted shrink-0" />
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Credentials */}
          {credentials.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-wider text-muted font-semibold mb-2 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                Credentials
              </h3>
              <div className="space-y-2">
                {credentials.map((resource) => (
                  <div
                    key={resource.id}
                    className="bg-background border border-border rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`p-1.5 rounded shrink-0 ${RESOURCE_STYLE.credential.bg}`}>
                        <KeyRound className={`w-4 h-4 ${RESOURCE_STYLE.credential.color}`} />
                      </span>
                      {resource.label && (
                        <p className="text-sm font-medium truncate">{resource.label}</p>
                      )}
                    </div>
                    <div className="text-sm space-y-1 pl-9">
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
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Notes */}
          {notes.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-wider text-muted font-semibold mb-2 flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5" />
                Notes
              </h3>
              <div className="space-y-2">
                {notes.map((resource) => (
                  <div
                    key={resource.id}
                    className="bg-background border border-border rounded-lg p-3"
                  >
                    {resource.label && (
                      <p className="text-sm font-medium mb-1">{resource.label}</p>
                    )}
                    {resource.value && (
                      <p className="text-sm text-muted whitespace-pre-wrap">
                        {resource.value}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
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
