import { useRef, useState } from "react";
import {
  X,
  Save,
  Trash2,
  Plus,
  Link2,
  Tag,
  KeyRound,
  Image as ImageIcon,
  StickyNote,
  Eye,
  EyeOff,
  Upload,
} from "lucide-react";
import {
  saveProject,
  deleteProject,
  uploadProjectImage,
  getProjectFileUrl,
} from "../api";
import type {
  ProjectMilestone,
  ProjectResource,
  ProjectRow,
  ProjectStatus,
  PaymentStatus,
  ResourceType,
} from "../types";
import {
  PROJECT_STATUSES,
  PAYMENT_STATUSES,
  RESOURCE_TYPES,
  RESOURCE_STYLE,
} from "../types";
import ConfirmDialog from "./ConfirmDialog";

interface ProjectForm {
  name: string;
  client: string;
  description: string;
  status: ProjectStatus;
  budget: string;
  payment_status: PaymentStatus;
  tech_stack: string[];
  resources: ProjectResource[];
  milestones: ProjectMilestone[];
}

const emptyResource: ProjectResource = {
  id: "",
  type: "link",
  label: "",
  value: "",
  username: "",
  password: "",
  file_path: "",
};

const emptyForm: ProjectForm = {
  name: "",
  client: "",
  description: "",
  status: "planning",
  budget: "",
  payment_status: "unpaid",
  tech_stack: [],
  resources: [],
  milestones: [],
};

function toForm(project: ProjectRow): ProjectForm {
  return {
    name: project.name,
    client: project.client,
    description: project.description,
    status: project.status,
    budget: project.budget === null ? "" : String(project.budget),
    payment_status: project.payment_status,
    tech_stack: [...project.tech_stack],
    resources: project.resources.map((r) => ({ ...r })),
    milestones: project.milestones.map((m) => ({ ...m })),
  };
}

const RESOURCE_ICON: Record<ResourceType, typeof Link2> = {
  link: Link2,
  credential: KeyRound,
  image: ImageIcon,
  note: StickyNote,
};

interface ProjectModalProps {
  project: ProjectRow | null; // null = adding a new project
  defaultStatus: ProjectStatus;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (project: ProjectRow) => void;
  onDeleted: (id: string) => void;
}

