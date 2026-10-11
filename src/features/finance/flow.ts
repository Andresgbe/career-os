// "Ingresos y gastos": el registro de movimientos del módulo Finance.
//
// Vive aparte de types.ts para no mezclarse con Bills y Monthly Budget,
// que son otra cosa y siguen igual.
//
// REGLA DE CONVERSIÓN, una sola para todas las monedas:
//
//   rate_per_usd = cuántas unidades de esa moneda equivalen a 1 USD BCV
//   amount_usd   = amount / rate_per_usd
//
//   · 5 USD                      → rate 1      → 5,00 $
//   · 500 Bs con el BCV en 36,50 → rate 36.50  → 13,70 $
//   · 10 € con el euro en 0,925  → rate 0.925  → 10,81 $
//
// El equivalente en dólares se GUARDA junto a la transacción, no se
// recalcula al leer: un gasto de hace tres meses no puede cambiar de valor
// porque hoy se movió la tasa.

export type TxKind = "income" | "expense";
export type CategoryKind = TxKind | "both";

export interface FinanceCategoryRow {
  id: string;
  user_id: string;
  name: string;
  kind: CategoryKind;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface FinanceRateRow {
  id: string;
  user_id: string;
  code: string; // BCV, PARALELO, EUR...
  label: string;
  currency: string; // VES, EUR...
  per_usd: number | null; // null = todavía sin cargar
  updated_at: string;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  kind: TxKind;
  occurred_on: string; // yyyy-mm-dd
  description: string;
  place: string;
  category_id: string | null;
  amount: number;
  currency: string;
  rate_per_usd: number;
  rate_label: string; // "BCV", "Paralelo", "" si fue en dólares
  amount_usd: number;
  note: string;
  created_at: string;
}

export interface TransactionFields {
  kind: TxKind;
  occurred_on: string;
  description: string;
  place: string;
  category_id: string | null;
  amount: number;
  currency: string;
  rate_per_usd: number;
  rate_label: string;
  note: string;
}

// ============================================
// CONVERSIÓN
// ============================================

export function toUsd(amount: number, ratePerUsd: number): number {
  if (!Number.isFinite(ratePerUsd) || ratePerUsd <= 0) return 0;
  return amount / ratePerUsd;
}

// La referencia contra la que se mide todo. Su tasa es 1 por definición y no
// se edita: es la unidad.
export const USD_BCV = "USD_BCV";

// Con qué se pagó. No es solo la moneda: 50 $ en efectivo o en USDT valen
// MÁS que 50 $ BCV, porque se cambian a una tasa mejor. Por eso cada forma
// de pago tiene su propia tasa, incluso las que están en dólares.
//
//   per_usd = cuántas unidades de ESA forma de pago equivalen a 1 USD BCV
//
//   · Bolívares, BCV en 873,87      → 873.87   (500 Bs = $0,57)
//   · Dólar efectivo, paralelo 1007 → 0.8672   (50 $ cash = $57,66)
//   · USDT, igual                   → 0.8672
//   · Euro a 0,888 € por dólar      → 0.8878   (10 € = $11,26)
//
// Menos de 1 significa "vale más que el dólar BCV". Más de 1, menos.
export interface CurrencyOption {
  code: string; // USD_BCV, o el code de la tasa guardada
  currency: string; // la moneda real (USD, VES, EUR)
  label: string;
  perUsd: number | null;
  rateLabel: string; // lo que queda registrado en el movimiento
}

export function currencyOptions(rates: FinanceRateRow[]): CurrencyOption[] {
  return [
    {
      code: USD_BCV,
      currency: "USD",
      label: "Dólar BCV ($)",
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

// Cómo se llama la forma de pago de un movimiento ya guardado
export function rateName(tx: TransactionRow): string {
  return tx.rate_label || "BCV";
}

// ¿Hubo conversión de verdad? Con tasa 1 el monto original y el equivalente
// son el mismo número y no vale la pena repetirlo en pantalla.
export function wasConverted(tx: TransactionRow): boolean {
  return tx.rate_per_usd !== 1;
}

// ============================================
// FORMATO
// ============================================

export function money(usd: number): string {
  return usd.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function amountLabel(tx: TransactionRow): string {
  const n = tx.amount.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (tx.currency === "USD") return `${n}`;
  if (tx.currency === "VES") return `Bs ${n}`;
  if (tx.currency === "EUR") return `€${n}`;
  return `${n} ${tx.currency}`;
}

// ============================================
// MESES
// ============================================

export function monthKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth(): string {
  return monthKey(new Date());
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const name = new Date(y, m - 1, 1).toLocaleDateString("es-VE", {
    month: "long",
    year: "numeric",
  });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const label = d.toLocaleDateString("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// ============================================
// TOTALES
// ============================================

export interface MonthTotals {
  income: number;
  expense: number;
  balance: number;
}

export function totals(transactions: TransactionRow[]): MonthTotals {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.kind === "income") income += t.amount_usd;
    else expense += t.amount_usd;
  }
  return { income, expense, balance: income - expense };
}

export interface CategoryTotal {
  id: string | null;
  name: string;
  color: string;
  total: number;
  share: number; // 0..1 sobre el total del tipo
}

export function byCategory(
  transactions: TransactionRow[],
  categories: FinanceCategoryRow[],
  kind: TxKind
): CategoryTotal[] {
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
        name: cat?.name ?? "Sin categoría",
        color: cat?.color ?? "#64748b",
        total: sum,
        share: total > 0 ? sum / total : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

// Totales por día del mes, para la gráfica
export interface DayTotals {
  day: number;
  income: number;
  expense: number;
}

export function byDay(
  transactions: TransactionRow[],
  month: string
): DayTotals[] {
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
