import { useState } from "react";
import { AlertTriangle, Download, Check } from "lucide-react";
import { errorMessage } from "../../../lib/errors";
import type { FinanceRateRow } from "../flow";

interface MissingRatesBannerProps {
  rates: FinanceRateRow[];
  onSync: () => Promise<void>;
}

// Sin tasa cargada, NADA que esté en bolívares se puede registrar: el módulo
// queda a medias. Por eso el aviso va arriba de todo y trae el botón que lo
// resuelve en un toque, en vez de mandarlo a buscar el panel de tasas.
export default function MissingRatesBanner({
  rates,
  onSync,
}: MissingRatesBannerProps) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const missing = rates.filter((r) => r.per_usd === null);
  if (missing.length === 0 || rates.length === 0) return null;

  async function sync() {
    setSyncing(true);
    setError("");
    try {
      await onSync();
    } catch (err) {
      setError(errorMessage(err, "No pude traer las tasas"));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-4 space-y-2">
      <p className="text-sm text-amber-400 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Faltan las tasas de{" "}
          <strong>{missing.map((r) => r.label || r.code).join(", ")}</strong>.
          Hasta cargarlas no puedo convertir a dólares nada que registres en
          esas monedas.
        </span>
      </p>

      {error && <p className="text-sm text-red-400 pl-6">{error}</p>}

      <button
        onClick={sync}
        disabled={syncing}
        className="ml-6 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/20 text-amber-300 text-sm font-medium hover:bg-amber-400/30 transition-colors disabled:opacity-50"
      >
        {syncing ? (
          <>
            <Download className="w-4 h-4 animate-pulse" />
            Trayendo...
          </>
        ) : (
          <>
            <Check className="w-4 h-4" />
            Cargar las tasas de hoy
          </>
        )}
      </button>
    </div>
  );
}
