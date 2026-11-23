import { useMemo, useState } from "react";
import { Check, CheckCircle2, Pencil, Plus, Repeat, Trash2, Users, X } from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import { errorMessage } from "../../../lib/errors";
import {
  addFixedItem,
  addPayrollMember,
  deleteFixedItem,
  deletePayrollMember,
  updateFixedItem,
  updatePayrollMember,
} from "../api";
import {
  PAY_TYPE_LABELS,
  USD_BCV,
  currencyOptions,
  defaultDateForMonth,
  estimateUsdFromRateCode,
  formatOriginalAmount,
  formatUsd,
  type AgencyCategoryRow,
  type AgencyFixedItemRow,
  type AgencyPayrollMemberRow,
  type AgencyRateRow,
  type AgencyTransactionRow,
  type MovementPrefill,
  type PayType,
} from "../types";

interface FixedPayrollTabProps {
  month: string;
  payrollMembers: AgencyPayrollMemberRow[];
  fixedItems: AgencyFixedItemRow[];
  transactions: AgencyTransactionRow[];
  categories: AgencyCategoryRow[];
  rates: AgencyRateRow[];
  canEdit: boolean;
  onPayrollChange: (rows: AgencyPayrollMemberRow[]) => void;
  onFixedChange: (rows: AgencyFixedItemRow[]) => void;
  onOpenMovement: (prefill: MovementPrefill) => void;
}

const PAY_TYPES: PayType[] = ["salary", "retainer", "hourly", "commission"];

function rateCurrency(code: string, rates: AgencyRateRow[]): string {
  if (!code || code === USD_BCV) return "USD";
  return rates.find((r) => r.code === code)?.currency ?? "USD";
}

function dayInputToNumber(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n < 1 || n > 31) return null;
  return n;
}

function dateForDayInMonth(month: string, day: number | null): string {
  if (!day) return defaultDateForMonth(month);
  const [y, m] = month.split("-").map(Number);
  const maxDay = new Date(y, m, 0).getDate();
  const clamped = Math.min(day, maxDay);
  return `${month}-${String(clamped).padStart(2, "0")}`;
}

