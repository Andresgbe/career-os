import { supabase } from "../../lib/supabase";
import { fetchRates, RATE_CODE_MAP } from "../finance/dolarApi";
import {
  STARTER_CATEGORIES,
  STARTER_RATES,
  toUsd,
  type AgencyCategoryRow,
  type AgencyFixedItemRow,
  type AgencyMonthPlanRow,
  type AgencyPayrollMemberRow,
  type AgencyRateRow,
  type AgencyTransactionFields,
  type AgencyTransactionRow,
  type PaymentStatus,
} from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const record = err as { code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message : "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("Could not find the table")
  );
}

function normalizeRate(row: Record<string, unknown>): AgencyRateRow {
  return {
    ...(row as unknown as AgencyRateRow),
    per_usd: row.per_usd == null ? null : Number(row.per_usd),
  };
}

function normalizePayroll(row: Record<string, unknown>): AgencyPayrollMemberRow {
  return {
    ...(row as unknown as AgencyPayrollMemberRow),
    default_amount: Number(row.default_amount ?? 0),
    pay_day: row.pay_day == null ? null : Number(row.pay_day),
  };
}

function normalizeFixedItem(row: Record<string, unknown>): AgencyFixedItemRow {
  return {
    ...(row as unknown as AgencyFixedItemRow),
    default_amount: Number(row.default_amount ?? 0),
    due_day: row.due_day == null ? null : Number(row.due_day),
  };
}

function normalizeTransaction(row: Record<string, unknown>): AgencyTransactionRow {
  return {
    ...(row as unknown as AgencyTransactionRow),
    amount: Number(row.amount ?? 0),
    rate_per_usd: Number(row.rate_per_usd ?? 1),
    amount_usd: Number(row.amount_usd ?? 0),
  };
}

function normalizeMonthPlan(row: Record<string, unknown>): AgencyMonthPlanRow {
  const rawBudgets = row.category_budgets;
  const category_budgets: Record<string, number> = {};
  if (rawBudgets && typeof rawBudgets === "object" && !Array.isArray(rawBudgets)) {
    for (const [k, v] of Object.entries(rawBudgets as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) category_budgets[k] = n;
    }
  }
  return {
    ...(row as unknown as AgencyMonthPlanRow),
    planned_income: Number(row.planned_income ?? 0),
    planned_expense: Number(row.planned_expense ?? 0),
    category_budgets,
  };
}

// ============================================
// CATEGORIES
// ============================================

export async function getCategories(): Promise<AgencyCategoryRow[]> {
  const { data, error } = await supabase
    .from("agency_finance_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AgencyCategoryRow[];
}

export async function addCategory(fields: {
  name: string;
  kind: AgencyCategoryRow["kind"];
  default_cost_type: AgencyCategoryRow["default_cost_type"];
  color: string;
  sort_order: number;
}): Promise<AgencyCategoryRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("agency_finance_categories")
    .insert({ user_id: user.id, ...fields })
    .select("*")
    .single();
  if (error) throw error;
  return data as AgencyCategoryRow;
}

export async function updateCategory(
  id: string,
  fields: Partial<
    Pick<AgencyCategoryRow, "name" | "kind" | "default_cost_type" | "color" | "sort_order">
  >
): Promise<void> {
  const { error } = await supabase
    .from("agency_finance_categories")
    .update(fields)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from("agency_finance_categories")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function seedStarterCategories(): Promise<AgencyCategoryRow[]> {
  const user = await requireUser();
  const rows = STARTER_CATEGORIES.map((c, i) => ({
    user_id: user.id,
    ...c,
    sort_order: i,
  }));
  const { data, error } = await supabase
    .from("agency_finance_categories")
    .insert(rows)
    .select("*");
  if (error) throw error;
  return (data ?? []) as AgencyCategoryRow[];
}

// ============================================
// EXCHANGE RATES
// ============================================

export async function getRates(): Promise<AgencyRateRow[]> {
  const { data, error } = await supabase
    .from("agency_finance_rates")
    .select("*")
    .order("code", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeRate);
}

export async function ensureDefaultRates(): Promise<AgencyRateRow[]> {
  const user = await requireUser();
  const rows = STARTER_RATES.map((r) => ({ user_id: user.id, ...r }));
  const { error } = await supabase
    .from("agency_finance_rates")
    .upsert(rows, { onConflict: "user_id,code", ignoreDuplicates: true });
  if (error) throw error;
  return getRates();
}

export async function addRate(fields: {
  code: string;
  label: string;
  currency: string;
  per_usd: number | null;
}): Promise<AgencyRateRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("agency_finance_rates")
    .insert({ user_id: user.id, ...fields })
    .select("*")
    .single();
  if (error) throw error;
  return normalizeRate(data);
}

