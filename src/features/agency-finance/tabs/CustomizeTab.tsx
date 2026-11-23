import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import { errorMessage } from "../../../lib/errors";
import {
  addCategory,
  addRate,
  deleteCategory,
  deleteRate,
  saveRate,
  seedStarterCategories,
  syncAgencyRates,
  updateCategory,
} from "../api";
import {
  CATEGORY_COLORS,
  COST_TYPE_LABELS,
  type AgencyCategoryRow,
  type AgencyRateRow,
  type CategoryKind,
  type CostType,
} from "../types";

interface CustomizeTabProps {
  categories: AgencyCategoryRow[];
  rates: AgencyRateRow[];
  canEdit: boolean;
  onCategoriesChange: (categories: AgencyCategoryRow[]) => void;
  onRatesChange: (rates: AgencyRateRow[]) => void;
}

const KIND_OPTIONS: Array<{ value: CategoryKind; label: string }> = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "both", label: "Both" },
];

const COST_TYPE_OPTIONS: CostType[] = ["fixed", "variable", "payroll", "other"];

export default function CustomizeTab({
  categories,
  rates,
  canEdit,
  onCategoriesChange,
  onRatesChange,
}: CustomizeTabProps) {
  // Categories state
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatKind, setNewCatKind] = useState<CategoryKind>("expense");
  const [newCatCostType, setNewCatCostType] = useState<CostType>("variable");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [draftCatName, setDraftCatName] = useState("");
  const [catToDelete, setCatToDelete] = useState<AgencyCategoryRow | null>(null);
  const [catError, setCatError] = useState("");

  // Rates state
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [draftRate, setDraftRate] = useState("");
  const [addingRate, setAddingRate] = useState(false);
  const [newRateCode, setNewRateCode] = useState("");
  const [newRateLabel, setNewRateLabel] = useState("");
  const [newRateCurrency, setNewRateCurrency] = useState("USD");
  const [newRatePerUsd, setNewRatePerUsd] = useState("");
  const [rateToDelete, setRateToDelete] = useState<AgencyRateRow | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState("");
  const [rateError, setRateError] = useState("");

  async function createCategory() {
    const name = newCatName.trim();
    setAddingCat(false);
    setNewCatName("");
    if (!name) return;
    try {
      const created = await addCategory({
        name,
        kind: newCatKind,
        default_cost_type: newCatCostType,
        color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length],
        sort_order: categories.length,
      });
      onCategoriesChange([...categories, created]);
      setCatError("");
    } catch (err) {
      setCatError(errorMessage(err, "Error creating category"));
    }
  }

  async function loadStarters() {
    setCatError("");
    try {
      const seeded = await seedStarterCategories();
      onCategoriesChange([...categories, ...seeded]);
    } catch (err) {
      setCatError(errorMessage(err, "Error loading starter categories"));
    }
  }

  async function patchCategory(
    category: AgencyCategoryRow,
    fields: Partial<
      Pick<AgencyCategoryRow, "name" | "kind" | "default_cost_type" | "color">
    >
  ) {
    const prev = categories;
    onCategoriesChange(
      categories.map((c) => (c.id === category.id ? { ...c, ...fields } : c))
    );
    try {
      await updateCategory(category.id, fields);
      setCatError("");
    } catch (err) {
      onCategoriesChange(prev);
      setCatError(errorMessage(err, "Error updating category"));
    }
  }

  async function commitCategoryRename(category: AgencyCategoryRow) {
    const name = draftCatName.trim();
    setEditingCatId(null);
    if (!name || name === category.name) return;
    await patchCategory(category, { name });
  }

  async function confirmDeleteCategory() {
    if (!catToDelete) return;
    const target = catToDelete;
    setCatToDelete(null);
    const prev = categories;
    onCategoriesChange(categories.filter((c) => c.id !== target.id));
    try {
      await deleteCategory(target.id);
    } catch (err) {
      onCategoriesChange(prev);
      setCatError(errorMessage(err, "Error deleting category"));
    }
  }

  async function syncRatesNow() {
    setSyncing(true);
    setRateError("");
    try {
      onRatesChange(await syncAgencyRates(rates));
      setSyncedAt(new Date().toLocaleTimeString("en-US"));
    } catch (err) {
      setRateError(errorMessage(err, "Could not fetch rates from DolarAPI"));
    } finally {
      setSyncing(false);
    }
  }

  async function commitRateValue(rate: AgencyRateRow) {
    const raw = draftRate.trim().replace(",", ".");
    const value = raw === "" ? null : Number(raw);
    setEditingRateId(null);
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      setRateError("Rate must be a number greater than zero.");
      return;
    }
    const prev = rates;
    onRatesChange(
      rates.map((r) =>
        r.id === rate.id
          ? { ...r, per_usd: value, updated_at: new Date().toISOString() }
          : r
      )
    );
    try {
      await saveRate(rate.id, value);
      setRateError("");
    } catch (err) {
      onRatesChange(prev);
      setRateError(errorMessage(err, "Error saving rate"));
    }
  }

  async function createRate() {
    const code = newRateCode.trim().toUpperCase();
    const label = newRateLabel.trim() || code;
    const currency = newRateCurrency.trim().toUpperCase() || "USD";
    const parsedPerUsd = newRatePerUsd.trim()
      ? Number(newRatePerUsd.trim().replace(",", "."))
      : null;

    if (!code) {
      setRateError("Enter a short rate code (e.g. ZELLE, COP, PAYPAL).");
      return;
    }
    if (parsedPerUsd !== null && (!Number.isFinite(parsedPerUsd) || parsedPerUsd <= 0)) {
      setRateError("Rate must be greater than zero.");
      return;
    }

    try {
      const created = await addRate({
        code,
        label,
        currency,
        per_usd: parsedPerUsd,
      });
      onRatesChange([...rates, created]);
      setAddingRate(false);
      setNewRateCode("");
      setNewRateLabel("");
      setNewRateCurrency("USD");
      setNewRatePerUsd("");
      setRateError("");
    } catch (err) {
      setRateError(errorMessage(err, "Error creating rate"));
    }
  }

  async function confirmDeleteRate() {
    if (!rateToDelete) return;
    const target = rateToDelete;
    setRateToDelete(null);
    const prev = rates;
    onRatesChange(rates.filter((r) => r.id !== target.id));
    try {
      await deleteRate(target.id);
    } catch (err) {
      onRatesChange(prev);
      setRateError(errorMessage(err, "Error deleting rate"));
    }
  }

  const missingRates = rates.filter((r) => r.per_usd === null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* Categories */}
      <section className="bg-surface border border-border rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Tags className="w-4 h-4 text-primary" />
            Categories ({categories.length})
          </h3>
          {canEdit && (
            <div className="flex items-center gap-2">
              {categories.length === 0 && (
                <button
                  onClick={loadStarters}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/15 text-primary-hover text-xs font-medium hover:bg-primary/25 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Load starter categories
                </button>
              )}
              <button
                onClick={() => setAddingCat(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-muted hover:text-primary hover:bg-surface-hover transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New category
              </button>
            </div>
          )}
        </div>

        {catError && <p className="text-sm text-red-400">{catError}</p>}

        {addingCat && canEdit && (
          <div className="flex flex-wrap items-center gap-2 bg-background border border-border rounded-lg p-2.5">
            <input
              autoFocus
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createCategory();
                if (e.key === "Escape") setAddingCat(false);
              }}
              placeholder="Category name"
              className="flex-1 min-w-[140px] bg-transparent text-sm outline-none px-1"
            />
            <select
              value={newCatKind}
              onChange={(e) => setNewCatKind(e.target.value as CategoryKind)}
              className="bg-surface border border-border rounded px-2 py-1 text-xs outline-none"
            >
              {KIND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={newCatCostType}
              onChange={(e) => setNewCatCostType(e.target.value as CostType)}
              className="bg-surface border border-border rounded px-2 py-1 text-xs outline-none"
            >
              {COST_TYPE_OPTIONS.map((ct) => (
                <option key={ct} value={ct}>
                  {COST_TYPE_LABELS[ct]}
                </option>
              ))}
            </select>
            <button
              onClick={createCategory}
              className="p-1 rounded text-emerald-400 hover:bg-surface-hover"
              aria-label="Create category"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => setAddingCat(false)}
              className="p-1 rounded text-muted hover:bg-surface-hover"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {categories.length === 0 ? (
          <p className="text-sm text-muted py-4">
            No categories yet. Add your own or load the starter pack.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center gap-2 py-2 text-sm flex-wrap sm:flex-nowrap"
              >
                <input
                  disabled={!canEdit}
                  type="color"
                  value={cat.color}
                  onChange={(e) => patchCategory(cat, { color: e.target.value })}
                  className="w-4 h-4 rounded shrink-0 bg-transparent border-0 cursor-pointer p-0"
                  aria-label={`Color for ${cat.name}`}
                />

                {editingCatId === cat.id ? (
                  <input
                    autoFocus
                    value={draftCatName}
                    onChange={(e) => setDraftCatName(e.target.value)}
                    onBlur={() => commitCategoryRename(cat)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitCategoryRename(cat);
                      if (e.key === "Escape") setEditingCatId(null);
                    }}
                    className="flex-1 min-w-[120px] bg-background border border-border rounded px-2 py-1 text-sm outline-none focus:border-primary"
                  />
                ) : (
                  <span className="flex-1 min-w-[120px] truncate">{cat.name}</span>
                )}

                <select
                  disabled={!canEdit}
                  value={cat.kind}
                  onChange={(e) =>
                    patchCategory(cat, { kind: e.target.value as CategoryKind })
                  }
                  className="bg-background border border-border rounded px-2 py-1 text-xs outline-none"
                  aria-label={`Kind for ${cat.name}`}
                >
                  {KIND_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <select
                  disabled={!canEdit}
                  value={cat.default_cost_type}
                  onChange={(e) =>
                    patchCategory(cat, {
                      default_cost_type: e.target.value as CostType,
                    })
                  }
                  className="bg-background border border-border rounded px-2 py-1 text-xs outline-none"
                  aria-label={`Default cost type for ${cat.name}`}
                >
                  {COST_TYPE_OPTIONS.map((ct) => (
                    <option key={ct} value={ct}>
                      {COST_TYPE_LABELS[ct]}
                    </option>
                  ))}
                </select>

                {canEdit && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => {
                        setEditingCatId(cat.id);
                        setDraftCatName(cat.name);
                      }}
                      className="p-1 rounded text-muted hover:text-primary hover:bg-surface-hover"
                      aria-label={`Rename ${cat.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setCatToDelete(cat)}
                      className="p-1 rounded text-muted hover:text-red-400 hover:bg-surface-hover"
                      aria-label={`Delete ${cat.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Exchange rates */}
      <section className="bg-surface border border-border rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              Exchange Rates & Payment Methods
            </h3>
            <p className="text-xs text-muted mt-0.5">
              1 USD BCV = rate units. Historical transactions keep their saved rate.
            </p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={syncRatesNow}
                disabled={syncing}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/15 text-primary-hover hover:bg-primary/25 text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Download className={`w-3.5 h-3.5 ${syncing ? "animate-pulse" : ""}`} />
                {syncing ? "Syncing..." : "Sync DolarAPI"}
              </button>
              <button
                onClick={() => setAddingRate(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-muted hover:text-primary hover:bg-surface-hover transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add rate
              </button>
            </div>
          )}
        </div>

        {syncedAt && (
          <p className="text-xs text-emerald-400">Synced at {syncedAt}.</p>
        )}
        {rateError && <p className="text-sm text-red-400">{rateError}</p>}

        {missingRates.length > 0 && (
          <p className="text-xs text-amber-400 bg-amber-400/10 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Missing rate values for:{" "}
            {missingRates.map((r) => r.label || r.code).join(", ")}. Sync from
            DolarAPI or enter them manually.
          </p>
        )}

        {addingRate && canEdit && (
          <div className="bg-background border border-border rounded-lg p-3 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <input
                autoFocus
                value={newRateCode}
                onChange={(e) => setNewRateCode(e.target.value)}
                placeholder="Code * (e.g. ZELLE)"
                className="bg-surface border border-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-primary"
              />
              <input
                value={newRateCurrency}
                onChange={(e) => setNewRateCurrency(e.target.value)}
                placeholder="Currency (e.g. USD)"
                className="bg-surface border border-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-primary"
              />
              <input
                value={newRateLabel}
                onChange={(e) => setNewRateLabel(e.target.value)}
                placeholder="Label (e.g. Zelle USD)"
                className="bg-surface border border-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-primary"
              />
              <input
                inputMode="decimal"
                value={newRatePerUsd}
                onChange={(e) => setNewRatePerUsd(e.target.value)}
                placeholder="Units per 1 USD BCV"
                className="bg-surface border border-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-primary"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAddingRate(false)}
                className="px-2.5 py-1 rounded bg-surface-hover text-xs"
              >
                Cancel
              </button>
              <button
                onClick={createRate}
                className="px-2.5 py-1 rounded bg-primary text-white text-xs font-medium"
              >
                Save rate
              </button>
            </div>
          </div>
        )}

        <ul className="divide-y divide-border">
          <li className="flex items-center justify-between py-2 text-sm">
            <div>
              <span className="font-medium">USD BCV ($)</span>
              <span className="text-xs text-muted ml-2">Base reference</span>
            </div>
            <span className="text-xs font-mono text-muted">1.0000</span>
          </li>

          {rates.map((rate) => {
            const isEditing = editingRateId === rate.id;
            return (
              <li
                key={rate.id}
                className="flex items-center gap-2 py-2 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{rate.label || rate.code}</p>
                  <p className="text-[11px] text-muted">
                    {rate.code} · {rate.currency}
                  </p>
                </div>

                {isEditing ? (
                  <>
                    <input
                      autoFocus
                      inputMode="decimal"
                      value={draftRate}
                      onChange={(e) => setDraftRate(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRateValue(rate);
                        if (e.key === "Escape") setEditingRateId(null);
                      }}
                      className="w-28 bg-background border border-border rounded px-2 py-1 text-sm text-right outline-none focus:border-primary"
                    />
                    <button
                      onClick={() => commitRateValue(rate)}
                      className="p-1 rounded text-emerald-400 hover:bg-surface-hover"
                      aria-label="Save rate"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingRateId(null)}
                      className="p-1 rounded text-muted hover:bg-surface-hover"
                      aria-label="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-mono text-muted">
                      {rate.per_usd !== null ? rate.per_usd.toFixed(4) : "Not set"}
                    </span>
                    {canEdit && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => {
                            setEditingRateId(rate.id);
                            setDraftRate(
                              rate.per_usd !== null ? String(rate.per_usd) : ""
                            );
                          }}
                          className="p-1 rounded text-muted hover:text-primary hover:bg-surface-hover"
                          aria-label={`Edit rate ${rate.code}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setRateToDelete(rate)}
                          className="p-1 rounded text-muted hover:text-red-400 hover:bg-surface-hover"
                          aria-label={`Delete rate ${rate.code}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {catToDelete && (
        <ConfirmDialog
          title="Delete category"
          message={`Delete "${catToDelete.name}"? Existing movements keep their amounts and become "Uncategorized".`}
          confirmLabel="Delete"
          onCancel={() => setCatToDelete(null)}
          onConfirm={confirmDeleteCategory}
        />
      )}

      {rateToDelete && (
        <ConfirmDialog
          title="Delete rate"
          message={`Delete rate "${rateToDelete.label || rateToDelete.code}"? Past movements keep their saved USD BCV amount.`}
          confirmLabel="Delete"
          onCancel={() => setRateToDelete(null)}
          onConfirm={confirmDeleteRate}
        />
      )}
    </div>
  );
}
