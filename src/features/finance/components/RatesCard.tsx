import { useState } from "react";
import { Check, Pencil, RefreshCw, AlertTriangle } from "lucide-react";
import { errorMessage } from "../../../lib/errors";
import { saveRate } from "../flowApi";
import type { FinanceRateRow } from "../flow";

interface RatesCardProps {
  rates: FinanceRateRow[];
  onChange: (rates: FinanceRateRow[]) => void;
}

// Las tasas que Andrés tiene cargadas. Cada movimiento guarda la tasa que
// usó, así que cambiar una de acá NO reescribe lo ya registrado: solo
// cambia lo que se propone de ahí en adelante.
export default function RatesCard({ rates, onChange }: RatesCardProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  async function commit(rate: FinanceRateRow) {
    const raw = draft.trim().replace(",", ".");
    const value = raw === "" ? null : Number(raw);
    setEditing(null);

    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      setError("La tasa tiene que ser un número mayor que cero.");
      return;
    }

    const previous = rates;
    onChange(
      rates.map((r) =>
        r.id === rate.id
          ? { ...r, per_usd: value, updated_at: new Date().toISOString() }
          : r
      )
    );
    try {
      await saveRate(rate.id, value);
      setError("");
    } catch (err) {
      onChange(previous);
      setError(errorMessage(err, "Error guardando la tasa"));
    }
  }

  const pending = rates.filter((r) => r.per_usd === null);

  return (
    <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <RefreshCw className="w-4 h-4 text-primary" />
        Tasas
      </h3>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {pending.length > 0 && (
        <p className="text-xs text-amber-400 bg-amber-400/10 rounded px-2.5 py-2 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Falta cargar {pending.map((r) => r.label || r.code).join(", ")}. Sin
          eso no puedo convertir lo que gastes en esa moneda.
        </p>
      )}

      <ul className="space-y-1.5">
        {rates.map((rate) => {
          const isEditing = editing === rate.id;
          return (
            <li
              key={rate.id}
              className="flex items-center gap-2 text-sm py-1.5 border-b border-border last:border-0"
            >
              <span className="flex-1 min-w-0 truncate">
                {rate.label || rate.code}
              </span>

              {isEditing ? (
                <>
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commit(rate);
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="w-28 bg-background border border-border rounded px-2 py-1 text-sm text-right outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => commit(rate)}
                    className="p-1 rounded text-emerald-400 hover:bg-surface-hover"
                    aria-label="Guardar tasa"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <span
                    className={
                      rate.per_usd === null
                        ? "text-amber-400 text-xs"
                        : "font-medium tabular-nums"
                    }
                  >
                    {rate.per_usd === null
                      ? "sin cargar"
                      : `${rate.per_usd.toLocaleString("es-VE")} / $`}
                  </span>
                  <button
                    onClick={() => {
                      setEditing(rate.id);
                      setDraft(rate.per_usd === null ? "" : String(rate.per_usd));
                    }}
                    className="p-1 rounded text-muted hover:text-primary hover:bg-surface-hover"
                    aria-label={`Editar ${rate.label || rate.code}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-muted leading-relaxed">
        Cuántas unidades de esa moneda equivalen a <strong>1 dólar BCV</strong>.
        Cambiarla no toca lo ya registrado: cada movimiento se guarda con la
        tasa que usaste ese día.
      </p>
    </div>
  );
}
