import { useState } from "react";
import { Receipt, Wallet } from "lucide-react";
import BillsTab from "./tabs/BillsTab";
import IncomeTab from "./tabs/IncomeTab";

const TABS = [
  { id: "bills", label: "Bills", icon: Receipt },
  { id: "income", label: "Income", icon: Wallet },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<TabId>("bills");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Finance</h1>
        <p className="text-sm text-muted">
          Track your bills, debts, and income.
        </p>
      </div>

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
    </div>
  );
}
