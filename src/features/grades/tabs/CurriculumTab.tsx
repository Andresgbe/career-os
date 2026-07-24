import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  getCurriculumProgress,
  setSubjectStatus,
  clearSubjectStatus,
  getCurrentUC,
  setCurrentUC,
  type CurriculumStatus,
} from "../api";
import CurriculumMap from "../components/CurriculumMap";

export default function CurriculumTab() {
  const [statusMap, setStatusMap] = useState<Map<string, CurriculumStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hideSeenText, setHideSeenText] = useState(false);
  const [markMode, setMarkMode] = useState<CurriculumStatus>("seen");
  const [currentUC, setCurrentUCState] = useState<number | null>(null);
  const [ucInput, setUcInput] = useState("");
  const [savingUC, setSavingUC] = useState(false);

  useEffect(() => {
    Promise.all([getCurriculumProgress(), getCurrentUC()])
      .then(([entries, uc]) => {
        setStatusMap(new Map(entries.map((e) => [e.subject_id, e.status])));
        setCurrentUCState(uc);
        setUcInput(String(uc));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveUC = async () => {
    const parsed = Math.max(0, Math.floor(Number(ucInput)));
    if (Number.isNaN(parsed)) return;
    setSavingUC(true);
    try {
      await setCurrentUC(parsed);
      setCurrentUCState(parsed);
      setUcInput(String(parsed));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving UC");
    } finally {
      setSavingUC(false);
    }
  };

  const handleToggle = async (id: string) => {
    const prevMap = statusMap;
    const current = statusMap.get(id);
    const next = current === markMode ? undefined : markMode;

    setStatusMap((prev) => {
      const map = new Map(prev);
      if (next) map.set(id, next);
      else map.delete(id);
      return map;
    });

    try {
      if (next) await setSubjectStatus(id, next);
      else await clearSubjectStatus(id);
    } catch (err) {
      setStatusMap(prevMap);
      setError(err instanceof Error ? err.message : "Error saving progress");
    }
  };

  if (loading) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">
          Click en una materia para marcarla como{" "}
          {markMode === "seen" ? "vista" : "tentativa"}.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-muted">
            Mis UC aprobadas:
            <input
              type="number"
              min={0}
              value={ucInput}
              onChange={(e) => setUcInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveUC()}
              className="w-20 bg-background border border-border rounded px-2 py-1 text-sm text-foreground focus:border-primary outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </label>
          <button
            onClick={handleSaveUC}
            disabled={savingUC || Number(ucInput) === currentUC}
            className="px-3 py-1.5 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {savingUC ? "Guardando..." : "Guardar"}
          </button>

          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-hover p-1">
            <button
              onClick={() => setMarkMode("seen")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                markMode === "seen"
                  ? "bg-gray-500 text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Vista
            </button>
            <button
              onClick={() => setMarkMode("tentative")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                markMode === "tentative"
                  ? "bg-orange-500 text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Tentativa
            </button>
          </div>

          <button
            onClick={() => setHideSeenText((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-surface-hover hover:bg-border text-sm font-medium transition-colors shrink-0"
          >
            {hideSeenText ? (
              <>
                <Eye className="w-4 h-4" />
                Mostrar vistas
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4" />
                Ocultar vistas
              </>
            )}
          </button>
        </div>
      </div>
      <CurriculumMap
        statusMap={statusMap}
        onToggle={handleToggle}
        hideSeenText={hideSeenText}
        currentUC={currentUC ?? 0}
      />
    </div>
  );
}
