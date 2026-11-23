import { useMemo, useState } from "react";
import { Copy, Save } from "lucide-react";
import { errorMessage } from "../../../lib/errors";
import { saveMonthPlan } from "../api";
import {
  COST_TYPE_LABELS,
  effectivePlannedExpense,
  formatUsd,
  monthLabel,
  shiftMonth,
  summarizeMonth,
  type AgencyCategoryRow,
  type AgencyMonthPlanRow,
  type AgencyTransactionRow,
} from "../types";

interface BudgetTabProps {
  month: string;
  transactions: AgencyTransactionRow[];
  categories: AgencyCategoryRow[];
  monthPlan: AgencyMonthPlanRow | null;
  prevMonthPlan: AgencyMonthPlanRow | null;
  canEdit: boolean;
  onPlanSaved: (plan: AgencyMonthPlanRow) => void;
}

export default function BudgetTab({
  month,
  transactions,
  categories,
  monthPlan,
  prevMonthPlan,
  canEdit,
  onPlanSaved,
}: BudgetTabProps) {
  const [plannedIncome, setPlannedIncome] = useState(
    monthPlan && monthPlan.planned_income > 0 ? String(monthPlan.planned_income) : ""
  );
  const [plannedExpense, setPlannedExpense] = useState(
    monthPlan && monthPlan.planned_expense > 0 ? String(monthPlan.planned_expense) : ""
  );
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (monthPlan) {
      for (const [id, val] of Object.entries(monthPlan.category_budgets)) {
        if (val > 0) out[id] = String(val);
      }
    }
    return out;
  });
  const [notes, setNotes] = useState(monthPlan?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState("");
  const [error, setError] = useState("");

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.kind === "expense" || c.kind === "both"),
    [categories]
  );

  const actualByCategory = useMemo(() => {
    const map = new Map<string, number>();
    let uncategorized = 0;
    for (const t of transactions) {
      if (t.kind !== "expense") continue;
      if (t.category_id) {
        map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.amount_usd);
      } else {
        uncategorized += t.amount_usd;
      }
    }
    return { map, uncategorized };
  }, [transactions]);

  const summary = useMemo(() => summarizeMonth(transactions), [transactions]);

  const parsedCategoryBudgets = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [id, raw] of Object.entries(categoryBudgets)) {
      const n = Number(raw.replace(",", "."));
      if (Number.isFinite(n) && n > 0) out[id] = n;
    }
    return out;
  }, [categoryBudgets]);

  const allocatedTotal = useMemo(
    () => Object.values(parsedCategoryBudgets).reduce((sum, v) => sum + v, 0),
    [parsedCategoryBudgets]
  );

  const parsedIncome = Number(plannedIncome.replace(",", ".")) || 0;
  const parsedExpenseCap = Number(plannedExpense.replace(",", ".")) || 0;
  const draftPlan: AgencyMonthPlanRow = {
    id: monthPlan?.id ?? "",
    user_id: monthPlan?.user_id ?? "",
    month,
    planned_income: parsedIncome > 0 ? parsedIncome : 0,
    planned_expense: parsedExpenseCap > 0 ? parsedExpenseCap : 0,
    category_budgets: parsedCategoryBudgets,
    notes,
    updated_at: monthPlan?.updated_at ?? "",
  };
  const effectiveCap = effectivePlannedExpense(draftPlan);
  const remaining = effectiveCap - summary.expense;

  async function persist(nextFields?: {
    planned_income: number;
    planned_expense: number;
    category_budgets: Record<string, number>;
    notes: string;
  }) {
    setError("");
    setSavedNotice("");

    const incomeVal = nextFields ? nextFields.planned_income : parsedIncome;
    const expenseVal = nextFields ? nextFields.planned_expense : parsedExpenseCap;
    if (incomeVal < 0 || expenseVal < 0) {
      setError("Budget amounts cannot be negative.");
      return;
    }

    setSaving(true);
    try {
      const saved = await saveMonthPlan(
        month,
        nextFields ?? {
          planned_income: incomeVal,
          planned_expense: expenseVal,
          category_budgets: parsedCategoryBudgets,
          notes: notes.trim(),
        }
      );
      onPlanSaved(saved);
      setSavedNotice("Monthly plan saved.");
    } catch (err) {
      setError(errorMessage(err, "Error saving monthly budget"));
    } finally {
      setSaving(false);
    }
  }

  async function copyFromPrevious() {
    if (!prevMonthPlan) return;
    setPlannedIncome(
      prevMonthPlan.planned_income > 0 ? String(prevMonthPlan.planned_income) : ""
    );
    setPlannedExpense(
      prevMonthPlan.planned_expense > 0 ? String(prevMonthPlan.planned_expense) : ""
    );
    const nextCatStrings: Record<string, string> = {};
    for (const [id, val] of Object.entries(prevMonthPlan.category_budgets)) {
      if (val > 0) nextCatStrings[id] = String(val);
    }
    setCategoryBudgets(nextCatStrings);
    setNotes(prevMonthPlan.notes);

    await persist({
      planned_income: prevMonthPlan.planned_income,
      planned_expense: prevMonthPlan.planned_expense,
      category_budgets: prevMonthPlan.category_budgets,
      notes: prevMonthPlan.notes,
    });
  }

  const inputClass =
    "bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary w-full";
  const prevLabel = monthLabel(shiftMonth(month, -1));

  return (
    <div className="space-y-5">
      {/* Top monthly plan targets */}
      <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold">
              Monthly Plan — {monthLabel(month)}
            </h3>
            <p className="text-xs text-muted mt-0.5">
              All budget targets are tracked in USD BCV. Leave Expense Cap blank to
              auto-sum your category allocations.
            </p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              {prevMonthPlan && (
                <button
                  onClick={copyFromPrevious}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-border text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy from {prevLabel}
                </button>
              )}
              <button
                onClick={() => persist()}
                disabled={saving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Saving..." : "Save plan"}
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {savedNotice && <p className="text-xs text-emerald-400">{savedNotice}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Planned Income Target (USD)</span>
            <input
              disabled={!canEdit}
              inputMode="decimal"
              value={plannedIncome}
              onChange={(e) => setPlannedIncome(e.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">
              Overall Monthly Expense Cap (USD)
            </span>
            <input
              disabled={!canEdit}
              inputMode="decimal"
              value={plannedExpense}
              onChange={(e) => setPlannedExpense(e.target.value)}
              placeholder={
                allocatedTotal > 0
                  ? `${allocatedTotal.toFixed(2)} (sum of categories)`
                  : "0.00"
              }
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Planning Notes</span>
            <input
              disabled={!canEdit}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Hiring plans, ad push, reserve..."
              className={inputClass}
            />
          </label>
        </div>

        {/* Comparison strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border">
          <div className="bg-background border border-border rounded-lg px-3.5 py-2.5">
            <p className="text-xs text-muted">Effective Expense Budget</p>
            <p className="text-base font-semibold mt-0.5">{formatUsd(effectiveCap)}</p>
          </div>
          <div className="bg-background border border-border rounded-lg px-3.5 py-2.5">
            <p className="text-xs text-muted">Actual Expenses</p>
            <p className="text-base font-semibold text-red-400 mt-0.5">
              {formatUsd(summary.expense)}
            </p>
          </div>
          <div className="bg-background border border-border rounded-lg px-3.5 py-2.5">
            <p className="text-xs text-muted">
              {remaining >= 0 ? "Remaining Budget" : "Over Budget"}
            </p>
            <p
              className={`text-base font-semibold mt-0.5 ${
                effectiveCap === 0
                  ? "text-muted"
                  : remaining >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
              }`}
            >
              {effectiveCap === 0 ? "—" : formatUsd(Math.abs(remaining))}
            </p>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold">Planned vs Actual by Category</h3>
          <span className="text-xs text-muted">
            Allocated: <strong className="text-foreground">{formatUsd(allocatedTotal)}</strong>
          </span>
        </div>

        {expenseCategories.length === 0 ? (
          <p className="text-sm text-muted py-4">
            No expense categories yet. Add categories under Customize to allocate
            category budgets.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {expenseCategories.map((cat) => {
              const plannedVal = parsedCategoryBudgets[cat.id] ?? 0;
              const actualVal = actualByCategory.map.get(cat.id) ?? 0;
              const diff = plannedVal - actualVal;
              const pct = plannedVal > 0 ? (actualVal / plannedVal) * 100 : 0;
              const barColor =
                pct > 100
                  ? "bg-red-400"
                  : pct >= 85
                    ? "bg-amber-400"
                    : "bg-emerald-400";

              return (
                <li key={cat.id} className="py-3 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="flex-1 min-w-[160px] flex items-center gap-2">
                      <span className="text-sm font-medium">{cat.name}</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-background border border-border text-muted">
                        {COST_TYPE_LABELS[cat.default_cost_type]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">Planned $</span>
                      <input
                        disabled={!canEdit}
                        inputMode="decimal"
                        value={categoryBudgets[cat.id] ?? ""}
                        onChange={(e) =>
                          setCategoryBudgets((prev) => ({
                            ...prev,
                            [cat.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && canEdit) persist();
                        }}
                        placeholder="0.00"
                        className="w-28 bg-background border border-border rounded-lg px-2.5 py-1 text-sm text-right outline-none focus:border-primary"
                      />
                    </div>

                    <div className="w-28 text-right shrink-0">
                      <p className="text-sm font-semibold">{formatUsd(actualVal)}</p>
                      <p className="text-[11px] text-muted">Actual</p>
                    </div>

                    <div className="w-28 text-right shrink-0">
                      {plannedVal > 0 ? (
                        <p
                          className={`text-xs font-medium ${
                            diff >= 0 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {diff >= 0
                            ? `${formatUsd(diff)} left`
                            : `${formatUsd(Math.abs(diff))} over`}
                        </p>
                      ) : (
                        <p className="text-xs text-muted">—</p>
                      )}
                    </div>
                  </div>

                  {plannedVal > 0 && (
                    <div className="h-1.5 w-full rounded-full bg-background overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  )}
                </li>
              );
            })}

            {actualByCategory.uncategorized > 0 && (
              <li className="py-3 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted">
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
                  Uncategorized expenses
                </span>
                <span className="font-semibold text-red-400">
                  {formatUsd(actualByCategory.uncategorized)}
                </span>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
