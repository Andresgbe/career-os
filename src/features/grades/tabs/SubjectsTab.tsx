import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Check, X } from "lucide-react";
import type { SubjectRow, EvaluationRow } from "../types";
import { addSubject, updateSubject, deleteSubject } from "../api";
import EvaluationTable from "../components/EvaluationTable";

const DEFAULT_COLORS = [
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#ef4444", // red
  "#10b981", // emerald
  "#ec4899", // pink
  "#3b82f6", // blue
  "#f97316", // orange
];

interface SubjectsTabProps {
  subjects: SubjectRow[];
  evaluations: EvaluationRow[];
  onSubjectsChange: (subjects: SubjectRow[]) => void;
  onEvaluationsChange: (evaluations: EvaluationRow[]) => void;
}

export default function SubjectsTab({
  subjects,
  evaluations,
  onSubjectsChange,
  onEvaluationsChange,
}: SubjectsTabProps) {
  const [error, setError] = useState("");
  
  // New subject
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]);
  const [adding, setAdding] = useState(false);

  // Edit subject
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  // Expand state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleAdd = async () => {
    if (!newName.trim()) {
      setError("Enter a subject name.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const row = await addSubject(newName.trim(), newColor);
      onSubjectsChange([...subjects, row]);
      setNewName("");
      const idx = DEFAULT_COLORS.indexOf(newColor);
      setNewColor(DEFAULT_COLORS[(idx + 1) % DEFAULT_COLORS.length]);
      // Auto expand new subject
      toggleExpand(row.id, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error adding subject");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (sub: SubjectRow) => {
    setEditId(sub.id);
    setEditName(sub.name);
    setEditColor(sub.color);
  };

  const saveEdit = async () => {
    if (!editId || !editName.trim()) return;
    setError("");
    try {
      const updated = await updateSubject(editId, {
        name: editName.trim(),
        color: editColor,
      });
      onSubjectsChange(subjects.map((s) => (s.id === editId ? updated : s)));
      setEditId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating subject");
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    try {
      await deleteSubject(id);
      onSubjectsChange(subjects.filter((s) => s.id !== id));
      // Removing its evaluations locally
      onEvaluationsChange(evaluations.filter((ev) => ev.subject_id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting subject");
    }
  };

  const toggleExpand = (id: string, force?: boolean) => {
    const next = new Set(expandedIds);
    if (force === true) {
      next.add(id);
    } else if (force === false) {
      next.delete(id);
    } else {
      if (next.has(id)) next.delete(id);
      else next.add(id);
    }
    setExpandedIds(next);
  };

  return (
    <div className="space-y-6">
      {/* Add new subject */}
      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-4">New Subject</h2>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder="Subject name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none flex-1"
          />

          {/* Color picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Color:</span>
            <div className="flex gap-1.5">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full transition-all ${
                    newColor === c
                      ? "ring-2 ring-offset-2 ring-offset-background scale-110"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleAdd}
          disabled={adding}
          className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {adding ? "Adding..." : "Add subject"}
        </button>
      </section>

      {/* Subjects List */}
      <section className="space-y-4">
        {subjects.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
            No subjects yet. Create one above.
          </div>
        ) : (
          subjects.map((sub) => {
            const isExpanded = expandedIds.has(sub.id);
            const isEditing = editId === sub.id;
            const subjectEvals = evaluations.filter((ev) => ev.subject_id === sub.id);

            return (
              <div
                key={sub.id}
                className="bg-surface border border-border rounded-xl overflow-hidden transition-all"
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-hover/50"
                  onClick={() => !isEditing && toggleExpand(sub.id)}
                >
                  <div className="flex items-center gap-3">
                    <button className="text-muted hover:text-foreground transition-colors p-1 rounded-full hover:bg-surface-hover">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>

                    {isEditing ? (
                      <div
                        className="flex items-center gap-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                          className="bg-background border border-border rounded px-3 py-1 text-sm focus:border-primary outline-none"
                        />
                        <div className="flex gap-1.5">
                          {DEFAULT_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => setEditColor(c)}
                              className={`w-5 h-5 rounded-full transition-all ${
                                editColor === c
                                  ? "ring-2 ring-offset-1 ring-offset-background scale-110"
                                  : "hover:scale-110"
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: sub.color }}
                        />
                        <h3 className="font-semibold text-lg">{sub.name}</h3>
                      </div>
                    )}
                  </div>

                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isEditing ? (
                      <>
                        <button
                          onClick={saveEdit}
                          className="p-2 rounded text-emerald-400 hover:bg-surface-hover transition-colors"
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="p-2 rounded text-muted hover:bg-surface-hover transition-colors"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(sub)}
                          className="p-2 rounded text-muted hover:text-primary hover:bg-surface-hover transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(sub.id)}
                          className="p-2 rounded text-muted hover:text-red-400 hover:bg-surface-hover transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="p-4 border-t border-border bg-background">
                    <EvaluationTable
                      subjectId={sub.id}
                      evaluations={subjectEvals}
                      onEvaluationsChange={(newEvalsForSubject) => {
                        const otherEvals = evaluations.filter(
                          (ev) => ev.subject_id !== sub.id
                        );
                        onEvaluationsChange([...otherEvals, ...newEvalsForSubject]);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
