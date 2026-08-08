import { useState } from "react";
import { Receipt, Wallet, CalendarRange, Lock } from "lucide-react";
import BillsTab from "./tabs/BillsTab";
import IncomeTab from "./tabs/IncomeTab";
import MonthlyBudgetTab from "./tabs/MonthlyBudgetTab";
import FinancePinGate, {
  FINANCE_SESSION_KEY,
} from "./FinancePinGate";

const TABS = [
  { id: "bills", label: "Bills", icon: Receipt },
  { id: "income", label: "Income", icon: Wallet },
  { id: "budget", label: "Monthly Budget", icon: CalendarRange },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<TabId>("bills");
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(FINANCE_SESSION_KEY) === "true"
  );

  const handleLock = () => {
    sessionStorage.removeItem(FINANCE_SESSION_KEY);
    setUnlocked(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Finance</h1>
          <p className="text-sm text-muted">
            Track your bills, debts, income, and monthly budget.
          </p>
        </div>
        {unlocked && (
          <button
            onClick={handleLock}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <Lock className="w-4 h-4" />
            Lock
          </button>
        )}
      </div>

      {!unlocked ? (
        <FinancePinGate onUnlock={() => setUnlocked(true)} />
      ) : (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-border pb-0">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px border-b-2 ${
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

          {/* Tab content */}
          {activeTab === "bills" && <BillsTab />}
          {activeTab === "income" && <IncomeTab />}
          {activeTab === "budget" && <MonthlyBudgetTab />}
        </>
      )}
    </div>
  );
}
