import { CheckCircle2, Clock, TrendingDown, TrendingUp, Wallet, Target } from "lucide-react";
import DailyCashFlowChart from "../components/DailyCashFlowChart";
import {
  COST_TYPE_LABELS,
  byCategory,
  byDay,
  dayLabel,
  effectivePlannedExpense,
  formatUsd,
  monthLabel,
  summarizeMonth,
  type AgencyCategoryRow,
  type AgencyMonthPlanRow,
  type AgencyTransactionRow,
  type CostType,
  type PaymentStatus,
} from "../types";

interface OverviewTabProps {
  month: string;
  transactions: AgencyTransactionRow[];
  categories: AgencyCategoryRow[];
  monthPlan: AgencyMonthPlanRow | null;
  canEdit: boolean;
  onToggleStatus: (tx: AgencyTransactionRow, next: PaymentStatus) => void;
  onGoToBudget: () => void;
}

const STRUCTURE_ROWS: Array<{ key: CostType; barClass: string }> = [
  { key: "fixed", barClass: "bg-blue-400" },
  { key: "variable", barClass: "bg-amber-400" },
  { key: "payroll", barClass: "bg-primary" },
  { key: "other", barClass: "bg-zinc-400" },
];

export default function OverviewTab({
  month,
  transactions,
  categories,
  monthPlan,
  canEdit,
  onToggleStatus,
  onGoToBudget,
}: OverviewTabProps) {
  const summary = summarizeMonth(transactions);
  const days = byDay(transactions, month);
  const expenseCategories = byCategory(transactions, categories, "expense");
  const plannedExpense = effectivePlannedExpense(monthPlan);
  const plannedIncome = monthPlan?.planned_income ?? 0;

  const budgetPct = plannedExpense > 0 ? (summary.expense / plannedExpense) * 100 : 0;
  const budgetBarColor =
    budgetPct > 100
      ? "bg-red-400"
      : budgetPct >= 85
        ? "bg-amber-400"
        : "bg-emerald-400";
  const budgetRemaining = plannedExpense - summary.expense;

  const pendingItems = transactions.filter((t) => t.status === "pending");

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* Income */}
        <div className="bg-surface border border-border rounded-xl p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Income</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            {formatUsd(summary.income)}
          </p>
          <div className="text-xs text-muted flex flex-wrap gap-x-2">
            <span>Collected: {formatUsd(summary.incomePaid)}</span>
            {summary.incomePending > 0 && (
              <span className="text-amber-400">
                Pending: {formatUsd(summary.incomePending)}
              </span>
            )}
          </div>
          {plannedIncome > 0 && (
            <p className="text-xs text-muted">
              Target: {formatUsd(plannedIncome)} (
              {Math.round((summary.income / plannedIncome) * 100)}%)
            </p>
          )}
        </div>

        {/* Expenses */}
        <div className="bg-surface border border-border rounded-xl p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Total Expenses</span>
            <TrendingDown className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-400">
            {formatUsd(summary.expense)}
          </p>
          <p className="text-xs text-muted">
            Fixed {formatUsd(summary.fixed)} · Var {formatUsd(summary.variable)} · Payroll{" "}
            {formatUsd(summary.payroll)}
          </p>
          {summary.expensePending > 0 && (
            <p className="text-xs text-amber-400">
              Pending payables: {formatUsd(summary.expensePending)}
            </p>
          )}
        </div>

        {/* Net Profit */}
        <div className="bg-surface border border-border rounded-xl p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Net Profit</span>
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <p
            className={`text-2xl font-bold ${
              summary.net >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {formatUsd(summary.net)}
          </p>
          <p className="text-xs text-muted">
            {summary.marginPct === null
              ? "No income logged yet"
              : `Margin: ${summary.marginPct.toFixed(1)}%`}
          </p>
        </div>

        {/* Monthly Budget */}
        <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Monthly Budget</span>
            <Target className="w-4 h-4 text-primary" />
          </div>
          {plannedExpense > 0 ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-2xl font-bold">{Math.round(budgetPct)}%</p>
                <span
                  className={`text-xs font-medium ${
                    budgetRemaining >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {budgetRemaining >= 0
                    ? `${formatUsd(budgetRemaining)} left`
                    : `${formatUsd(Math.abs(budgetRemaining))} over`}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${budgetBarColor}`}
                  style={{ width: `${Math.min(100, budgetPct)}%` }}
                />
              </div>
              <p className="text-xs text-muted">
                {formatUsd(summary.expense)} of {formatUsd(plannedExpense)} planned
              </p>
            </>
          ) : (
            <div className="space-y-2 pt-1">
              <p className="text-sm text-muted">No budget planned for this month.</p>
              <button
                onClick={onGoToBudget}
                className="text-xs font-medium text-primary hover:text-primary-hover underline"
              >
                Set monthly budget
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Daily cash flow chart */}
      <DailyCashFlowChart days={days} monthLabel={monthLabel(month)} />

      {/* Expense structure + Pending payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 space-y-4">
          <h3 className="text-sm font-semibold">Expense Structure</h3>

          {summary.expense === 0 ? (
            <p className="text-sm text-muted py-4">No expenses logged this month.</p>
          ) : (
            <>
              <div className="space-y-2.5">
                {STRUCTURE_ROWS.map(({ key, barClass }) => {
                  const val = summary[key];
                  if (val <= 0) return null;
                  const share = (val / summary.expense) * 100;
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{COST_TYPE_LABELS[key]}</span>
                        <span className="text-muted">
                          {formatUsd(val)} ({share.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-background overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barClass}`}
                          style={{ width: `${Math.min(100, share)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {expenseCategories.length > 0 && (
                <div className="pt-3 border-t border-border space-y-2">
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">
                    By Category
                  </p>
                  <ul className="space-y-1.5">
                    {expenseCategories.slice(0, 6).map((cat) => (
                      <li
                        key={cat.id ?? "uncategorized"}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="truncate">{cat.name}</span>
                        </span>
                        <span className="text-xs text-muted shrink-0">
                          {formatUsd(cat.total)} · {Math.round(cat.share * 100)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pending payables & receivables */}
        <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Pending Payments & Collections ({pendingItems.length})
            </h3>
          </div>

          {pendingItems.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted py-6">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              All movements for this month are marked as paid.
            </div>
          ) : (
            <ul className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {pendingItems.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-3 bg-background border border-border rounded-lg px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {tx.description || tx.counterparty || "Untitled movement"}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {dayLabel(tx.occurred_on)}
                      {tx.counterparty && tx.description ? ` · ${tx.counterparty}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-sm font-semibold ${
                        tx.kind === "income" ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {tx.kind === "income" ? "+" : "-"}
                      {formatUsd(tx.amount_usd)}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => onToggleStatus(tx, "paid")}
                        className="px-2.5 py-1 rounded-md bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20 text-xs font-medium transition-colors"
                      >
                        Mark paid
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
