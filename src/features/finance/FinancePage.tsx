import { useState } from "react";
import { Receipt, Wallet, CalendarRange } from "lucide-react";
import BillsTab from "./tabs/BillsTab";
import IncomeTab from "./tabs/IncomeTab";
import MonthlyBudgetTab from "./tabs/MonthlyBudgetTab";

const TABS = [
  { id: "bills", label: "Bills", icon: Receipt },
  { id: "income", label: "Income", icon: Wallet },
  { id: "budget", label: "Monthly Budget", icon: CalendarRange },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Este módulo tenía un PIN propio antes de que existiera el panel de
// administrador. Ahora quien ve Finance se decide con los permisos (y RLS),
// así que el PIN sobraba: era una pantalla más, no una barrera real.
export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<TabId>("bills");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Finance</h1>
        <p className="text-sm text-muted">
          Track your bills, debts, income, and monthly budget.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border pb-0 overflow-x-auto no-scrollbar">
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

      {/* Tab content */}
      {activeTab === "bills" && <BillsTab />}
      {activeTab === "income" && <IncomeTab />}
      {activeTab === "budget" && <MonthlyBudgetTab />}
    </div>
  );
}
