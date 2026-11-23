import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutDashboard,
  ListFilter,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { errorMessage } from "../../lib/errors";
import { usePermissions } from "../../hooks/usePermissions";
import MovementModal from "./components/MovementModal";
import BudgetTab from "./tabs/BudgetTab";
import CustomizeTab from "./tabs/CustomizeTab";
import FixedPayrollTab from "./tabs/FixedPayrollTab";
import LedgerTab from "./tabs/LedgerTab";
import OverviewTab from "./tabs/OverviewTab";
import {
  deleteTransaction,
  ensureDefaultRates,
  getCategories,
  getFixedItems,
  getMonthPlan,
  getPayrollMembers,
  getRates,
  getTransactions,
  isMissingTableError,
  seedStarterCategories,
  syncAgencyRates,
  toggleTransactionStatus,
} from "./api";
import {
  currentMonth,
  monthLabel,
  shiftMonth,
  type AgencyCategoryRow,
  type AgencyFixedItemRow,
  type AgencyMonthPlanRow,
  type AgencyPayrollMemberRow,
  type AgencyRateRow,
  type AgencyTransactionRow,
  type MovementPrefill,
  type PaymentStatus,
} from "./types";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "ledger", label: "Ledger", icon: ListFilter },
  { id: "budget", label: "Monthly Budget", icon: CalendarRange },
  { id: "fixed", label: "Fixed & Payroll", icon: Users },
  { id: "customize", label: "Customize", icon: SlidersHorizontal },
] as const;

type TabId = (typeof TABS)[number]["id"];

const SEEDED_CATEGORIES_KEY = "agency_finance_categories_seeded";