export async function saveRate(id: string, perUsd: number | null): Promise<void> {
  const { error } = await supabase
    .from("agency_finance_rates")
    .update({ per_usd: perUsd, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteRate(id: string): Promise<void> {
  const { error } = await supabase
    .from("agency_finance_rates")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function syncAgencyRates(rates: AgencyRateRow[]): Promise<AgencyRateRow[]> {
  const fetched = await fetchRates();

  const updates = rates
    .map((rate) => {
      const key = RATE_CODE_MAP[rate.code.toUpperCase()];
      const value = key ? (fetched[key] as number | null) : null;
      return value && value > 0 ? { rate, value } : null;
    })
    .filter((x): x is { rate: AgencyRateRow; value: number } => x !== null);

  if (updates.length === 0) {
    throw new Error("DolarAPI responded, but no matching rates were available.");
  }

  await Promise.all(updates.map(({ rate, value }) => saveRate(rate.id, value)));

  const now = new Date().toISOString();
  const byId = new Map(updates.map(({ rate, value }) => [rate.id, value]));
  return rates.map((r) =>
    byId.has(r.id) ? { ...r, per_usd: byId.get(r.id)!, updated_at: now } : r
  );
}

// ============================================
// PAYROLL MEMBERS
// ============================================

export async function getPayrollMembers(): Promise<AgencyPayrollMemberRow[]> {
  const { data, error } = await supabase
    .from("agency_finance_payroll_members")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizePayroll);
}

export async function addPayrollMember(fields: {
  name: string;
  role: string;
  pay_type: AgencyPayrollMemberRow["pay_type"];
  default_amount: number;
  default_rate_code: string;
  pay_day: number | null;
  active: boolean;
  notes: string;
  sort_order: number;
}): Promise<AgencyPayrollMemberRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("agency_finance_payroll_members")
    .insert({ user_id: user.id, ...fields })
    .select("*")
    .single();
  if (error) throw error;
  return normalizePayroll(data);
}

export async function updatePayrollMember(
  id: string,
  fields: Partial<
    Pick<
      AgencyPayrollMemberRow,
      | "name"
      | "role"
      | "pay_type"
      | "default_amount"
      | "default_rate_code"
      | "pay_day"
      | "active"
      | "notes"
      | "sort_order"
    >
  >
): Promise<void> {
  const { error } = await supabase
    .from("agency_finance_payroll_members")
    .update(fields)
    .eq("id", id);
  if (error) throw error;
}

export async function deletePayrollMember(id: string): Promise<void> {
  const { error } = await supabase
    .from("agency_finance_payroll_members")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// FIXED COSTS
// ============================================

export async function getFixedItems(): Promise<AgencyFixedItemRow[]> {
  const { data, error } = await supabase
    .from("agency_finance_fixed_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeFixedItem);
}

export async function addFixedItem(fields: {
  name: string;
  vendor: string;
  category_id: string | null;
  default_amount: number;
  default_rate_code: string;
  due_day: number | null;
  active: boolean;
  notes: string;
  sort_order: number;
}): Promise<AgencyFixedItemRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("agency_finance_fixed_items")
    .insert({ user_id: user.id, ...fields })
    .select("*")
    .single();
  if (error) throw error;
  return normalizeFixedItem(data);
}

export async function updateFixedItem(
  id: string,
  fields: Partial<
    Pick<
      AgencyFixedItemRow,
      | "name"
      | "vendor"
      | "category_id"
      | "default_amount"
      | "default_rate_code"
      | "due_day"
      | "active"
      | "notes"
      | "sort_order"
    >
  >
): Promise<void> {
  const { error } = await supabase
    .from("agency_finance_fixed_items")
    .update(fields)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteFixedItem(id: string): Promise<void> {
  const { error } = await supabase
    .from("agency_finance_fixed_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// TRANSACTIONS
// ============================================

export async function getTransactions(month: string): Promise<AgencyTransactionRow[]> {
  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("agency_finance_transactions")
    .select("*")
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeTransaction);
}

export async function addTransaction(
  fields: AgencyTransactionFields
): Promise<AgencyTransactionRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("agency_finance_transactions")
    .insert({
      user_id: user.id,
      ...fields,
      amount_usd: toUsd(fields.amount, fields.rate_per_usd),
    })
    .select("*")
    .single();
  if (error) throw error;
  return normalizeTransaction(data);
}

export async function updateTransaction(
  id: string,
  fields: AgencyTransactionFields
): Promise<AgencyTransactionRow> {
  const { data, error } = await supabase
    .from("agency_finance_transactions")
    .update({
      ...fields,
      amount_usd: toUsd(fields.amount, fields.rate_per_usd),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeTransaction(data);
}

export async function toggleTransactionStatus(
  id: string,
  status: PaymentStatus
): Promise<void> {
  const { error } = await supabase
    .from("agency_finance_transactions")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from("agency_finance_transactions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// MONTHLY PLANS
// ============================================

export async function getMonthPlan(month: string): Promise<AgencyMonthPlanRow | null> {
  const { data, error } = await supabase
    .from("agency_finance_month_plans")
    .select("*")
    .eq("month", month)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeMonthPlan(data) : null;
}

export async function saveMonthPlan(
  month: string,
  fields: {
    planned_income: number;
    planned_expense: number;
    category_budgets: Record<string, number>;
    notes: string;
  }
): Promise<AgencyMonthPlanRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("agency_finance_month_plans")
    .upsert(
      {
        user_id: user.id,
        month,
        ...fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,month" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return normalizeMonthPlan(data);
}
