import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import type { EvaluationRow } from "../types";
import { getMaxPoints, getEarnedPoints, MAX_GRADE } from "../types";
import { addEvaluation, updateEvaluation, deleteEvaluation } from "../api";

interface EvaluationTableProps {
  subjectId: string;
  evaluations: EvaluationRow[];
  onEvaluationsChange: (newEvals: EvaluationRow[]) => void;
}

export default function EvaluationTable({
  subjectId,
  evaluations,
  onEvaluationsChange,
}: EvaluationTableProps) {
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWeight, setNewWeight] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editGrade, setEditGrade] = useState("");
  const [editDate, setEditDate] = useState("");

  const totalWeight = evaluations.reduce((acc, ev) => acc + ev.weight, 0);
  const totalEarnedPoints = evaluations.reduce(
    (acc, ev) => acc + getEarnedPoints(ev.weight, ev.grade),
    0
  );

  const handleAdd = async () => {
    if (!newName.trim() || !newWeight) {
      setError("Enter name and weight.");
      return;
    }
    const weightNum = parseFloat(newWeight);
    if (isNaN(weightNum) || weightNum <= 0 || weightNum > 100) {
      setError("Weight must be between 1 and 100.");
      return;
    }
    if (totalWeight + weightNum > 100) {
      setError(`Cannot exceed 100%. Current total is ${totalWeight}%.`);
      return;
    }

    setAdding(true);
    setError("");
    try {
      const row = await addEvaluation(subjectId, newName.trim(), weightNum);
      onEvaluationsChange([...evaluations, row]);
      setNewName("");
      setNewWeight("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error adding evaluation");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (ev: EvaluationRow) => {
    setEditId(ev.id);
    setEditName(ev.name);
    setEditWeight(ev.weight.toString());
    setEditGrade(ev.grade !== null ? ev.grade.toString() : "");
    setEditDate(ev.eval_date || "");
    setError("");
  };

  const saveEdit = async () => {
    if (!editId || !editName.trim() || !editWeight) return;

    const weightNum = parseFloat(editWeight);
    if (isNaN(weightNum) || weightNum <= 0 || weightNum > 100) {
      setError("Weight must be between 1 and 100.");
      return;
    }

    const currentEv = evaluations.find((e) => e.id === editId);
    if (!currentEv) return;
    const weightDiff = weightNum - currentEv.weight;
    if (totalWeight + weightDiff > 100) {
      setError(`Cannot exceed 100%. Adjust weight to be smaller.`);
      return;
    }

    let gradeNum: number | null = null;
    if (editGrade.trim() !== "") {
      gradeNum = parseFloat(editGrade);
      if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > MAX_GRADE) {
        setError(`Grade must be between 0 and ${MAX_GRADE}.`);
        return;
      }
    }

    setError("");
    try {
      const updated = await updateEvaluation(editId, {
        name: editName.trim(),
        weight: weightNum,
        grade: gradeNum,
        eval_date: editDate || null,
      });
      onEvaluationsChange(
        evaluations.map((ev) => (ev.id === editId ? updated : ev))
      );
      setEditId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating evaluation");
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    try {
      await deleteEvaluation(id);
      onEvaluationsChange(evaluations.filter((ev) => ev.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting evaluation");
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Progress Bar for Total Weight */}
      <div className="space-y-1 mb-6">
        <div className="flex justify-between text-xs text-muted">
          <span>Evaluated: {totalWeight}%</span>
          <span>Max: 100%</span>
        </div>
        <div className="h-2 w-full bg-surface-hover rounded-full overflow-hidden">
          <div
            className={`h-full ${
              totalWeight === 100 ? "bg-emerald-500" : "bg-primary"
            } transition-all duration-300`}
            style={{ width: `${Math.min(totalWeight, 100)}%` }}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted uppercase bg-surface-hover">
            <tr>
              <th className="px-4 py-3 rounded-tl-lg">Component</th>
              <th className="px-4 py-3">Weight (%)</th>
              <th className="px-4 py-3">Max Pts</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Grade (/{MAX_GRADE})</th>
              <th className="px-4 py-3">Earned Pts</th>
              <th className="px-4 py-3 rounded-tr-lg text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {evaluations.map((ev) => {
              const isEditing = editId === ev.id;
              const maxPts = getMaxPoints(ev.weight);
              const earnedPts = getEarnedPoints(ev.weight, ev.grade);

              return (
                <tr key={ev.id} className="hover:bg-surface-hover/50">
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 w-full"
                        placeholder="Name"
                      />
                    ) : (
                      <span className="font-medium">{ev.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editWeight}
                        onChange={(e) => setEditWeight(e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 w-20"
                        min="1"
                        max="100"
                      />
                    ) : (
                      `${ev.weight}%`
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{maxPts.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 w-36"
                      />
                    ) : (
                      ev.eval_date || <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editGrade}
                        onChange={(e) => setEditGrade(e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 w-20"
                        min="0"
                        max={MAX_GRADE}
                        step="0.1"
                      />
                    ) : ev.grade !== null ? (
                      ev.grade
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-primary">
                    {ev.grade !== null ? earnedPts.toFixed(2) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={saveEdit}
                          className="p-1.5 rounded text-emerald-400 hover:bg-surface transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="p-1.5 rounded text-muted hover:bg-surface transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startEdit(ev)}
                          className="p-1.5 rounded text-muted hover:text-primary hover:bg-surface transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(ev.id)}
                          className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-surface transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* Add New Row */}
            <tr className="bg-surface-hover/30">
              <td className="px-4 py-2">
                <input
                  type="text"
                  placeholder="New component (e.g. Exam 1)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-background border border-border rounded px-2 py-1 w-full text-sm"
                />
              </td>
              <td className="px-4 py-2">
                <input
                  type="number"
                  placeholder="Weight %"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  className="bg-background border border-border rounded px-2 py-1 w-24 text-sm"
                  min="1"
                  max="100"
                />
              </td>
              <td className="px-4 py-2" colSpan={4}></td>
              <td className="px-4 py-2 text-right">
                <button
                  onClick={handleAdd}
                  disabled={adding}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </td>
            </tr>

            {/* Total Row */}
            <tr className="bg-surface font-semibold border-t-2 border-border">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-primary">{totalWeight}%</td>
              <td className="px-4 py-3">{(MAX_GRADE * (totalWeight / 100)).toFixed(2)}</td>
              <td className="px-4 py-3" colSpan={2}></td>
              <td className="px-4 py-3 text-emerald-400 text-lg">
                {totalEarnedPoints.toFixed(2)} / {MAX_GRADE}
              </td>
              <td className="px-4 py-3"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
