import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
  Pencil,
  Trash2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { errorMessage } from "../../../lib/errors";
import ConfirmDialog from "../../../components/ConfirmDialog";
import MonthChart from "../components/MonthChart";
import MissingRatesBanner from "../components/MissingRatesBanner";
import RatesCard from "../components/RatesCard";
import CategoryManager from "../components/CategoryManager";
import TransactionModal from "../components/TransactionModal";
import {
  getCategories,
  getRates,
  getTransactions,
  deleteTransaction,
  syncRates,
} from "../flowApi";
import {
  amountLabel,
  byCategory,
  byDay,
  currentMonth,
  dayLabel,
  money,
  monthLabel,
  rateName,
  shiftMonth,
  totals,
  wasConverted,
} from "../flow";
import type {
  FinanceCategoryRow,
  FinanceRateRow,
  TransactionRow,
} from "../flow";

// Ingresos y gastos del mes, todo llevado a dólares BCV.
export default function FlowTab() {
  const [month, setMonth] = useState(currentMonth());
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<FinanceCategoryRow[]>([]);
  const [rates, setRates] = useState<FinanceRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TransactionRow | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showList, setShowList] = useState(true);

  // Categorías y tasas se cargan una vez; las transacciones, por mes.
  useEffect(() => {
    Promise.all([getCategories(), getRates()])
      .then(([cats, rs]) => {
        setCategories(cats);
        setRates(rs);
      })
      .catch((err) => setError(errorMessage(err, "Error cargando finanzas")));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getTransactions(month)
      .then((rows) => {
        if (!cancelled) setTransactions(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, "Error cargando movimientos"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const sums = useMemo(() => totals(transactions), [transactions]);
  const days = useMemo(() => byDay(transactions, month), [transactions, month]);
  const expenseCats = useMemo(
    () => byCategory(transactions, categories, "expense"),
    [transactions, categories]
  );
  const incomeCats = useMemo(
    () => byCategory(transactions, categories, "income"),
    [transactions, categories]
  );

  // Agrupadas por día, de la más reciente a la más vieja
  const grouped = useMemo(() => {
    const map = new Map<string, TransactionRow[]>();
    for (const t of transactions) {
      const list = map.get(t.occurred_on) ?? [];
      list.push(t);
      map.set(t.occurred_on, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  const categoryName = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  async function remove(tx: TransactionRow) {
    setConfirmDelete(null);
    const previous = transactions;
    setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
    try {
      await deleteTransaction(tx.id);
    } catch (err) {
      setTransactions(previous);
      setError(errorMessage(err, "Error eliminando el movimiento"));
    }
  }

  function onSaved(tx: TransactionRow) {
    // Si lo movió a otro mes, desaparece de esta vista
    if (!tx.occurred_on.startsWith(month)) {
      setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
      return;
    }
    setTransactions((prev) => {
      const without = prev.filter((t) => t.id !== tx.id);
      return [tx, ...without].sort((a, b) =>
        b.occurred_on.localeCompare(a.occurred_on)
      );
    });
  }

  return (
    <div className="space-y-5">
      {/* Mes + acciones */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="p-2 rounded hover:bg-surface-hover text-muted transition-colors"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold min-w-[150px] text-center">
            {monthLabel(month)}
          </span>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="p-2 rounded hover:bg-surface-hover text-muted transition-colors"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {month !== currentMonth() && (
            <button
              onClick={() => setMonth(currentMonth())}
              className="px-2 py-1 rounded text-xs text-muted hover:text-primary hover:bg-surface-hover transition-colors"
            >
              Hoy
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              showSettings
                ? "bg-surface-hover text-foreground"
                : "text-muted hover:bg-surface-hover"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Tasas y categorías</span>
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Movimiento
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Si falta alguna tasa, nada de lo que esté en bolívares se puede
          convertir. Va arriba de todo porque bloquea el uso del módulo. */}
      <MissingRatesBanner
        rates={rates}
        onSync={async () => setRates(await syncRates(rates))}
      />

      {/* Tasas y categorías van acá arriba, apenas se abren: al final de la
          página quedaban debajo de la gráfica y no se encontraban. */}
      {showSettings && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <RatesCard rates={rates} onChange={setRates} />
          <CategoryManager categories={categories} onChange={setCategories} />
        </div>
      )}

      {/* Totales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard
          label="Ingresos"
          value={sums.income}
          icon={TrendingUp}
          tone="text-emerald-400"
        />
        <SummaryCard
          label="Gastos"
          value={sums.expense}
          icon={TrendingDown}
          tone="text-red-400"
        />
        <SummaryCard
          label="Balance"
          value={sums.balance}
          icon={Wallet}
          tone={sums.balance >= 0 ? "text-emerald-400" : "text-red-400"}
          signed
        />
      </div>

      <MonthChart days={days} monthLabel={monthLabel(month)} />

      {/* Por categoría */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CategoryBreakdown
          title="Gastos por categoría"
          rows={expenseCats}
          total={sums.expense}
        />
        <CategoryBreakdown
          title="Ingresos por categoría"
          rows={incomeCats}
          total={sums.income}
        />
      </div>

      {/* Movimientos */}
      <section className="bg-surface border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowList((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-border hover:bg-surface-hover/50 transition-colors"
        >
          <h3 className="text-sm font-semibold">
            Movimientos ({transactions.length})
          </h3>
          {showList ? (
            <ChevronUp className="w-4 h-4 text-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted" />
          )}
        </button>

        {!showList ? null : loading ? (
          <p className="text-sm text-muted p-5">Cargando...</p>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-muted">
              Sin movimientos en {monthLabel(month).toLowerCase()}.
            </p>
            <p className="text-xs text-muted">
              Podés cargarlos desde acá, o decirle al chat de NEXUS algo como
              <em> "gasté 5$ en el Gama en supermercado"</em>.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {grouped.map(([date, rows]) => (
              <li key={date}>
                <div className="flex items-center justify-between px-4 sm:px-5 py-2 bg-background/40 text-xs text-muted">
                  <span>{dayLabel(date)}</span>
                  <span className="tabular-nums">
                    {money(
                      rows.reduce(
                        (acc, t) =>
                          acc + (t.kind === "income" ? t.amount_usd : -t.amount_usd),
                        0
                      )
                    )}{" "}
                    $
                  </span>
                </div>
                <ul>
                  {rows.map((tx) => {
                    const cat = tx.category_id
                      ? categoryName.get(tx.category_id)
                      : undefined;
                    const income = tx.kind === "income";
                    return (
                      <li
                        key={tx.id}
                        className="group flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-surface-hover/50 transition-colors"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: cat?.color ?? "#64748b" }}
                          title={cat?.name ?? "Sin categoría"}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">
                            {tx.description ||
                              tx.place ||
                              cat?.name ||
                              "Movimiento"}
                          </p>
                          <p className="text-xs text-muted truncate">
                            {[cat?.name, tx.place].filter(Boolean).join(" · ") ||
                              "Sin categoría"}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <p
                            className={`text-sm font-semibold tabular-nums ${
                              income ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {income ? "+" : "-"}${money(tx.amount_usd)}
                          </p>
                          {/* Con qué se pagó y a qué tasa. Si fue en dólares
                              BCV el monto original es el mismo número, así
                              que solo se nombra la forma de pago. */}
                          <p className="text-xs text-muted tabular-nums">
                            {wasConverted(tx)
                              ? `${amountLabel(tx)} · ${rateName(tx)} ${tx.rate_per_usd}`
                              : rateName(tx)}
                          </p>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={() => {
                              setEditing(tx);
                              setModalOpen(true);
                            }}
                            className="p-1.5 rounded text-muted hover:text-primary hover:bg-surface-hover"
                            aria-label="Editar movimiento"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(tx)}
                            className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-surface-hover"
                            aria-label="Eliminar movimiento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modalOpen && (
        <TransactionModal
          transaction={editing}
          categories={categories}
          rates={rates}
          onClose={() => setModalOpen(false)}
          onSaved={onSaved}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Eliminar movimiento"
          message={`Se elimina "${
            confirmDelete.description || confirmDelete.place || "este movimiento"
          }" de $${money(confirmDelete.amount_usd)}.`}
          confirmLabel="Eliminar"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => remove(confirmDelete)}
        />
      )}
    </div>
  );
}

// ============================================
// PIEZAS
// ============================================

interface SummaryCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  signed?: boolean;
}

function SummaryCard({ label, value, icon: Icon, tone, signed }: SummaryCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted mb-1">
        <Icon className={`w-4 h-4 ${tone}`} />
        {label}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>
        {signed && value > 0 ? "+" : ""}
        {value < 0 ? "-" : ""}${money(Math.abs(value))}
      </p>
      <p className="text-xs text-muted mt-0.5">USD BCV</p>
    </div>
  );
}

interface CategoryBreakdownProps {
  title: string;
  rows: ReturnType<typeof byCategory>;
  total: number;
}

function CategoryBreakdown({ title, rows, total }: CategoryBreakdownProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 sm:p-5">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nada este mes.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li key={row.id ?? "none"}>
              <div className="flex items-center justify-between text-sm mb-1 gap-2">
                <span className="truncate">{row.name}</span>
                <span className="tabular-nums shrink-0">
                  ${money(row.total)}
                  <span className="text-muted text-xs ml-1.5">
                    {Math.round(row.share * 100)}%
                  </span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-background overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${total > 0 ? Math.max(2, row.share * 100) : 0}%`,
                    backgroundColor: row.color,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
