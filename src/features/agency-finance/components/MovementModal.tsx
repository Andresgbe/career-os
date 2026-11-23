import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Save, TrendingDown, TrendingUp, X } from "lucide-react";
import { errorMessage } from "../../../lib/errors";
import { addTransaction, updateTransaction } from "../api";
import {
  COST_TYPE_LABELS,
  USD_BCV,
  currencyOptions,
  defaultDateForMonth,
  formatUsd,
  toUsd,
  type AgencyCategoryRow,
  type AgencyPayrollMemberRow,
  type AgencyRateRow,
  type AgencyTransactionRow,
  type CostType,
  type MovementKind,
  type MovementPrefill,
  type PaymentStatus,
} from "../types";

interface MovementModalProps {
  transaction: AgencyTransactionRow | null;
  prefill: MovementPrefill | null;
  activeMonth: string;
  categories: AgencyCategoryRow[];
  rates: AgencyRateRow[];
  payrollMembers: AgencyPayrollMemberRow[];
  onClose: () => void;
  onSaved: (tx: AgencyTransactionRow) => void;
}

const EXPENSE_COST_TYPES: CostType[] = ["fixed", "variable", "payroll", "other"];

export default function MovementModal({
  transaction,
  prefill,
  activeMonth,
  categories,
  rates,
  payrollMembers,
  onClose,
  onSaved,
}: MovementModalProps) {
  const options = useMemo(() => currencyOptions(rates), [rates]);

  const [kind, setKind] = useState<MovementKind>(
    transaction?.kind ?? prefill?.kind ?? "expense"
  );
  const [costType, setCostType] = useState<CostType>(
    transaction?.cost_type ?? prefill?.cost_type ?? "variable"
  );
  const [status, setStatus] = useState<PaymentStatus>(
    transaction?.status ?? prefill?.status ?? "paid"
  );
  const [amount, setAmount] = useState(
    transaction
      ? String(transaction.amount)
      : prefill?.amount !== undefined && prefill.amount > 0
        ? String(prefill.amount)
        : ""
  );
  const [option, setOption] = useState(() => {
    if (transaction) {
      if (transaction.rate_per_usd === 1 && !transaction.rate_label) return USD_BCV;
      return transaction.rate_label || USD_BCV;
    }
    if (prefill?.rate_code) {
      const match = options.find((o) => o.code === prefill.rate_code);
      if (match) return match.code;
    }
    return USD_BCV;
  });
  const [rateOverride, setRateOverride] = useState(
    transaction && transaction.rate_per_usd !== 1
      ? String(transaction.rate_per_usd)
      : ""
  );
  const [categoryId, setCategoryId] = useState(
    transaction?.category_id ?? prefill?.category_id ?? ""
  );
  const [payrollMemberId, setPayrollMemberId] = useState(
    transaction?.payroll_member_id ?? prefill?.payroll_member_id ?? ""
  );
  const [fixedItemId] = useState(
    transaction?.fixed_item_id ?? prefill?.fixed_item_id ?? null
  );
  const [counterparty, setCounterparty] = useState(
    transaction?.counterparty ?? prefill?.counterparty ?? ""
  );
  const [description, setDescription] = useState(
    transaction?.description ?? prefill?.description ?? ""
  );
  const [date, setDate] = useState(
    transaction?.occurred_on ?? prefill?.occurred_on ?? defaultDateForMonth(activeMonth)
  );
  const [note, setNote] = useState(transaction?.note ?? prefill?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selected = options.find((o) => o.code === option) ?? options[0];
  const isReference = selected.code === USD_BCV;

  const effectiveRate =
    rateOverride.trim() !== ""
      ? Number(rateOverride.replace(",", "."))
      : (selected.perUsd ?? NaN);

  const parsedAmount = Number(amount.replace(",", "."));
  const usd =
    Number.isFinite(parsedAmount) && Number.isFinite(effectiveRate)
      ? toUsd(parsedAmount, effectiveRate)
      : 0;

  const missingRate =
    !isReference && (!Number.isFinite(effectiveRate) || effectiveRate <= 0);

  const visibleCategories = categories.filter(
    (c) => c.kind === kind || c.kind === "both"
  );

  function handleCategoryChange(nextId: string) {
    setCategoryId(nextId);
    if (!transaction && kind === "expense" && nextId) {
      const cat = categories.find((c) => c.id === nextId);
      if (cat) setCostType(cat.default_cost_type);
    }
  }

  function handlePayrollMemberChange(nextMemberId: string) {
    setPayrollMemberId(nextMemberId);
    const member = payrollMembers.find((m) => m.id === nextMemberId);
    if (!member) return;
    if (!counterparty.trim()) setCounterparty(member.name);
    if (!description.trim()) setDescription(`Payroll — ${member.name}`);
    if (!amount.trim() && member.default_amount > 0) {
      setAmount(String(member.default_amount));
      if (options.some((o) => o.code === member.default_rate_code)) {
        setOption(member.default_rate_code);
        setRateOverride("");
      }
    }
  }

  async function save() {
    setError("");
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (missingRate) {
      setError(
        `Missing rate for ${selected.label}. Sync/set it under Customize or enter a rate override here.`
      );
      return;
    }

    setSaving(true);
    try {
      const fields = {
        kind,
        cost_type: kind === "income" ? ("other" as CostType) : costType,
        status,
        occurred_on: date,
        description: description.trim(),
        counterparty: counterparty.trim(),
        category_id: categoryId || null,
        payroll_member_id:
          kind === "expense" && costType === "payroll" ? payrollMemberId || null : null,
        fixed_item_id: kind === "expense" ? fixedItemId : null,
        amount: parsedAmount,
        currency: selected.currency,
        rate_per_usd: isReference ? 1 : effectiveRate,
        rate_label: selected.rateLabel,
        note: note.trim(),
      };
      const saved = transaction
        ? await updateTransaction(transaction.id, fields)
        : await addTransaction(fields);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Error saving movement"));
    } finally {
      setSaving(false);
    }
  }

  const input =
    "bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary w-full";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl w-full max-w-lg my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">
            {transaction ? "Edit movement" : "New agency movement"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-muted hover:text-foreground hover:bg-surface-hover"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          {/* Income / Expense */}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                [
                  "expense",
                  "Expense",
                  TrendingDown,
                  "text-red-400 border-red-400/50 bg-red-400/10",
                ],
                [
                  "income",
                  "Income",
                  TrendingUp,
                  "text-emerald-400 border-emerald-400/50 bg-emerald-400/10",
                ],
              ] as const
            ).map(([value, label, Icon, active]) => (
              <button
                key={value}
                onClick={() => {
                  setKind(value);
                  setCategoryId("");
                  if (value === "income") setCostType("other");
                  else if (costType === "other") setCostType("variable");
                }}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  kind === value
                    ? active
                    : "border-border text-muted hover:bg-surface-hover"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Cost Type + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
            {kind === "expense" ? (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Expense type</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {EXPENSE_COST_TYPES.map((ct) => (
                    <button
                      key={ct}
                      onClick={() => setCostType(ct)}
                      className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        costType === ct
                          ? "border-primary bg-primary/15 text-primary-hover"
                          : "border-border text-muted hover:bg-surface-hover"
                      }`}
                    >
                      {COST_TYPE_LABELS[ct]}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div />
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Status</label>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setStatus("paid")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    status === "paid"
                      ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-400"
                      : "border-border text-muted hover:bg-surface-hover"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Paid
                </button>
                <button
                  onClick={() => setStatus("pending")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    status === "pending"
                      ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                      : "border-border text-muted hover:bg-surface-hover"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Pending
                </button>
              </div>
            </div>
          </div>

          {/* Amount + Currency/Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Amount *</label>
              <input
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`${input} text-lg font-semibold`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Currency / Rate</label>
              <select
                value={option}
                onChange={(e) => {
                  setOption(e.target.value);
                  setRateOverride("");
                }}
                className={`${input} sm:w-48`}
              >
                {options.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!isReference && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">
                Rate override (units of {selected.currency} per 1 USD BCV)
              </label>
              <input
                inputMode="decimal"
                value={rateOverride}
                onChange={(e) => setRateOverride(e.target.value)}
                placeholder={
                  selected.perUsd !== null
                    ? `${selected.perUsd} (saved rate)`
                    : "No saved rate yet"
                }
                className={input}
              />
              <p className="text-xs text-muted">
                Leave blank to use the saved rate. An override applies only to this movement.
              </p>
            </div>
          )}

          {/* Live USD BCV equivalent */}
          <div
            className={`rounded-lg px-3 py-2.5 text-sm flex items-center gap-2 ${
              missingRate
                ? "bg-amber-400/10 text-amber-400"
                : "bg-background border border-border"
            }`}
          >
            {missingRate ? (
              <>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Missing rate for {selected.label}: cannot calculate USD BCV equivalent yet.
              </>
            ) : (
              <>
                <span className="text-muted">Equivalent:</span>
                <strong
                  className={kind === "income" ? "text-emerald-400" : "text-red-400"}
                >
                  {kind === "income" ? "+" : "-"}
                  {formatUsd(usd)}
                </strong>
                <span className="text-xs text-muted">
                  USD BCV
                  {!isReference && ` · ${selected.label} @ ${effectiveRate}`}
                </span>
              </>
            )}
          </div>

          {/* Payroll member selector when cost_type === payroll */}
          {kind === "expense" && costType === "payroll" && payrollMembers.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Team member (optional)</label>
              <select
                value={payrollMemberId}
                onChange={(e) => handlePayrollMemberChange(e.target.value)}
                className={input}
              >
                <option value="">Select team member...</option>
                {payrollMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.role ? ` — ${m.role}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category + Counterparty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Category</label>
              <select
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className={input}
              >
                <option value="">Uncategorized</option>
                {visibleCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">
                {kind === "income" ? "Client / Source" : "Vendor / Payee"}
              </label>
              <input
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder={kind === "income" ? "Acme Corp..." : "Figma, Meta Ads..."}
                className={input}
              />
            </div>
          </div>

          {/* Description + Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  kind === "income"
                    ? "Monthly retainer, milestone 1..."
                    : "Ad spend, server hosting..."
                }
                className={input}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={input}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Invoice #, payment reference..."
              className={`${input} resize-y`}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <footer className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-hover hover:bg-border text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save"}
          </button>
        </footer>
      </div>
    </div>
  );
}
