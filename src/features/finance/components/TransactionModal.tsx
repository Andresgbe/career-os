import { useMemo, useState } from "react";
import { X, Save, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { errorMessage } from "../../../lib/errors";
import { addTransaction, updateTransaction } from "../flowApi";
import { currencyOptions, money, toUsd, todayIso, USD_BCV } from "../flow";
import type {
  FinanceCategoryRow,
  FinanceRateRow,
  TransactionRow,
  TxKind,
} from "../flow";

interface TransactionModalProps {
  transaction: TransactionRow | null; // null = una nueva
  categories: FinanceCategoryRow[];
  rates: FinanceRateRow[];
  onClose: () => void;
  onSaved: (tx: TransactionRow) => void;
}

export default function TransactionModal({
  transaction,
  categories,
  rates,
  onClose,
  onSaved,
}: TransactionModalProps) {
  const options = useMemo(() => currencyOptions(rates), [rates]);

  const [kind, setKind] = useState<TxKind>(transaction?.kind ?? "expense");
  const [amount, setAmount] = useState(
    transaction ? String(transaction.amount) : ""
  );
  // Qué opción de moneda/tasa está elegida (USD, BCV, PARALELO, EUR...)
  const [option, setOption] = useState(() => {
    if (!transaction) return USD_BCV;
    // Lo guardado apunta a su forma de pago por la etiqueta; si era un
    // dólar BCV viejo (sin etiqueta y tasa 1), cae en la referencia.
    if (transaction.rate_per_usd === 1 && !transaction.rate_label) return USD_BCV;
    return transaction.rate_label || USD_BCV;
  });
  const [rateOverride, setRateOverride] = useState(
    transaction && transaction.rate_per_usd !== 1
      ? String(transaction.rate_per_usd)
      : ""
  );
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? "");
  const [place, setPlace] = useState(transaction?.place ?? "");
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [date, setDate] = useState(transaction?.occurred_on ?? todayIso());
  const [note, setNote] = useState(transaction?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selected = options.find((o) => o.code === option) ?? options[0];
  // El dólar BCV es la unidad de medida: su tasa es 1 y no se toca.
  const isReference = selected.code === USD_BCV;

  // La tasa efectiva: la que escribió a mano para este movimiento, o la
  // guardada para esa moneda.
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

  async function save() {
    setError("");
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Poné un monto mayor que cero.");
      return;
    }
    if (missingRate) {
      setError(
        `No hay tasa para ${selected.label}. Cargala abajo en "Tasas" o escribila acá.`
      );
      return;
    }

    setSaving(true);
    try {
      const fields = {
        kind,
        occurred_on: date,
        description: description.trim(),
        place: place.trim(),
        category_id: categoryId || null,
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
      setError(errorMessage(err, "Error guardando el movimiento"));
    } finally {
      setSaving(false);
    }
  }

  const input =
    "bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary w-full";

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
            {transaction ? "Editar movimiento" : "Nuevo movimiento"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-muted hover:text-foreground hover:bg-surface-hover"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          {/* Ingreso / gasto */}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["expense", "Gasto", TrendingDown, "text-red-400 border-red-400/50 bg-red-400/10"],
                ["income", "Ingreso", TrendingUp, "text-emerald-400 border-emerald-400/50 bg-emerald-400/10"],
              ] as const
            ).map(([value, label, Icon, active]) => (
              <button
                key={value}
                onClick={() => {
                  setKind(value);
                  setCategoryId("");
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

          {/* Monto y moneda */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Monto *</label>
              <input
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className={`${input} text-lg font-semibold`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Cómo se pagó</label>
              <select
                value={option}
                onChange={(e) => {
                  setOption(e.target.value);
                  // la tasa escrita a mano era para la moneda anterior
                  setRateOverride("");
                }}
                className={`${input} sm:w-44`}
              >
                {options.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tasa: va para todo lo que no sea el dólar BCV, incluido el
              efectivo y el USDT, que están en dólares pero valen más. */}
          {!isReference && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">
                Tasa — cuántos{" "}
                {selected.currency === "VES"
                  ? "Bs"
                  : selected.currency === "EUR"
                    ? "€"
                    : selected.label.replace(/\s*\(.*\)$/, "")}{" "}
                equivalen a 1 $ BCV
              </label>
              <input
                inputMode="decimal"
                value={rateOverride}
                onChange={(e) => setRateOverride(e.target.value)}
                placeholder={
                  selected.perUsd !== null
                    ? `${selected.perUsd} (la guardada)`
                    : "sin tasa guardada"
                }
                className={input}
              />
              <p className="text-xs text-muted">
                Dejalo vacío para usar la tasa guardada. Lo que pongas acá vale
                solo para este movimiento.
              </p>
            </div>
          )}

          {/* Equivalente */}
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
                Falta la tasa de {selected.label}: sin eso no puedo calcular el
                equivalente.
              </>
            ) : (
              <>
                <span className="text-muted">Equivale a</span>
                <strong
                  className={kind === "income" ? "text-emerald-400" : "text-red-400"}
                >
                  {kind === "income" ? "+" : "-"}${money(usd)}
                </strong>
                <span className="text-xs text-muted">
                  USD BCV
                  {!isReference && ` · tasa ${selected.label} ${effectiveRate}`}
                </span>
              </>
            )}
          </div>

          {/* Categoría y lugar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Categoría</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={input}
              >
                <option value="">Sin categoría</option>
                {visibleCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Lugar</label>
              <input
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="El Gama, Farmatodo..."
                className={input}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Descripción</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Compra de la semana"
                className={input}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={input}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Nota</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={`${input} resize-y`}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <footer className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-surface-hover hover:bg-border text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Save className="w-4 h-4" />
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
