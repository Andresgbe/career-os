import { useMemo, useState } from "react";
import {
  Pill,
  X,
  Plus,
  Trash2,
  History,
  ArrowLeft,
  Check,
} from "lucide-react";
import {
  getPillItems,
  addPillItem,
  deletePillItem,
  getAllPillLogs,
  markPillTaken,
  unmarkPillTaken,
} from "../api";
import {
  getVenezuelaDateString,
  type PillItemRow,
  type PillLogRow,
} from "../types";
import ConfirmDialog from "../../../components/ConfirmDialog";

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// "PASTILLAS" tab that sits inline to the left of the dashboard's module
// board (rendered by the parent in a flex row alongside <ModuleBoard />).
// Daily reset needs no server job: a day's checklist is just "does a log
// row exist for this item on today's Venezuela-calendar date" — a fresh
// date naturally starts with nothing checked.
export default function PillTrackerButton() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"today" | "history">("today");
  const [items, setItems] = useState<PillItemRow[]>([]);
  const [logs, setLogs] = useState<PillLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [adding, setAdding] = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [toDelete, setToDelete] = useState<PillItemRow | null>(null);

  const today = getVenezuelaDateString();

  const openModal = async () => {
    setOpen(true);
    setView("today");
    setLoading(true);
    setError("");
    try {
      const [itemRows, logRows] = await Promise.all([
        getPillItems(),
        getAllPillLogs(),
      ]);
      setItems(itemRows);
      setLogs(logRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading pill tracker");
    } finally {
      setLoading(false);
    }
  };

  const isChecked = (itemId: string) =>
    logs.some((l) => l.item_id === itemId && l.log_date === today);

  const toggleItem = async (item: PillItemRow) => {
    const checked = isChecked(item.id);
    setError("");
    setToggling((prev) => new Set(prev).add(item.id));
    try {
      if (checked) {
        await unmarkPillTaken(item.id, today);
        setLogs((prev) =>
          prev.filter((l) => !(l.item_id === item.id && l.log_date === today))
        );
      } else {
        const row = await markPillTaken(item.id, today);
        setLogs((prev) => [row, ...prev]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating pill");
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    setAdding(true);
    setError("");
    try {
      const row = await addPillItem(newItemName.trim());
      setItems((prev) => [...prev, row]);
      setNewItemName("");
      setShowNewItemForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error adding pill");
    } finally {
      setAdding(false);
    }
  };

  const confirmDeleteItem = async () => {
    if (!toDelete) return;
    try {
      await deletePillItem(toDelete.id);
      setItems((prev) => prev.filter((i) => i.id !== toDelete.id));
      setLogs((prev) => prev.filter((l) => l.item_id !== toDelete.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting pill");
    } finally {
      setToDelete(null);
    }
  };

  const historyGroups = useMemo(() => {
    const byDate = new Map<string, PillLogRow[]>();
    for (const log of logs) {
      if (!byDate.has(log.log_date)) byDate.set(log.log_date, []);
      byDate.get(log.log_date)!.push(log);
    }
    return Array.from(byDate.entries()).sort(([a], [b]) => (a < b ? 1 : -1));
  }, [logs]);

  return (
    <>
      <button
        onClick={openModal}
        className="flex flex-col items-center gap-2 shrink-0 w-10 py-4 bg-surface/60 border border-border rounded-xl hover:border-primary transition-colors text-muted hover:text-primary"
        title="Pill tracker"
      >
        <Pill className="w-4 h-4 shrink-0" />
        <span
          className="text-xs font-semibold tracking-wide"
          style={{ writingMode: "vertical-rl" }}
        >
          PASTILLAS
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface border border-border rounded-xl p-5 w-full max-w-md max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {view === "history" && (
                  <button
                    onClick={() => setView("today")}
                    className="p-1.5 rounded text-muted hover:bg-surface-hover"
                    aria-label="Back"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <h3 className="font-semibold">
                  {view === "today" ? "Pastillas de hoy" : "Historial"}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                {view === "today" && (
                  <button
                    onClick={() => setView("history")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-hover hover:bg-border text-xs font-medium transition-colors"
                  >
                    <History className="w-3.5 h-3.5" />
                    History
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded text-muted hover:bg-surface-hover"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="text-sm text-muted">Loading...</p>
              ) : view === "today" ? (
                <>
                  <p className="text-xs text-muted mb-3">
                    {formatDate(today)}
                  </p>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted">
                      No has agregado ninguna pastilla. Agrega una abajo.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {items.map((item) => {
                        const checked = isChecked(item.id);
                        const isToggling = toggling.has(item.id);
                        return (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-2 bg-background border border-border rounded-lg px-3 py-2"
                          >
                            <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isToggling}
                                onChange={() => toggleItem(item)}
                                className="w-4 h-4 accent-primary shrink-0"
                              />
                              <span
                                className={`truncate ${
                                  checked ? "line-through text-muted" : ""
                                }`}
                              >
                                {item.name}
                              </span>
                            </label>
                            <button
                              onClick={() => setToDelete(item)}
                              className="p-1 rounded text-muted hover:text-red-400 hover:bg-surface-hover shrink-0"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              ) : historyGroups.length === 0 ? (
                <p className="text-sm text-muted">
                  Todavía no hay historial.
                </p>
              ) : (
                <div className="space-y-4">
                  {historyGroups.map(([date, dayLogs]) => (
                    <div key={date}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                        {formatDate(date)}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((item) => {
                          const taken = dayLogs.some(
                            (l) => l.item_id === item.id
                          );
                          return (
                            <span
                              key={item.id}
                              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                                taken
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-red-500/10 text-red-400/70"
                              }`}
                            >
                              {taken ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <X className="w-3 h-3" />
                              )}
                              {item.name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {view === "today" && (
              <div className="mt-4 pt-4 border-t border-border">
                <button
                  onClick={() => setShowNewItemForm((v) => !v)}
                  className="flex items-center gap-2 px-3 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New entry
                </button>
                {showNewItemForm && (
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="text"
                      placeholder="e.g. Pastilla 1"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                      className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none flex-1"
                    />
                    <button
                      onClick={handleAddItem}
                      disabled={adding}
                      className="px-3 py-2 rounded bg-surface-hover hover:bg-border text-foreground text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
                    >
                      {adding ? "..." : "Add"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete pill?"
          message={`"${toDelete.name}" and its history will be permanently deleted.`}
          onConfirm={confirmDeleteItem}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  );
}
