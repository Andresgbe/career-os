import { supabase } from "../../lib/supabase";
import { toUsd } from "./flow";
import { fetchRates, RATE_CODE_MAP } from "./dolarApi";
import type {
  FinanceCategoryRow,
  FinanceRateRow,
  TransactionFields,
  TransactionRow,
} from "./flow";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

// ============================================
// CATEGORÍAS
// ============================================

export async function getCategories(): Promise<FinanceCategoryRow[]> {
  const { data, error } = await supabase
    .from("finance_categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addCategory(fields: {
  name: string;
  kind: FinanceCategoryRow["kind"];
  color: string;
  sort_order: number;
}): Promise<FinanceCategoryRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("finance_categories")
    .insert({ user_id: user.id, ...fields })
    .select("*")
    .single();
  if (error) throw error;
  return data as FinanceCategoryRow;
}

export async function updateCategory(
  id: string,
  fields: Partial<Pick<FinanceCategoryRow, "name" | "kind" | "color" | "sort_order">>
): Promise<void> {
  const { error } = await supabase
    .from("finance_categories")
    .update(fields)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from("finance_categories").delete().eq("id", id);
  if (error) throw error;
}

// ============================================
// TASAS
// ============================================

export async function getRates(): Promise<FinanceRateRow[]> {
  const { data, error } = await supabase
    .from("finance_rates")
    .select("*")
    .order("code", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function saveRate(
  id: string,
  perUsd: number | null
): Promise<void> {
  const { error } = await supabase
    .from("finance_rates")
    .update({ per_usd: perUsd, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function addRate(fields: {
  code: string;
  label: string;
  currency: string;
  per_usd: number | null;
}): Promise<FinanceRateRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("finance_rates")
    .insert({ user_id: user.id, ...fields })
    .select("*")
    .single();
  if (error) throw error;
  return data as FinanceRateRow;
}

export async function deleteRate(id: string): Promise<void> {
  const { error } = await supabase.from("finance_rates").delete().eq("id", id);
  if (error) throw error;
}

// ============================================
// TRANSACCIONES
// ============================================

// Un mes completo, de día 1 al último. El filtro va por fecha y no por
// texto para que use el índice.
export async function getTransactions(month: string): Promise<TransactionRow[]> {
  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const to = `${new Date(y, m, 0).getFullYear()}-${String(m).padStart(2, "0")}-${String(
    new Date(y, m, 0).getDate()
  ).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("finance_transactions")
    .select("*")
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalize);
}

// Supabase devuelve numeric como string para no perder precisión
function normalize(row: Record<string, unknown>): TransactionRow {
  return {
    ...(row as unknown as TransactionRow),
    amount: Number(row.amount),
    rate_per_usd: Number(row.rate_per_usd),
    amount_usd: Number(row.amount_usd),
  };
}

export async function addTransaction(
  fields: TransactionFields
): Promise<TransactionRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("finance_transactions")
    .insert({
      user_id: user.id,
      ...fields,
      // se guarda calculado: la tasa de hoy no debe mover lo de ayer
      amount_usd: toUsd(fields.amount, fields.rate_per_usd),
    })
    .select("*")
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function updateTransaction(
  id: string,
  fields: TransactionFields
): Promise<TransactionRow> {
  const { data, error } = await supabase
    .from("finance_transactions")
    .update({
      ...fields,
      amount_usd: toUsd(fields.amount, fields.rate_per_usd),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from("finance_transactions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// SINCRONIZAR TASAS
// ============================================

// Trae las tasas del día de DolarAPI y guarda las que tengan código
// conocido (BCV, PARALELO, EUR). Las que Andrés haya agregado a mano se
// quedan como están: no hay de dónde sacarlas.
//
// Vive acá y no en el componente porque la usan dos lugares: el panel de
// tasas y el aviso de "faltan tasas" que sale arriba.
export async function syncRates(
  rates: FinanceRateRow[]
): Promise<FinanceRateRow[]> {
  const fetched = await fetchRates();

  const updates = rates
    .map((rate) => {
      const key = RATE_CODE_MAP[rate.code.toUpperCase()];
      const value = key ? (fetched[key] as number | null) : null;
      return value && value > 0 ? { rate, value } : null;
    })
    .filter((x): x is { rate: FinanceRateRow; value: number } => x !== null);

  if (updates.length === 0) {
    throw new Error("DolarAPI respondió, pero sin tasas que pueda usar.");
  }

  await Promise.all(updates.map(({ rate, value }) => saveRate(rate.id, value)));

  const now = new Date().toISOString();
  const byId = new Map(updates.map(({ rate, value }) => [rate.id, value]));
  return rates.map((r) =>
    byId.has(r.id) ? { ...r, per_usd: byId.get(r.id)!, updated_at: now } : r
  );
}
