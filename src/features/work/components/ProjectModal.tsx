import { useState } from "react";
import { X, Save, Trash2, Plus, Link2 } from "lucide-react";
import { saveWorkProject, deleteWorkProject } from "../api";
import type { ProjectResource, WorkProjectRow } from "../types";
import ConfirmDialog from "./ConfirmDialog";

interface ProjectForm {
  name: string;
  description: string;
  notes: string;
  resources: ProjectResource[];
}

const emptyResource: ProjectResource = { label: "", url: "" };

const emptyForm: ProjectForm = {
  name: "",
  description: "",
  notes: "",
  resources: [],
};

function toForm(project: WorkProjectRow): ProjectForm {
  return {
    name: project.name,
    description: project.description,
    notes: project.notes,
    resources: project.resources.map((r) => ({ ...r })),
  };
}

interface ProjectModalProps {
  project: WorkProjectRow | null; // null = adding a new project
  onClose: () => void;
  onSaved: (project: WorkProjectRow) => void;
  onDeleted: (id: string) => void;
}

export default function ProjectModal({
  project,
  onClose,
  onSaved,
  onDeleted,
}: ProjectModalProps) {
  const [form, setForm] = useState<ProjectForm>(
    project ? toForm(project) : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const setResource = (index: number, fields: Partial<ProjectResource>) => {
    const resources = [...form.resources];
    resources[index] = { ...resources[index], ...fields };
    setForm({ ...form, resources });
  };

  const addResource = () =>
    setForm({ ...form, resources: [...form.resources, { ...emptyResource }] });

  const removeResource = (index: number) =>
    setForm({
      ...form,
      resources: form.resources.filter((_, i) => i !== index),
    });

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Project name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await saveWorkProject(
        {
          name: form.name.trim(),
          description: form.description.trim(),
          notes: form.notes.trim(),
          resources: form.resources
            .map((r) => ({ label: r.label.trim(), url: r.url.trim() }))
            .filter((r) => r.label || r.url),
        },
        project?.id ?? null
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
      await deleteWorkProject(project.id);
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
        className="bg-surface border border-border rounded-xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto"
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
            <label className="text-xs text-muted">Description</label>
            <textarea
              rows={2}
              placeholder="Short summary of the project"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none resize-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted">
              Resources (optional)
            </label>
            {form.resources.map((resource, index) => (
              <div key={index} className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-muted shrink-0" />
                <input
                  type="text"
                  placeholder="Label (e.g. Repo, Docs, Board)"
                  value={resource.label}
                  onChange={(e) =>
                    setResource(index, { label: e.target.value })
                  }
                  className="w-36 bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none shrink-0"
                />
                <input
                  type="url"
                  placeholder="https://..."
                  value={resource.url}
                  onChange={(e) =>
                    setResource(index, { url: e.target.value })
                  }
                  className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                />
                <button
                  onClick={() => removeResource(index)}
                  className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400 shrink-0"
                  title="Remove resource"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={addResource}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline w-fit"
            >
              <Plus className="w-3.5 h-3.5" />
              Add resource
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Notes</label>
            <textarea
              rows={6}
              placeholder="Anything worth remembering about this project..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none resize-none"
            />
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