export default function ProjectModal({
  project,
  defaultStatus,
  nextSortOrder,
  onClose,
  onSaved,
  onDeleted,
}: ProjectModalProps) {
  const [form, setForm] = useState<ProjectForm>(
    project ? toForm(project) : { ...emptyForm, status: defaultStatus }
  );
  const [techInput, setTechInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set());

  const activeUploadIndex = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tech stack tags
  const addTech = () => {
    const value = techInput.trim();
    if (!value || form.tech_stack.includes(value)) {
      setTechInput("");
      return;
    }
    setForm({ ...form, tech_stack: [...form.tech_stack, value] });
    setTechInput("");
  };
  const removeTech = (tech: string) =>
    setForm({ ...form, tech_stack: form.tech_stack.filter((t) => t !== tech) });

  // Resources
  const setResource = (index: number, fields: Partial<ProjectResource>) => {
    const resources = [...form.resources];
    resources[index] = { ...resources[index], ...fields };
    setForm({ ...form, resources });
  };
  const addResource = () =>
    setForm({
      ...form,
      resources: [
        ...form.resources,
        { ...emptyResource, id: crypto.randomUUID(), type: "note" },
      ],
    });
  const removeResource = (index: number) =>
    setForm({
      ...form,
      resources: form.resources.filter((_, i) => i !== index),
    });

  const togglePasswordVisible = (index: number) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const triggerImageUpload = (index: number) => {
    activeUploadIndex.current = index;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const index = activeUploadIndex.current;
    if (!file || index === null) return;

    setUploadingIndex(index);
    setError("");
    try {
      const path = await uploadProjectImage(file);
      setResource(index, {
        file_path: path,
        label: form.resources[index].label || file.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingIndex(null);
      activeUploadIndex.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const viewImage = async (path: string) => {
    try {
      const url = await getProjectFileUrl(path);
      window.open(url, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open image");
    }
  };

  // Milestones
  const setMilestone = (index: number, fields: Partial<ProjectMilestone>) => {
    const milestones = [...form.milestones];
    milestones[index] = { ...milestones[index], ...fields };
    setForm({ ...form, milestones });
  };
  const addMilestone = () =>
    setForm({
      ...form,
      milestones: [
        ...form.milestones,
        { id: crypto.randomUUID(), title: "", done: false },
      ],
    });
  const removeMilestone = (index: number) =>
    setForm({
      ...form,
      milestones: form.milestones.filter((_, i) => i !== index),
    });

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Project name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await saveProject(
        {
          name: form.name.trim(),
          client: form.client.trim(),
          description: form.description.trim(),
          status: form.status,
          budget: form.budget.trim() === "" ? null : Number(form.budget),
          payment_status: form.payment_status,
          tech_stack: form.tech_stack,
          resources: form.resources
            .map((r) => ({
              ...r,
              label: r.label.trim(),
              value: r.value.trim(),
              username: r.username.trim(),
            }))
            .filter(
              (r) => r.label || r.value || r.username || r.password || r.file_path
            ),
          milestones: form.milestones
            .map((m) => ({ ...m, title: m.title.trim() }))
            .filter((m) => m.title),
        },
        project?.id ?? null,
        nextSortOrder
      );
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving project");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
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
        className="bg-surface border border-border rounded-xl p-5 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelected}
          className="hidden"
        />

        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">
            {project ? "Edit project" : "Add project"}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-muted hover:bg-surface-hover"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Project name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Client (optional)</label>
              <input
                type="text"
                placeholder="Who is this for?"
                value={form.client}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
                className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Description</label>
            <textarea
              rows={5}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none resize-y min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as ProjectStatus })
                }
                className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Budget (optional)</label>
              <input
                type="number"
                step="0.01"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Payment status</label>
              <select
                value={form.payment_status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    payment_status: e.target.value as PaymentStatus,
                  })
                }
                className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
              >
                {PAYMENT_STATUSES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tech stack */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted">Tech stack</label>
            <div className="flex flex-wrap gap-1.5">
              {form.tech_stack.map((tech) => (
                <span
                  key={tech}
                  className="flex items-center gap-1 text-xs px-2 py-1 bg-surface-hover rounded-full text-muted"
                >
                  {tech}
                  <button
                    onClick={() => removeTech(tech)}
                    className="hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-muted shrink-0" />
              <input
                type="text"
                placeholder="e.g. React, Node.js (Enter to add)"
                value={techInput}
                onChange={(e) => setTechInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTech();
                  }
                }}
                className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
              />
              <button
                onClick={addTech}
                className="p-2 rounded text-primary hover:bg-surface-hover"
                title="Add tag"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Resources: links, credentials, images, notes */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted">
                Resources — just add and type; you can pick the kind (or
                change it) any time.
              </label>
            </div>

            {form.resources.map((resource, index) => {
              const Icon = RESOURCE_ICON[resource.type];
              const style = RESOURCE_STYLE[resource.type];
              return (
                <div
                  key={resource.id}
                  className="bg-background border border-border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className={`p-1.5 rounded shrink-0 ${style.bg}`}>
                      <Icon className={`w-4 h-4 ${style.color}`} />
                    </span>
                    <input
                      type="text"
                      placeholder="Label (optional)"
                      value={resource.label}
                      onChange={(e) =>
                        setResource(index, { label: e.target.value })
                      }
                      className="flex-1 bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                    />
                    <select
                      value={resource.type}
                      onChange={(e) =>
                        setResource(index, {
                          type: e.target.value as ResourceType,
                        })
                      }
                      className="bg-surface border border-border rounded px-2 py-2 text-xs focus:border-primary outline-none shrink-0"
                    >
                      {RESOURCE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeResource(index)}
                      className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {resource.type === "link" && (
                    <input
                      type="url"
                      placeholder="https://..."
                      value={resource.value}
                      onChange={(e) =>
                        setResource(index, { value: e.target.value })
                      }
                      className="w-full bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                    />
                  )}

                  {resource.type === "note" && (
                    <textarea
                      rows={3}
                      placeholder="Note content..."
                      value={resource.value}
                      onChange={(e) =>
                        setResource(index, { value: e.target.value })
                      }
                      className="w-full bg-surface border border-border rounded px-3 py-2 text-sm font-mono focus:border-primary outline-none resize-none"
                    />
                  )}

                  {resource.type === "credential" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Username / email"
                        value={resource.username}
                        onChange={(e) =>
                          setResource(index, { username: e.target.value })
                        }
                        className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type={visiblePasswords.has(index) ? "text" : "password"}
                          placeholder="Password"
                          value={resource.password}
                          onChange={(e) =>
                            setResource(index, { password: e.target.value })
                          }
                          className="flex-1 bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                        />
                        <button
                          onClick={() => togglePasswordVisible(index)}
                          className="p-1.5 rounded text-muted hover:bg-surface-hover shrink-0"
                          title={visiblePasswords.has(index) ? "Hide" : "Show"}
                        >
                          {visiblePasswords.has(index) ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {resource.type === "image" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => triggerImageUpload(index)}
                        disabled={uploadingIndex === index}
                        className="flex items-center gap-2 px-3 py-2 rounded bg-surface-hover hover:bg-border text-sm text-foreground transition-colors disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingIndex === index
                          ? "Uploading..."
                          : resource.file_path
                          ? "Replace image"
                          : "Upload image"}
                      </button>
                      {resource.file_path && (
                        <button
                          onClick={() => viewImage(resource.file_path)}
                          className="p-1.5 rounded text-primary hover:bg-surface-hover"
                          title="View image"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              onClick={addResource}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline w-fit pt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add item
            </button>
          </div>

          {/* Milestones */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted">Milestones</label>
            {form.milestones.map((m, index) => (
              <div key={m.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={m.done}
                  onChange={(e) =>
                    setMilestone(index, { done: e.target.checked })
                  }
                  className="accent-primary shrink-0"
                />
                <input
                  type="text"
                  placeholder="Milestone"
                  value={m.title}
                  onChange={(e) =>
                    setMilestone(index, { title: e.target.value })
                  }
                  className={`flex-1 bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none ${
                    m.done ? "line-through text-muted" : ""
                  }`}
                />
                <button
                  onClick={() => removeMilestone(index)}
                  className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={addMilestone}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline w-fit"
            >
              <Plus className="w-3.5 h-3.5" />
              Add milestone
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-5">
          {project ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-2 px-4 py-2 rounded text-red-400 hover:bg-surface-hover text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded bg-surface-hover hover:bg-border text-foreground text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : project ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete project?"
          message={`"${project?.name}" will be permanently deleted.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
