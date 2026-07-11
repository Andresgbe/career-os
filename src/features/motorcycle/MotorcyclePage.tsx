import { useState } from "react";
import { Bike, Droplet, ShoppingCart, History } from "lucide-react";
import InfoTab from "./tabs/InfoTab";
import OilChangeTab from "./tabs/OilChangeTab";
import ToBuyTab from "./tabs/ToBuyTab";
import AuditTab from "./tabs/AuditTab";

const TABS = [
  { id: "info", label: "Info", icon: Bike },
  { id: "oil", label: "Oil Change", icon: Droplet },
  { id: "tobuy", label: "To Buy", icon: ShoppingCart },
  { id: "audit", label: "Audit Log", icon: History },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function MotorcyclePage() {
  const [activeTab, setActiveTab] = useState<TabId>("info");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Motorcycle</h1>

      {/* Sub-navigation */}
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "info" && <InfoTab />}
      {activeTab === "oil" && <OilChangeTab />}
      {activeTab === "tobuy" && <ToBuyTab />}
      {activeTab === "audit" && <AuditTab />}
    </div>
  );
}