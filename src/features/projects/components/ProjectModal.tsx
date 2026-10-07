import { useState } from "react";
import {
  X,
  Save,
  Trash2,
  Plus,
  Tag,
} from "lucide-react";
import {
  saveProject,
  deleteProject,
} from "../api";
import type {
  ProjectMilestone,
  ProjectResource,
  ProjectRow,
  PaymentStatus,
} from "../types";
import {
  PAYMENT_STATUSES,
} from "../types";
import ConfirmDialog from "../../../components/ConfirmDialog";

interface ProjectForm {
  name: string;
  client: string;
  description: string;
  budget: string;
  payment_status: PaymentStatus;
  tech_stack: string[];
  resources: ProjectResource[];
  milestones: ProjectMilestone[];
}


const emptyForm: ProjectForm = {
  name: "",
  client: "",
  description: "",
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
    budget: project.budget === null ? "" : String(project.budget),
    payment_status: project.payment_status,
    tech_stack: [...project.tech_stack],
    resources: project.resources.map((r) => ({ ...r })),
    milestones: project.milestones.map((m) => ({ ...m })),
  };
}


interface ProjectModalProps {
  project: ProjectRow | null; // null = adding a new project
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (project: ProjectRow) => void;
  onDeleted: (id: string) => void;
}

export default function ProjectModal({
  project,
  nextSortOrder,
  onClose,
  onSaved,
  onDeleted,
}: ProjectModalProps) {
  const [form, setForm] = useState<ProjectForm>(
    project ? toForm(project) : emptyForm
  );
  const [techInput, setTechInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);


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
          budget: form.budget.trim() === "" ? null : Number(form.budget),
          payment_status: form.payment_status,
          tech_stack: form.tech_stack,
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {/* Resources (links, credentials, images, notes) are edited one by
              one in their own tabs, so this modal only owns the project's
              own fields. */}
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
