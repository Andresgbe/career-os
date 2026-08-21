import { useState } from "react";
import { Check, X as XIcon, Save, Trash2 } from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import type { CategoryRow, ContentIdeaRow } from "../types";
import { STATUS_STEPS } from "../types";

const UNASSIGNED = "unassigned";

interface IdeaModalProps {
  idea: ContentIdeaRow;
  categories: CategoryRow[];
  onClose: () => void;
  onSave: (
    id: string,
    fields: {
      title: string;
      description: string;
      script: string;
      category_id: string | null;
    }
  ) => void;
  onToggleStatus: (
    id: string,
    field: "script_done" | "recorded" | "edited",
    value: boolean
  ) => void;
  onDelete: (id: string) => void;
}

export default function IdeaModal({
  idea,
  categories,
  onClose,
  onSave,
  onToggleStatus,
  onDelete,
}: IdeaModalProps) {
  const [title, setTitle] = useState(idea.title);
  const [description, setDescription] = useState(idea.description);
  const [script, setScript] = useState(idea.script);
  const [categoryId, setCategoryId] = useState(idea.category_id ?? UNASSIGNED);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty =
    title !== idea.title ||
    description !== idea.description ||
    script !== idea.script ||
    categoryId !== (idea.category_id ?? UNASSIGNED);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(idea.id, {
      title: title.trim(),
      description: description.trim(),
      script,
      category_id: categoryId === UNASSIGNED ? null : categoryId,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className="relative bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Idea title"
            className="flex-1 min-w-0 bg-transparent text-lg font-semibold outline-none placeholder:text-muted"
          />
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted hover:bg-surface-hover hover:text-foreground transition-colors shrink-0"
            title="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Category */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
            >
              <option value={UNASSIGNED}>Sin categoría</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status checklist */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted">Status</label>
            <div className="flex items-center gap-2 flex-wrap">
              {STATUS_STEPS.map((step) => {
                const done = idea[step.key];
                return (
                  <button
                    key={step.key}
                    onClick={() => onToggleStatus(idea.id, step.key, !done)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      done
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-surface-hover text-muted hover:text-foreground"
                    }`}
                  >
                    {done ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <XIcon className="w-3.5 h-3.5" />
                    )}
                    {step.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Description</label>
            <textarea
              rows={3}
              placeholder="Brief idea description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none resize-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Guion / Script</label>
            <textarea
              rows={10}
              placeholder="Write the script for this content..."
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none resize-y font-mono"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0">
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 px-3 py-2 rounded text-red-400 hover:bg-red-500/10 text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || !title.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete idea"
          message={`Delete "${idea.title}"? This can't be undone.`}
          onConfirm={() => {
            onDelete(idea.id);
            setConfirmDelete(false);
            onClose();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
