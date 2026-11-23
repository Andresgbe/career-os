import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Pencil, Search, Trash2, X } from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import {
  COST_TYPE_LABELS,
  dayLabel,
  formatOriginalAmount,
  formatUsd,
  type AgencyCategoryRow,
  type AgencyTransactionRow,
  type CostType,
  type MovementKind,
  type PaymentStatus,
} from "../types";

interface LedgerTabProps {
  transactions: AgencyTransactionRow[];
  categories: AgencyCategoryRow[];
  canEdit: boolean;
  onEdit: (tx: AgencyTransactionRow) => void;
  onDelete: (id: string) => Promise<void>;
  onToggleStatus: (tx: AgencyTransactionRow, next: PaymentStatus) => void;
}

export default function LedgerTab({
  transactions,
  categories,
  canEdit,
  onEdit,
  onDelete,
  onToggleStatus,
}: LedgerTabProps) {
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | MovementKind>("all");
  const [costTypeFilter, setCostTypeFilter] = useState<"all" | CostType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [toDelete, setToDelete] = useState<AgencyTransactionRow | null>(null);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (kindFilter !== "all" && t.kind !== kindFilter) return false;
      if (costTypeFilter !== "all" && (t.kind !== "expense" || t.cost_type !== costTypeFilter)) {
        return false;
      }
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (categoryFilter === "__none__" && t.category_id !== null) return false;
      if (
        categoryFilter !== "all" &&
        categoryFilter !== "__none__" &&
        t.category_id !== categoryFilter
      ) {
        return false;
      }
      if (q) {
        const hay = `${t.description} ${t.counterparty} ${t.note}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, query, kindFilter, costTypeFilter, statusFilter, categoryFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, AgencyTransactionRow[]>();
    for (const t of filtered) {
      const list = map.get(t.occurred_on) ?? [];
      list.push(t);
      map.set(t.occurred_on, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const filteredTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.kind === "income") income += t.amount_usd;
      else expense += t.amount_usd;
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  const hasFilters =
    query !== "" ||
    kindFilter !== "all" ||
    costTypeFilter !== "all" ||
    statusFilter !== "all" ||
    categoryFilter !== "all";

  const clearFilters = () => {
    setQuery("");
    setKindFilter("all");
    setCostTypeFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
  };

  const controlClass =
    "bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary";

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-surface border border-border rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search description, client, vendor, or note..."
              className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary"
            />
          </div>

          <select
            aria-label="Filter by movement kind"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as "all" | MovementKind)}
            className={controlClass}
          >
            <option value="all">All kinds</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>

          <select
            aria-label="Filter by expense type"
            value={costTypeFilter}
            onChange={(e) => setCostTypeFilter(e.target.value as "all" | CostType)}
            className={controlClass}
          >
            <option value="all">All cost types</option>
            <option value="fixed">Fixed</option>
            <option value="variable">Variable</option>
            <option value="payroll">Payroll</option>
            <option value="other">Other</option>
          </select>

          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | PaymentStatus)}
            className={controlClass}
          >
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
          </select>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={controlClass}
          >
            <option value="all">All categories</option>
            <option value="__none__">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* Summary strip */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted pt-1 border-t border-border">
          <span>
            Showing <strong className="text-foreground">{filtered.length}</strong> of{" "}
            {transactions.length} movements
          </span>
          <span>
            Income:{" "}
            <strong className="text-emerald-400">
              {formatUsd(filteredTotals.income)}
            </strong>
          </span>
          <span>
            Expenses:{" "}
            <strong className="text-red-400">
              {formatUsd(filteredTotals.expense)}
            </strong>
          </span>
          <span>
            Net:{" "}
            <strong
              className={
                filteredTotals.net >= 0 ? "text-emerald-400" : "text-red-400"
              }
            >
              {formatUsd(filteredTotals.net)}
            </strong>
          </span>
        </div>
      </div>

      {/* Grouped ledger */}
      {grouped.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-sm text-muted">
          {transactions.length === 0
            ? "No movements logged for this month yet."
            : "No movements match the selected filters."}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, rows]) => (
            <section key={date} className="space-y-2">
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wider px-1">
                {dayLabel(date)}
              </h4>
              <ul className="bg-surface border border-border rounded-xl divide-y divide-border">
                {rows.map((tx) => {
                  const cat = tx.category_id ? categoryMap.get(tx.category_id) : undefined;
                  const converted = tx.rate_per_usd !== 1;
                  return (
                    <li
                      key={tx.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover/40 transition-colors flex-wrap sm:flex-nowrap"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat?.color ?? "#64748b" }}
                        title={cat?.name ?? "Uncategorized"}
                      />

                      <div className="flex-1 min-w-[180px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">
                            {tx.description || tx.counterparty || cat?.name || "Movement"}
                          </p>
                          {tx.kind === "expense" && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] bg-background border border-border text-muted">
                              {COST_TYPE_LABELS[tx.cost_type]}
                            </span>
                          )}
                          <button
                            disabled={!canEdit}
                            onClick={() =>
                              onToggleStatus(tx, tx.status === "paid" ? "pending" : "paid")
                            }
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                              tx.status === "paid"
                                ? "bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20"
                                : "bg-amber-400/10 text-amber-400 hover:bg-amber-400/20"
                            } disabled:cursor-default`}
                            title={canEdit ? "Click to toggle status" : undefined}
                          >
                            {tx.status === "paid" ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            {tx.status === "paid" ? "Paid" : "Pending"}
                          </button>
                        </div>

                        <p className="text-xs text-muted mt-0.5">
                          {[cat?.name ?? "Uncategorized", tx.counterparty, tx.note]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>

                      <div className="text-right shrink-0 ml-auto sm:ml-0">
                        <p
                          className={`text-sm font-semibold ${
                            tx.kind === "income" ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {tx.kind === "income" ? "+" : "-"}
                          {formatUsd(tx.amount_usd)}
                        </p>
                        {converted && (
                          <p className="text-[11px] text-muted">
                            {formatOriginalAmount(tx.amount, tx.currency)} · {tx.rate_label || "Rate"}
                          </p>
                        )}
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => onEdit(tx)}
                            className="p-1.5 rounded text-muted hover:text-primary hover:bg-surface-hover"
                            aria-label="Edit movement"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setToDelete(tx)}
                            className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-surface-hover"
                            aria-label="Delete movement"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete movement"
          message={`Delete "${toDelete.description || toDelete.counterparty || "this movement"}"?`}
          confirmLabel="Delete"
          onCancel={() => setToDelete(null)}
          onConfirm={async () => {
            const id = toDelete.id;
            setToDelete(null);
            await onDelete(id);
          }}
        />
      )}
    </div>
  );
}
