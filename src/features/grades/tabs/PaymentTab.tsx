import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Tag,
  X,
} from "lucide-react";
import {
  getPaymentPlans,
  addPaymentPlan,
  updatePaymentPlan,
  deletePaymentPlan,
} from "../api";
import {
  PAYMENT_FIELDS,
  getPaymentPlanTotal,
  type PaymentPlanRow,
} from "../types";
import ConfirmDialog from "../../../components/ConfirmDialog";

export default function PaymentTab() {
  const [plans, setPlans] = useState<PaymentPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showNewPlanForm, setShowNewPlanForm] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [adding, setAdding] = useState(false);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [subjectInputs, setSubjectInputs] = useState<Record<string, string>>(
    {}
  );
  const [toDelete, setToDelete] = useState<PaymentPlanRow | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    getPaymentPlans()
      .then(setPlans)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const persist = async (id: string, fields: Partial<PaymentPlanRow>) => {
    try {
      const updated = await updatePaymentPlan(id, fields);
      setPlans((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving plan");
    }
  };

  const updateLocal = (id: string, fields: Partial<PaymentPlanRow>) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...fields } : p))
    );
  };

  // Plan name is edited via its own isolated draft state (like newPlanName)
  // rather than being bound straight to the plans array, so each keystroke
  // doesn't have to replay through a full-array re-render.
  const getNameDraft = (plan: PaymentPlanRow) =>
    nameDrafts[plan.id] ?? plan.name;

  const handleNameChange = (planId: string, value: string) => {
    setNameDrafts((prev) => ({ ...prev, [planId]: value }));
  };

  const handleNameBlur = (plan: PaymentPlanRow) => {
    const draft = nameDrafts[plan.id];
    setNameDrafts((prev) => {
      const next = { ...prev };
      delete next[plan.id];
      return next;
    });
    if (draft === undefined) return;
    const trimmed = draft.trim();
    if (trimmed === plan.name) return;
    updateLocal(plan.id, { name: trimmed });
    persist(plan.id, { name: trimmed });
  };

  const handleAddPlan = async () => {
    setAdding(true);
    setError("");
    try {
      const row = await addPaymentPlan(
        newPlanName.trim() || `Plan ${plans.length + 1}`
      );
      setPlans((prev) => [...prev, row]);
      setExpandedIds((prev) => new Set(prev).add(row.id));
      setNewPlanName("");
      setShowNewPlanForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating plan");
    } finally {
      setAdding(false);
    }
  };

  const confirmDeletePlan = async () => {
    if (!toDelete) return;
    try {
      await deletePaymentPlan(toDelete.id);
      setPlans((prev) => prev.filter((p) => p.id !== toDelete.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting plan");
    } finally {
      setToDelete(null);
    }
  };

  const addSubjectTag = (plan: PaymentPlanRow) => {
    const value = (subjectInputs[plan.id] ?? "").trim();
    setSubjectInputs((prev) => ({ ...prev, [plan.id]: "" }));
    if (!value || plan.subjects.includes(value)) return;
    const subjects = [...plan.subjects, value];
    updateLocal(plan.id, { subjects });
    persist(plan.id, { subjects });
  };

  const removeSubjectTag = (plan: PaymentPlanRow, subject: string) => {
    const subjects = plan.subjects.filter((s) => s !== subject);
    updateLocal(plan.id, { subjects });
    persist(plan.id, { subjects });
  };

  if (loading) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* New plan */}
      <section className="bg-surface border border-border rounded-xl p-5">
        <button
          onClick={() => setShowNewPlanForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
        >
          {showNewPlanForm ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          New plan
        </button>

        {showNewPlanForm && (
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <input
              type="text"
              placeholder="e.g. Plan A - Morning schedule"
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddPlan()}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none flex-1"
            />
            <button
              onClick={handleAddPlan}
              disabled={adding}
              className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50 w-fit"
            >
              <Plus className="w-4 h-4" />
              {adding ? "Adding..." : "Add plan"}
            </button>
          </div>
        )}
      </section>

      {/* Plans list */}
      {plans.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
          No payment plans yet. Create one above.
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => {
            const isExpanded = expandedIds.has(plan.id);
            const total = getPaymentPlanTotal(plan);
            return (
              <div
                key={plan.id}
                className="bg-surface border border-border rounded-xl overflow-hidden"
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between gap-3 p-4 cursor-pointer hover:bg-surface-hover/50"
                  onClick={() => toggleExpand(plan.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button className="text-muted hover:text-foreground transition-colors p-1 rounded-full hover:bg-surface-hover shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>
                    <h3 className="font-semibold text-lg truncate">
                      {plan.name || "Untitled plan"}
                    </h3>
                  </div>
                  <div
                    className="flex items-center gap-3 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-sm font-semibold bg-primary/15 text-primary px-3 py-1 rounded-full">
                      {total.toFixed(2)}
                    </span>
                    <button
                      onClick={() => setToDelete(plan)}
                      className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-surface-hover transition-colors"
                      title="Delete plan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="p-4 border-t border-border bg-background space-y-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted">Plan name</label>
                      <input
                        type="text"
                        value={getNameDraft(plan)}
                        onChange={(e) =>
                          handleNameChange(plan.id, e.target.value)
                        }
                        onBlur={() => handleNameBlur(plan)}
                        className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {PAYMENT_FIELDS.map(({ key, label }) => (
                        <div key={key} className="flex flex-col gap-1">
                          <label className="text-xs text-muted uppercase tracking-wide">
                            {label}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            placeholder="0.00"
                            value={plan[key] || ""}
                            onChange={(e) =>
                              updateLocal(plan.id, {
                                [key]:
                                  e.target.value === ""
                                    ? 0
                                    : parseFloat(e.target.value),
                              })
                            }
                            onBlur={(e) =>
                              persist(plan.id, {
                                [key]:
                                  e.target.value === ""
                                    ? 0
                                    : parseFloat(e.target.value),
                              })
                            }
                            className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <span className="text-sm">
                        <span className="text-muted">Total: </span>
                        <span className="font-semibold text-lg">
                          {total.toFixed(2)}
                        </span>
                      </span>
                    </div>

                    {/* Subjects */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-border">
                      <label className="text-xs text-muted">
                        Subjects in this plan
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {plan.subjects.map((subject) => (
                          <span
                            key={subject}
                            className="flex items-center gap-1 text-xs px-2 py-1 bg-surface-hover rounded-full text-muted"
                          >
                            {subject}
                            <button
                              onClick={() => removeSubjectTag(plan, subject)}
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
                          placeholder="Add a subject and press Enter"
                          value={subjectInputs[plan.id] ?? ""}
                          onChange={(e) =>
                            setSubjectInputs((prev) => ({
                              ...prev,
                              [plan.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) =>
                            e.key === "Enter" && addSubjectTag(plan)
                          }
                          className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none flex-1"
                        />
                        <button
                          onClick={() => addSubjectTag(plan)}
                          className="px-3 py-2 rounded bg-surface-hover hover:bg-border text-foreground text-sm font-medium transition-colors shrink-0"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete plan?"
          message={`"${toDelete.name || "Untitled plan"}" will be permanently deleted.`}
          onConfirm={confirmDeletePlan}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
