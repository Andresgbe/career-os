import { useState } from "react";
import { Lightbulb, Tags, CheckCircle2 } from "lucide-react";
import IdeasTab from "./tabs/IdeasTab";
import CategoriesTab from "./tabs/CategoriesTab";
import DoneTab from "./tabs/DoneTab";

const TABS = [
  { id: "ideas", label: "Ideas", icon: Lightbulb },
  { id: "done", label: "Done", icon: CheckCircle2 },
  { id: "categories", label: "Categories", icon: Tags },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState<TabId>("ideas");

  return (
    <div className="space-y-6">

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
      {activeTab === "ideas" && <IdeasTab />}
      {activeTab === "done" && <DoneTab />}
      {activeTab === "categories" && <CategoriesTab />}
    </div>
  );
}
