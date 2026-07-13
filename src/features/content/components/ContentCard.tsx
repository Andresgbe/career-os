import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Check,
  X as XIcon,
  Save,
  Maximize2,
} from "lucide-react";
import type { ContentIdeaRow, CategoryRow, Platform } from "../types";
import { PLATFORMS, STATUS_STEPS } from "../types";

interface ContentCardProps {
  idea: ContentIdeaRow;
  categories: CategoryRow[];
  onToggleStatus: (
    id: string,
    field: "script_done" | "recorded" | "edited",
    value: boolean
  ) => void;
  onUpdate: (
    id: string,
    fields: {
      title: string;
      description: string;
      script: string;
      platforms: Platform[];
      category_ids: string[];
    }
  ) => void;
  onDelete: (id: string) => void;
}

function getPlatformDef(value: Platform) {
  return PLATFORMS.find((p) => p.value === value);
}

export default function ContentCard({
  idea,
  categories,
  onToggleStatus,
  onUpdate,
  onDelete,
}: ContentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [scriptModal, setScriptModal] = useState(false);
  const [editForm, setEditForm] = useState({
    title: idea.title,
    description: idea.description,
    script: idea.script,
    platforms: [...idea.platforms],
    category_ids: [...idea.category_ids],
  });

  const ideaCategories = categories.filter((c) =>
    idea.category_ids.includes(c.id)
  );

  const completedSteps = STATUS_STEPS.filter(
    (s) => idea[s.key]
  ).length;
  const totalSteps = STATUS_STEPS.length;

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    setEditForm({
      title: idea.title,
      description: idea.description,
      script: idea.script,
      platforms: [...idea.platforms],
      category_ids: [...idea.category_ids],
    });
    if (!expanded) setExpanded(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const saveEdit = () => {
    if (!editForm.title.trim()) return;
    onUpdate(idea.id, {
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      script: editForm.script,
      platforms: editForm.platforms,
      category_ids: editForm.category_ids,
    });
    setEditing(false);
  };

  const toggleEditPlatform = (platform: Platform) => {
    setEditForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }));
  };

  const toggleEditCategory = (catId: string) => {
    setEditForm((prev) => ({
      ...prev,
      category_ids: prev.category_ids.includes(catId)
        ? prev.category_ids.filter((c) => c !== catId)
        : [...prev.category_ids, catId],
    }));
  };

  return (
    <div className="bg-background border border-border rounded-lg overflow-hidden transition-all duration-200 hover:border-primary/40">
      {/* Header — always visible */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => !editing && setExpanded(!expanded)}
      >
        {/* Expand icon */}
        <div className="shrink-0 text-muted">
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>

        {/* Title + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{idea.title}</span>

            {/* Category tags */}
            {ideaCategories.map((cat) => (
              <span
                key={cat.id}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                style={{
                  backgroundColor: cat.color + "25",
                  color: cat.color,
                }}
              >
                {cat.name}
              </span>
            ))}
          </div>

          {/* Platform badges */}
          {idea.platforms.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {idea.platforms.map((p) => {
                const def = getPlatformDef(p);
                if (!def) return null;
                return (
                  <span
                    key={p}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded shrink-0"
                    style={{
                      backgroundColor: def.color,
                      color: def.textColor,
                    }}
                  >
                    {def.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Status checklist (compact) */}
        <div className="flex items-center gap-2 shrink-0">
          {STATUS_STEPS.map((step) => {
            const done = idea[step.key];
            return (
              <button
                key={step.key}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStatus(idea.id, step.key, !done);
                }}
                className="flex items-center gap-1 group/status"
                title={`${step.label}: ${done ? "Done" : "Pending"}`}
              >
                <span
                  className={`w-5 h-5 rounded flex items-center justify-center text-xs transition-colors ${
                    done
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-surface-hover text-muted group-hover/status:text-foreground"
                  }`}
                >
                  {done ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <XIcon className="w-3 h-3" />
                  )}
                </span>
                <span className="text-[10px] text-muted hidden sm:inline">
                  {step.label}
                </span>
              </button>
            );
          })}
          <span className="text-[10px] text-muted ml-1 hidden sm:inline">
            {completedSteps}/{totalSteps}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={startEdit}
            className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(idea.id);
            }}
            className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-4 animate-in">
          {editing ? (
            /* ========== EDIT MODE ========== */
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm({ ...editForm, title: e.target.value })
                  }
                  className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Description</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none resize-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Guion (Script)</label>
                <textarea
                  rows={8}
                  value={editForm.script}
                  onChange={(e) =>
                    setEditForm({ ...editForm, script: e.target.value })
                  }
                  className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none resize-y font-mono"
                />
              </div>

              {/* Platform toggles */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => {
                    const selected = editForm.platforms.includes(p.value);
                    return (
                      <button
                        key={p.value}
                        onClick={() => toggleEditPlatform(p.value)}
                        className={`text-xs font-medium px-3 py-1.5 rounded transition-all ${
                          selected
                            ? "ring-2 ring-offset-1 ring-offset-background"
                            : "opacity-40 hover:opacity-70"
                        }`}
                        style={{
                          backgroundColor: p.color,
                          color: p.textColor,
                          ...(selected ? { ringColor: p.color } : {}),
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category toggles */}
              {categories.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted">Categories</label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => {
                      const selected = editForm.category_ids.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          onClick={() => toggleEditCategory(cat.id)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                            selected
                              ? "ring-2 ring-offset-1 ring-offset-background"
                              : "opacity-40 hover:opacity-70"
                          }`}
                          style={{
                            backgroundColor: cat.color + "30",
                            color: cat.color,
                          }}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 rounded bg-surface-hover hover:bg-border text-foreground text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
          ) : (
            /* ========== VIEW MODE ========== */
            <>
              {idea.description && (
                <div>
                  <h4 className="text-xs text-muted mb-1">Description</h4>
                  <p className="text-sm whitespace-pre-wrap">
                    {idea.description}
                  </p>
                </div>
              )}

              {idea.script && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs text-muted">Guion (Script)</h4>
                    <button
                      onClick={() => setScriptModal(true)}
                      className="flex items-center gap-1 text-[10px] text-primary hover:text-primary-hover transition-colors"
                      title="Open script in full view"
                    >
                      <Maximize2 className="w-3 h-3" />
                      Full view
                    </button>
                  </div>
                  <div
                    onClick={() => setScriptModal(true)}
                    className="bg-surface border border-border rounded-lg p-3 text-sm whitespace-pre-wrap font-mono max-h-64 overflow-y-auto cursor-pointer hover:border-primary/40 transition-colors"
                  >
                    {idea.script}
                  </div>
                </div>
              )}

              {!idea.description && !idea.script && (
                <p className="text-sm text-muted italic">
                  No description or script yet. Click the edit button to add
                  details.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Script reader modal */}
      {scriptModal && idea.script && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          onClick={() => setScriptModal(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {idea.title}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Guion / Script</p>
              </div>
              <button
                onClick={() => setScriptModal(false)}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                title="Close"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Script content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <p className="text-base leading-8 text-gray-800 whitespace-pre-wrap">
                {idea.script}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
