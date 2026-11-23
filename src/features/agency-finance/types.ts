// Domain types, starter presets, currency conversion, and pure aggregation
// helpers for the Agency Finance module.

export type MovementKind = "income" | "expense";
export type CategoryKind = MovementKind | "both";
export type CostType = "fixed" | "variable" | "payroll" | "other";
export type PaymentStatus = "paid" | "pending";
export type PayType = "salary" | "retainer" | "hourly" | "commission";

export interface AgencyCategoryRow {
  id: string;
  user_id: string;
  name: string;
  kind: CategoryKind;
  default_cost_type: CostType;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface AgencyRateRow {
  id: string;
  user_id: string;
  code: string;
  label: string;
  currency: string;
  per_usd: number | null;
  updated_at: string;
}

export interface AgencyPayrollMemberRow {
  id: string;
  user_id: string;
  name: string;
  role: string;
  pay_type: PayType;
  default_amount: number;
  default_rate_code: string;
  pay_day: number | null;
  active: boolean;
  notes: string;
  sort_order: number;
  created_at: string;
}

export interface AgencyFixedItemRow {
  id: string;
  user_id: string;
  name: string;
  vendor: string;
  category_id: string | null;
  default_amount: number;
  default_rate_code: string;
  due_day: number | null;
  active: boolean;
  notes: string;
  sort_order: number;
  created_at: string;
}

export interface AgencyTransactionRow {
  id: string;
  user_id: string;
  kind: MovementKind;
  cost_type: CostType;
  status: PaymentStatus;
  occurred_on: string;
  description: string;
  counterparty: string;
  category_id: string | null;
  payroll_member_id: string | null;
  fixed_item_id: string | null;
  amount: number;
  currency: string;
  rate_per_usd: number;
  rate_label: string;
  amount_usd: number;
  note: string;
  created_at: string;
}

export interface AgencyTransactionFields {
  kind: MovementKind;
  cost_type: CostType;
  status: PaymentStatus;
  occurred_on: string;
  description: string;
  counterparty: string;
  category_id: string | null;
  payroll_member_id: string | null;
  fixed_item_id: string | null;
  amount: number;
  currency: string;
  rate_per_usd: number;
  rate_label: string;
  note: string;
}

export interface AgencyMonthPlanRow {
  id: string;
  user_id: string;
  month: string;
  planned_income: number;
  planned_expense: number;
  category_budgets: Record<string, number>;
  notes: string;
  updated_at: string;
}

export interface MovementPrefill {
  kind?: MovementKind;
  cost_type?: CostType;
  status?: PaymentStatus;
  occurred_on?: string;
  description?: string;
  counterparty?: string;
  category_id?: string | null;
  payroll_member_id?: string | null;
  fixed_item_id?: string | null;
  amount?: number;
  rate_code?: string;
  note?: string;
}

export const USD_BCV = "USD_BCV";

export const CATEGORY_COLORS = [
  "#10b981",
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#3b82f6",
  "#14b8a6",
  "#f97316",
  "#a855f7",
  "#eab308",
  "#64748b",
];

export const COST_TYPE_LABELS: Record<CostType, string> = {
  fixed: "Fixed",
  variable: "Variable",
  payroll: "Payroll",
  other: "Other",
};

export const PAY_TYPE_LABELS: Record<PayType, string> = {
  salary: "Salary",
  retainer: "Retainer",
  hourly: "Hourly",
  commission: "Commission",
};

export const STARTER_RATES: Array<{
  code: string;
  label: string;
  currency: string;
  per_usd: number | null;
}> = [
  { code: "BCV", label: "Bolivares (BCV)", currency: "VES", per_usd: null },
  { code: "CASH", label: "USD Cash (Parallel)", currency: "USD", per_usd: null },
  { code: "USDT", label: "USDT (Parallel)", currency: "USD", per_usd: null },
  { code: "EUR", label: "Euro (EUR)", currency: "EUR", per_usd: null },
];

export const STARTER_CATEGORIES: Array<{
  name: string;
  kind: CategoryKind;
  default_cost_type: CostType;
  color: string;
}> = [
  { name: "Client Retainers", kind: "income", default_cost_type: "other", color: "#10b981" },
  { name: "Project Payments", kind: "income", default_cost_type: "other", color: "#06b6d4" },
  { name: "Team Payroll", kind: "expense", default_cost_type: "payroll", color: "#8b5cf6" },
  { name: "Software & Subscriptions", kind: "expense", default_cost_type: "fixed", color: "#3b82f6" },
  { name: "Office & Operations", kind: "expense", default_cost_type: "fixed", color: "#14b8a6" },
  { name: "Marketing & Ads", kind: "expense", default_cost_type: "variable", color: "#f59e0b" },
  { name: "Equipment & Travel", kind: "expense", default_cost_type: "variable", color: "#f97316" },
  { name: "Taxes & Bank Fees", kind: "expense", default_cost_type: "variable", color: "#ef4444" },
];

// ============================================
// CONVERSION & CURRENCY OPTIONS
// ============================================

export function toUsd(amount: number, ratePerUsd: number): number {
  if (!Number.isFinite(ratePerUsd) || ratePerUsd <= 0) return 0;
  return amount / ratePerUsd;
}

export interface CurrencyOption {
  code: string;
  currency: string;
  label: string;
  perUsd: number | null;
  rateLabel: string;
}

export function currencyOptions(rates: AgencyRateRow[]): CurrencyOption[] {
  return [
    {
      code: USD_BCV,
      currency: "USD",
      label: "USD BCV ($)",
      perUsd: 1,
      rateLabel: "BCV",
    },
    ...rates.map((r) => ({
      code: r.code,
      currency: r.currency,
      label: r.label || r.code,
      perUsd: r.per_usd,
      rateLabel: r.code,
    })),
  ];
}

export function estimateUsdFromRateCode(
  amount: number,
  rateCode: string,
  rates: AgencyRateRow[]
): number | null {
  if (!rateCode || rateCode === USD_BCV) return amount;
  const rate = rates.find((r) => r.code === rateCode);
  if (!rate || !rate.per_usd || rate.per_usd <= 0) return null;
  return toUsd(amount, rate.per_usd);
}

// ============================================
// FORMATTING & DATES
// ============================================

export function formatUsd(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function formatOriginalAmount(amount: number, currency: string): string {
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (currency === "USD") return `$${formatted}`;
  if (currency === "VES") return `Bs ${formatted}`;
  if (currency === "EUR") return `€${formatted}`;
  return `${formatted} ${currency}`.trim();
}

export function monthKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth(): string {
  return monthKey(new Date());
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function defaultDateForMonth(month: string): string {
  const today = todayIso();
  if (today.startsWith(month)) return today;
  return `${month}-01`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

// ============================================
// AGGREGATIONS
// ============================================

export interface MonthSummary {
  income: number;
  incomePaid: number;
  incomePending: number;
  expense: number;
  expensePaid: number;
  expensePending: number;
  fixed: number;
  variable: number;
  payroll: number;
  other: number;
  net: number;
  marginPct: number | null;
}

export function summarizeMonth(transactions: AgencyTransactionRow[]): MonthSummary {
  let income = 0;
  let incomePaid = 0;
  let incomePending = 0;
  let expense = 0;
  let expensePaid = 0;
  let expensePending = 0;
  let fixed = 0;
  let variable = 0;
  let payroll = 0;
  let other = 0;

  for (const t of transactions) {
    if (t.kind === "income") {
      income += t.amount_usd;
      if (t.status === "paid") incomePaid += t.amount_usd;
      else incomePending += t.amount_usd;
    } else {
      expense += t.amount_usd;
      if (t.status === "paid") expensePaid += t.amount_usd;
      else expensePending += t.amount_usd;

      if (t.cost_type === "fixed") fixed += t.amount_usd;
      else if (t.cost_type === "variable") variable += t.amount_usd;
      else if (t.cost_type === "payroll") payroll += t.amount_usd;
      else other += t.amount_usd;
    }
  }

  const net = income - expense;
  const marginPct = income > 0 ? (net / income) * 100 : null;

  return {
    income,
    incomePaid,
    incomePending,
    expense,
    expensePaid,
    expensePending,
    fixed,
    variable,
    payroll,
    other,
    net,
    marginPct,
  };
}

export function effectivePlannedExpense(plan: AgencyMonthPlanRow | null): number {
  if (!plan) return 0;
  if (plan.planned_expense > 0) return plan.planned_expense;
  return Object.values(plan.category_budgets).reduce((sum, v) => sum + (v > 0 ? v : 0), 0);
}

export interface CategoryBreakdown {
  id: string | null;
  name: string;
  color: string;
  costType: CostType | null;
  total: number;
  share: number;
}

export function byCategory(
  transactions: AgencyTransactionRow[],
  categories: AgencyCategoryRow[],
  kind: MovementKind
): CategoryBreakdown[] {
  const index = new Map(categories.map((c) => [c.id, c]));
  const sums = new Map<string | null, number>();

  for (const t of transactions) {
    if (t.kind !== kind) continue;
    sums.set(t.category_id, (sums.get(t.category_id) ?? 0) + t.amount_usd);
  }

  const total = [...sums.values()].reduce((a, b) => a + b, 0);

  return [...sums.entries()]
    .map(([id, sum]) => {
      const cat = id ? index.get(id) : undefined;
      return {
        id,
        name: cat?.name ?? "Uncategorized",
        color: cat?.color ?? "#64748b",
        costType: cat?.default_cost_type ?? null,
        total: sum,
        share: total > 0 ? sum / total : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export interface DayTotals {
  day: number;
  income: number;
  expense: number;
}

export function byDay(transactions: AgencyTransactionRow[], month: string): DayTotals[] {
  const days = daysInMonth(month);
  const rows: DayTotals[] = Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    income: 0,
    expense: 0,
  }));

  for (const t of transactions) {
    const day = Number(t.occurred_on.slice(8, 10));
    const row = rows[day - 1];
    if (!row) continue;
    if (t.kind === "income") row.income += t.amount_usd;
    else row.expense += t.amount_usd;
  }

  return rows;
}