export default function AgencyFinancePage() {
  const { canEdit: canEditModule } = usePermissions();
  const canEdit = canEditModule("agency-finance");

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [month, setMonth] = useState(currentMonth());

  const [categories, setCategories] = useState<AgencyCategoryRow[]>([]);
  const [rates, setRates] = useState<AgencyRateRow[]>([]);
  const [payrollMembers, setPayrollMembers] = useState<AgencyPayrollMemberRow[]>([]);
  const [fixedItems, setFixedItems] = useState<AgencyFixedItemRow[]>([]);
  const [transactions, setTransactions] = useState<AgencyTransactionRow[]>([]);
  const [monthPlan, setMonthPlan] = useState<AgencyMonthPlanRow | null>(null);
  const [prevMonthPlan, setPrevMonthPlan] = useState<AgencyMonthPlanRow | null>(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [monthLoading, setMonthLoading] = useState(false);
  const [missingSchema, setMissingSchema] = useState(false);
  const [error, setError] = useState("");
  const [syncingRates, setSyncingRates] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<AgencyTransactionRow | null>(null);
  const [prefill, setPrefill] = useState<MovementPrefill | null>(null);

  const seededRef = useRef(false);

  const loadStatic = useCallback(() => {
    Promise.all([getCategories(), getRates(), getPayrollMembers(), getFixedItems()])
      .then(async ([cats, rs, members, fixed]) => {
        let nextRates = rs;
        let nextCats = cats;

        if (!seededRef.current && canEdit) {
          seededRef.current = true;
          if (nextRates.length === 0) {
            nextRates = await ensureDefaultRates().catch(() => nextRates);
          }
          if (
            nextCats.length === 0 &&
            !localStorage.getItem(SEEDED_CATEGORIES_KEY)
          ) {
            nextCats = await seedStarterCategories().catch(() => nextCats);
            localStorage.setItem(SEEDED_CATEGORIES_KEY, "1");
          }
        }

        setCategories(nextCats);
        setRates(nextRates);
        setPayrollMembers(members);
        setFixedItems(fixed);
        setMissingSchema(false);
        setError("");
      })
      .catch((err) => {
        if (isMissingTableError(err)) {
          setMissingSchema(true);
        } else {
          setError(errorMessage(err, "Error loading agency finance setup"));
        }
      })
      .finally(() => setInitialLoading(false));
  }, [canEdit]);

  useEffect(() => {
    loadStatic();
  }, [loadStatic]);

  useEffect(() => {
    let cancelled = false;
    const prevMonth = shiftMonth(month, -1);

    Promise.all([
      getTransactions(month),
      getMonthPlan(month),
      getMonthPlan(prevMonth),
    ])
      .then(([txs, plan, prevPlan]) => {
        if (cancelled) return;
        setTransactions(txs);
        setMonthPlan(plan);
        setPrevMonthPlan(prevPlan);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isMissingTableError(err)) setMissingSchema(true);
        else setError(errorMessage(err, "Error loading monthly movements"));
      })
      .finally(() => {
        if (!cancelled) setMonthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [month]);

  function changeMonth(nextMonth: string) {
    setMonthLoading(true);
    setMonth(nextMonth);
  }

  function openNewMovement(nextPrefill: MovementPrefill | null = null) {
    setEditingTx(null);
    setPrefill(nextPrefill);
    setModalOpen(true);
  }

  function openEditMovement(tx: AgencyTransactionRow) {
    setEditingTx(tx);
    setPrefill(null);
    setModalOpen(true);
  }

  function handleSavedMovement(saved: AgencyTransactionRow) {
    const savedInCurrentMonth = saved.occurred_on.startsWith(month);
    setTransactions((prev) => {
      const exists = prev.some((t) => t.id === saved.id);
      if (!savedInCurrentMonth) {
        return exists ? prev.filter((t) => t.id !== saved.id) : prev;
      }
      if (exists) {
        return prev.map((t) => (t.id === saved.id ? saved : t));
      }
      return [saved, ...prev];
    });
  }

  async function handleDeleteMovement(id: string) {
    const prev = transactions;
    setTransactions((list) => list.filter((t) => t.id !== id));
    try {
      await deleteTransaction(id);
    } catch (err) {
      setTransactions(prev);
      setError(errorMessage(err, "Error deleting movement"));
    }
  }

  async function handleToggleStatus(tx: AgencyTransactionRow, next: PaymentStatus) {
    const prev = transactions;
    setTransactions((list) =>
      list.map((t) => (t.id === tx.id ? { ...t, status: next } : t))
    );
    try {
      await toggleTransactionStatus(tx.id, next);
    } catch (err) {
      setTransactions(prev);
      setError(errorMessage(err, "Error updating status"));
    }
  }

  async function handleQuickSyncRates() {
    setSyncingRates(true);
    setError("");
    try {
      setRates(await syncAgencyRates(rates));
    } catch (err) {
      setError(errorMessage(err, "Could not sync rates from DolarAPI"));
    } finally {
      setSyncingRates(false);
    }
  }

  if (initialLoading) {
    return <p className="text-sm text-muted">Loading Agency Finance...</p>;
  }

  if (missingSchema) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 max-w-2xl space-y-3">
        <div className="flex items-center gap-2 text-amber-400">
          <AlertTriangle className="w-5 h-5" />
          <h2 className="text-lg font-semibold text-foreground">
            Database setup required
          </h2>
        </div>
        <p className="text-sm text-muted">
          The Agency Finance tables are not in Supabase yet. Run{" "}
          <strong className="text-foreground">BLOQUE 35 — AGENCY FINANCE</strong>{" "}
          from <code className="text-xs bg-background px-1.5 py-0.5 rounded">PENDIENTE.sql</code>{" "}
          in your Supabase SQL Editor, then click Retry.
        </p>
        <button
          onClick={() => {
            setInitialLoading(true);
            loadStatic();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  const missingRates = rates.filter((r) => r.per_usd === null);

  return (
    <div className="space-y-6">
      {/* Header + Month switcher */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-primary" />
            Agency Finance
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Customizable fixed costs, variable expenses, payroll, income, and monthly
            budgets.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-surface border border-border rounded-lg p-1">
            <button
              onClick={() => changeMonth(shiftMonth(month, -1))}
              className="p-1.5 rounded text-muted hover:text-foreground hover:bg-surface-hover"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm font-medium min-w-[140px] text-center">
              {monthLabel(month)}
            </span>
            <button
              onClick={() => changeMonth(shiftMonth(month, 1))}
              className="p-1.5 rounded text-muted hover:text-foreground hover:bg-surface-hover"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {month !== currentMonth() && (
            <button
              onClick={() => changeMonth(currentMonth())}
              className="px-3 py-2 rounded-lg bg-surface border border-border text-xs font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              Today
            </button>
          )}

          {canEdit && (
            <button
              onClick={() => openNewMovement()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New movement
            </button>
          )}
        </div>
      </div>

      {/* Missing exchange rates banner */}
      {missingRates.length > 0 && (
        <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Rates not loaded yet:{" "}
              <strong>{missingRates.map((r) => r.code).join(", ")}</strong>. Sync with
              DolarAPI or configure them in Customize.
            </span>
          </div>
          {canEdit && (
            <button
              onClick={handleQuickSyncRates}
              disabled={syncingRates}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Download className={`w-3.5 h-3.5 ${syncingRates ? "animate-pulse" : ""}`} />
              {syncingRates ? "Syncing..." : "Sync from DolarAPI"}
            </button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border overflow-x-auto no-scrollbar">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px border-b-2 shrink-0 whitespace-nowrap ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {monthLoading ? (
        <p className="text-sm text-muted">Loading {monthLabel(month)}...</p>
      ) : (
        <>
          {activeTab === "overview" && (
            <OverviewTab
              month={month}
              transactions={transactions}
              categories={categories}
              monthPlan={monthPlan}
              canEdit={canEdit}
              onToggleStatus={handleToggleStatus}
              onGoToBudget={() => setActiveTab("budget")}
            />
          )}

          {activeTab === "ledger" && (
            <LedgerTab
              transactions={transactions}
              categories={categories}
              canEdit={canEdit}
              onEdit={openEditMovement}
              onDelete={handleDeleteMovement}
              onToggleStatus={handleToggleStatus}
            />
          )}

          {activeTab === "budget" && (
            <BudgetTab
              key={`${month}-${monthPlan?.updated_at ?? "empty"}`}
              month={month}
              transactions={transactions}
              categories={categories}
              monthPlan={monthPlan}
              prevMonthPlan={prevMonthPlan}
              canEdit={canEdit}
              onPlanSaved={setMonthPlan}
            />
          )}

          {activeTab === "fixed" && (
            <FixedPayrollTab
              month={month}
              payrollMembers={payrollMembers}
              fixedItems={fixedItems}
              transactions={transactions}
              categories={categories}
              rates={rates}
              canEdit={canEdit}
              onPayrollChange={setPayrollMembers}
              onFixedChange={setFixedItems}
              onOpenMovement={openNewMovement}
            />
          )}

          {activeTab === "customize" && (
            <CustomizeTab
              categories={categories}
              rates={rates}
              canEdit={canEdit}
              onCategoriesChange={setCategories}
              onRatesChange={setRates}
            />
          )}
        </>
      )}

      {modalOpen && (
        <MovementModal
          transaction={editingTx}
          prefill={prefill}
          activeMonth={month}
          categories={categories}
          rates={rates}
          payrollMembers={payrollMembers}
          onClose={() => {
            setModalOpen(false);
            setEditingTx(null);
            setPrefill(null);
          }}
          onSaved={handleSavedMovement}
        />
      )}
    </div>
  );
}