export default function FixedPayrollTab({
  month,
  payrollMembers,
  fixedItems,
  transactions,
  categories,
  rates,
  canEdit,
  onPayrollChange,
  onFixedChange,
  onOpenMovement,
}: FixedPayrollTabProps) {
  const options = useMemo(() => currencyOptions(rates), [rates]);
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.kind === "expense" || c.kind === "both"),
    [categories]
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const payrollCategory = useMemo(
    () => categories.find((c) => c.default_cost_type === "payroll") ?? null,
    [categories]
  );

  const loggedPayrollIds = useMemo(
    () => new Set(transactions.map((t) => t.payroll_member_id).filter(Boolean)),
    [transactions]
  );
  const loggedFixedIds = useMemo(
    () => new Set(transactions.map((t) => t.fixed_item_id).filter(Boolean)),
    [transactions]
  );

  const payrollBaselineUsd = useMemo(
    () =>
      payrollMembers
        .filter((m) => m.active)
        .reduce(
          (sum, m) =>
            sum +
            (estimateUsdFromRateCode(m.default_amount, m.default_rate_code, rates) ?? 0),
          0
        ),
    [payrollMembers, rates]
  );

  const fixedBaselineUsd = useMemo(
    () =>
      fixedItems
        .filter((f) => f.active)
        .reduce(
          (sum, f) =>
            sum +
            (estimateUsdFromRateCode(f.default_amount, f.default_rate_code, rates) ?? 0),
          0
        ),
    [fixedItems, rates]
  );

  // Payroll form state
  const [showPayrollForm, setShowPayrollForm] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [mName, setMName] = useState("");
  const [mRole, setMRole] = useState("");
  const [mPayType, setMPayType] = useState<PayType>("salary");
  const [mAmount, setMAmount] = useState("");
  const [mRateCode, setMRateCode] = useState(USD_BCV);
  const [mPayDay, setMPayDay] = useState("");
  const [mNotes, setMNotes] = useState("");
  const [deleteMember, setDeleteMember] = useState<AgencyPayrollMemberRow | null>(null);

  // Fixed cost form state
  const [showFixedForm, setShowFixedForm] = useState(false);
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null);
  const [fName, setFName] = useState("");
  const [fVendor, setFVendor] = useState("");
  const [fCategoryId, setFCategoryId] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fRateCode, setFRateCode] = useState(USD_BCV);
  const [fDueDay, setFDueDay] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [deleteFixed, setDeleteFixed] = useState<AgencyFixedItemRow | null>(null);

  const [error, setError] = useState("");

  function resetPayrollForm() {
    setShowPayrollForm(false);
    setEditingMemberId(null);
    setMName("");
    setMRole("");
    setMPayType("salary");
    setMAmount("");
    setMRateCode(USD_BCV);
    setMPayDay("");
    setMNotes("");
  }

  function startEditMember(member: AgencyPayrollMemberRow) {
    setEditingMemberId(member.id);
    setMName(member.name);
    setMRole(member.role);
    setMPayType(member.pay_type);
    setMAmount(member.default_amount > 0 ? String(member.default_amount) : "");
    setMRateCode(member.default_rate_code || USD_BCV);
    setMPayDay(member.pay_day ? String(member.pay_day) : "");
    setMNotes(member.notes);
    setShowPayrollForm(true);
    setError("");
  }

  async function saveMember() {
    const name = mName.trim();
    const amount = Number(mAmount.replace(",", ".")) || 0;
    if (!name) {
      setError("Enter a team member name.");
      return;
    }
    if (amount < 0) {
      setError("Amount cannot be negative.");
      return;
    }
    setError("");
    const fields = {
      name,
      role: mRole.trim(),
      pay_type: mPayType,
      default_amount: amount,
      default_rate_code: mRateCode,
      pay_day: dayInputToNumber(mPayDay),
      notes: mNotes.trim(),
    };
    try {
      if (editingMemberId) {
        await updatePayrollMember(editingMemberId, fields);
        onPayrollChange(
          payrollMembers.map((m) => (m.id === editingMemberId ? { ...m, ...fields } : m))
        );
      } else {
        const created = await addPayrollMember({
          ...fields,
          active: true,
          sort_order: payrollMembers.length,
        });
        onPayrollChange([...payrollMembers, created]);
      }
      resetPayrollForm();
    } catch (err) {
      setError(errorMessage(err, "Error saving team member"));
    }
  }

  async function toggleMemberActive(member: AgencyPayrollMemberRow) {
    const next = !member.active;
    const prev = payrollMembers;
    onPayrollChange(
      payrollMembers.map((m) => (m.id === member.id ? { ...m, active: next } : m))
    );
    try {
      await updatePayrollMember(member.id, { active: next });
    } catch (err) {
      onPayrollChange(prev);
      setError(errorMessage(err, "Error updating team member"));
    }
  }

  async function confirmDeleteMember() {
    if (!deleteMember) return;
    const target = deleteMember;
    setDeleteMember(null);
    const prev = payrollMembers;
    onPayrollChange(payrollMembers.filter((m) => m.id !== target.id));
    try {
      await deletePayrollMember(target.id);
    } catch (err) {
      onPayrollChange(prev);
      setError(errorMessage(err, "Error deleting team member"));
    }
  }

  function resetFixedForm() {
    setShowFixedForm(false);
    setEditingFixedId(null);
    setFName("");
    setFVendor("");
    setFCategoryId("");
    setFAmount("");
    setFRateCode(USD_BCV);
    setFDueDay("");
    setFNotes("");
  }

  function startEditFixed(item: AgencyFixedItemRow) {
    setEditingFixedId(item.id);
    setFName(item.name);
    setFVendor(item.vendor);
    setFCategoryId(item.category_id ?? "");
    setFAmount(item.default_amount > 0 ? String(item.default_amount) : "");
    setFRateCode(item.default_rate_code || USD_BCV);
    setFDueDay(item.due_day ? String(item.due_day) : "");
    setFNotes(item.notes);
    setShowFixedForm(true);
    setError("");
  }

  async function saveFixed() {
    const name = fName.trim();
    const amount = Number(fAmount.replace(",", ".")) || 0;
    if (!name) {
      setError("Enter a fixed cost name.");
      return;
    }
    if (amount < 0) {
      setError("Amount cannot be negative.");
      return;
    }
    setError("");
    const fields = {
      name,
      vendor: fVendor.trim(),
      category_id: fCategoryId || null,
      default_amount: amount,
      default_rate_code: fRateCode,
      due_day: dayInputToNumber(fDueDay),
      notes: fNotes.trim(),
    };
    try {
      if (editingFixedId) {
        await updateFixedItem(editingFixedId, fields);
        onFixedChange(
          fixedItems.map((f) => (f.id === editingFixedId ? { ...f, ...fields } : f))
        );
      } else {
        const created = await addFixedItem({
          ...fields,
          active: true,
          sort_order: fixedItems.length,
        });
        onFixedChange([...fixedItems, created]);
      }
      resetFixedForm();
    } catch (err) {
      setError(errorMessage(err, "Error saving fixed cost"));
    }
  }

  async function toggleFixedActive(item: AgencyFixedItemRow) {
    const next = !item.active;
    const prev = fixedItems;
    onFixedChange(fixedItems.map((f) => (f.id === item.id ? { ...f, active: next } : f)));
    try {
      await updateFixedItem(item.id, { active: next });
    } catch (err) {
      onFixedChange(prev);
      setError(errorMessage(err, "Error updating fixed cost"));
    }
  }

  async function confirmDeleteFixed() {
    if (!deleteFixed) return;
    const target = deleteFixed;
    setDeleteFixed(null);
    const prev = fixedItems;
    onFixedChange(fixedItems.filter((f) => f.id !== target.id));
    try {
      await deleteFixedItem(target.id);
    } catch (err) {
      onFixedChange(prev);
      setError(errorMessage(err, "Error deleting fixed cost"));
    }
  }

  const inputClass =
    "bg-background border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary w-full";

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        {/* Team & Payroll */}
        <section className="bg-surface border border-border rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Team & Payroll ({payrollMembers.length})
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Active monthly baseline:{" "}
                <strong className="text-foreground">
                  {formatUsd(payrollBaselineUsd)}
                </strong>
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  resetPayrollForm();
                  setShowPayrollForm(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-border text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add member
              </button>
            )}
          </div>

          {showPayrollForm && canEdit && (
            <div className="bg-background border border-border rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">
                  {editingMemberId ? "Edit team member" : "New team member"}
                </span>
                <button
                  onClick={resetPayrollForm}
                  className="p-1 rounded text-muted hover:text-foreground"
                  aria-label="Close form"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  autoFocus
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  placeholder="Name *"
                  className={inputClass}
                />
                <input
                  value={mRole}
                  onChange={(e) => setMRole(e.target.value)}
                  placeholder="Role (e.g. Video Editor)"
                  className={inputClass}
                />
                <select
                  value={mPayType}
                  onChange={(e) => setMPayType(e.target.value as PayType)}
                  className={inputClass}
                >
                  {PAY_TYPES.map((pt) => (
                    <option key={pt} value={pt}>
                      {PAY_TYPE_LABELS[pt]}
                    </option>
                  ))}
                </select>
                <input
                  inputMode="numeric"
                  value={mPayDay}
                  onChange={(e) => setMPayDay(e.target.value)}
                  placeholder="Pay day (1-31)"
                  className={inputClass}
                />
                <input
                  inputMode="decimal"
                  value={mAmount}
                  onChange={(e) => setMAmount(e.target.value)}
                  placeholder="Base amount"
                  className={inputClass}
                />
                <select
                  value={mRateCode}
                  onChange={(e) => setMRateCode(e.target.value)}
                  className={inputClass}
                >
                  {options.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={mNotes}
                onChange={(e) => setMNotes(e.target.value)}
                placeholder="Payment notes (Binance ID, bank info...)"
                className={inputClass}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={resetPayrollForm}
                  className="px-3 py-1.5 rounded-lg bg-surface-hover text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={saveMember}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save
                </button>
              </div>
            </div>
          )}

          {payrollMembers.length === 0 ? (
            <p className="text-sm text-muted py-4">
              No payroll members configured yet. Add team members to track monthly
              payroll and log payments in one click.
            </p>
          ) : (
            <ul className="space-y-2">
              {payrollMembers.map((member) => {
                const logged = loggedPayrollIds.has(member.id);
                const estUsd = estimateUsdFromRateCode(
                  member.default_amount,
                  member.default_rate_code,
                  rates
                );
                const cur = rateCurrency(member.default_rate_code, rates);
                return (
                  <li
                    key={member.id}
                    className={`bg-background border border-border rounded-xl p-3 space-y-2 ${
                      member.active ? "" : "opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{member.name}</span>
                          {member.role && (
                            <span className="text-xs text-muted">{member.role}</span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[11px] bg-surface border border-border text-muted">
                            {PAY_TYPE_LABELS[member.pay_type]}
                          </span>
                          {logged ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-400/10 text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              Logged this month
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-400/10 text-amber-400">
                              Not logged
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted mt-1">
                          {formatOriginalAmount(member.default_amount, cur)}
                          {member.default_rate_code !== USD_BCV &&
                            ` (${member.default_rate_code}${
                              estUsd !== null ? ` ≈ ${formatUsd(estUsd)}` : ""
                            })`}
                          {member.pay_day ? ` · Day ${member.pay_day}` : ""}
                          {member.notes ? ` · ${member.notes}` : ""}
                        </p>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() =>
                              onOpenMovement({
                                kind: "expense",
                                cost_type: "payroll",
                                status: "paid",
                                occurred_on: dateForDayInMonth(month, member.pay_day),
                                description: `Payroll — ${member.name}`,
                                counterparty: member.name,
                                category_id: payrollCategory?.id ?? null,
                                payroll_member_id: member.id,
                                amount: member.default_amount,
                                rate_code: member.default_rate_code,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-primary/15 text-primary-hover hover:bg-primary/25 text-xs font-medium transition-colors"
                          >
                            Log payment
                          </button>
                          <button
                            onClick={() => toggleMemberActive(member)}
                            className="px-2 py-1 rounded-lg border border-border text-[11px] text-muted hover:text-foreground"
                            title="Toggle active status"
                          >
                            {member.active ? "Active" : "Paused"}
                          </button>
                          <button
                            onClick={() => startEditMember(member)}
                            className="p-1.5 rounded text-muted hover:text-primary hover:bg-surface-hover"
                            aria-label={`Edit ${member.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteMember(member)}
                            className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-surface-hover"
                            aria-label={`Delete ${member.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Recurring Fixed Costs */}
        <section className="bg-surface border border-border rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Repeat className="w-4 h-4 text-blue-400" />
                Recurring Fixed Costs ({fixedItems.length})
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Active monthly baseline:{" "}
                <strong className="text-foreground">
                  {formatUsd(fixedBaselineUsd)}
                </strong>
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  resetFixedForm();
                  setShowFixedForm(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-border text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add fixed cost
              </button>
            )}
          </div>

          {showFixedForm && canEdit && (
            <div className="bg-background border border-border rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">
                  {editingFixedId ? "Edit fixed cost" : "New fixed cost"}
                </span>
                <button
                  onClick={resetFixedForm}
                  className="p-1 rounded text-muted hover:text-foreground"
                  aria-label="Close form"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  autoFocus
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  placeholder="Name * (e.g. Figma Pro)"
                  className={inputClass}
                />
                <input
                  value={fVendor}
                  onChange={(e) => setFVendor(e.target.value)}
                  placeholder="Vendor (e.g. Figma)"
                  className={inputClass}
                />
                <select
                  value={fCategoryId}
                  onChange={(e) => setFCategoryId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Category (optional)</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  inputMode="numeric"
                  value={fDueDay}
                  onChange={(e) => setFDueDay(e.target.value)}
                  placeholder="Due day (1-31)"
                  className={inputClass}
                />
                <input
                  inputMode="decimal"
                  value={fAmount}
                  onChange={(e) => setFAmount(e.target.value)}
                  placeholder="Base amount"
                  className={inputClass}
                />
                <select
                  value={fRateCode}
                  onChange={(e) => setFRateCode(e.target.value)}
                  className={inputClass}
                >
                  {options.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={fNotes}
                onChange={(e) => setFNotes(e.target.value)}
                placeholder="Notes (account email, renewal details...)"
                className={inputClass}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={resetFixedForm}
                  className="px-3 py-1.5 rounded-lg bg-surface-hover text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={saveFixed}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save
                </button>
              </div>
            </div>
          )}

          {fixedItems.length === 0 ? (
            <p className="text-sm text-muted py-4">
              No fixed costs configured yet. Add recurring software, rent, internet, or
              retainer tools here.
            </p>
          ) : (
            <ul className="space-y-2">
              {fixedItems.map((item) => {
                const logged = loggedFixedIds.has(item.id);
                const cat = item.category_id ? categoryMap.get(item.category_id) : undefined;
                const estUsd = estimateUsdFromRateCode(
                  item.default_amount,
                  item.default_rate_code,
                  rates
                );
                const cur = rateCurrency(item.default_rate_code, rates);
                return (
                  <li
                    key={item.id}
                    className={`bg-background border border-border rounded-xl p-3 space-y-2 ${
                      item.active ? "" : "opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {cat && (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                          )}
                          <span className="text-sm font-semibold">{item.name}</span>
                          {item.vendor && (
                            <span className="text-xs text-muted">{item.vendor}</span>
                          )}
                          {logged ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-400/10 text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              Logged this month
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-400/10 text-amber-400">
                              Not logged
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted mt-1">
                          {formatOriginalAmount(item.default_amount, cur)}
                          {item.default_rate_code !== USD_BCV &&
                            ` (${item.default_rate_code}${
                              estUsd !== null ? ` ≈ ${formatUsd(estUsd)}` : ""
                            })`}
                          {cat ? ` · ${cat.name}` : ""}
                          {item.due_day ? ` · Due day ${item.due_day}` : ""}
                          {item.notes ? ` · ${item.notes}` : ""}
                        </p>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() =>
                              onOpenMovement({
                                kind: "expense",
                                cost_type: "fixed",
                                status: "paid",
                                occurred_on: dateForDayInMonth(month, item.due_day),
                                description: item.name,
                                counterparty: item.vendor || item.name,
                                category_id: item.category_id,
                                fixed_item_id: item.id,
                                amount: item.default_amount,
                                rate_code: item.default_rate_code,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-blue-400/15 text-blue-300 hover:bg-blue-400/25 text-xs font-medium transition-colors"
                          >
                            Log expense
                          </button>
                          <button
                            onClick={() => toggleFixedActive(item)}
                            className="px-2 py-1 rounded-lg border border-border text-[11px] text-muted hover:text-foreground"
                            title="Toggle active status"
                          >
                            {item.active ? "Active" : "Paused"}
                          </button>
                          <button
                            onClick={() => startEditFixed(item)}
                            className="p-1.5 rounded text-muted hover:text-primary hover:bg-surface-hover"
                            aria-label={`Edit ${item.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteFixed(item)}
                            className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-surface-hover"
                            aria-label={`Delete ${item.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {deleteMember && (
        <ConfirmDialog
          title="Delete team member"
          message={`Remove "${deleteMember.name}" from payroll? Previously logged transactions remain intact.`}
          confirmLabel="Delete"
          onCancel={() => setDeleteMember(null)}
          onConfirm={confirmDeleteMember}
        />
      )}

      {deleteFixed && (
        <ConfirmDialog
          title="Delete fixed cost"
          message={`Remove "${deleteFixed.name}" from recurring fixed costs? Previously logged transactions remain intact.`}
          confirmLabel="Delete"
          onCancel={() => setDeleteFixed(null)}
          onConfirm={confirmDeleteFixed}
        />
      )}
    </div>
  );
}
