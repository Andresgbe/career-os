import { useState } from "react";
import { Plus } from "lucide-react";
import ContentBoard from "./components/ContentBoard";
import CategoriesTab from "./tabs/CategoriesTab";
import DoneTab from "./tabs/DoneTab";

const TABS = [
  { id: "ideas", label: "Tablero" },
  { id: "done", label: "Publicadas" },
  { id: "categories", label: "Categorías" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState<TabId>("ideas");
  // Bumped by "Nueva idea" so the board opens its quick-add field
  const [newIdeaSignal, setNewIdeaSignal] = useState(0);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Content</h1>
          <p className="text-sm text-muted mt-1">
            De la idea al video editado. Arrastra las tarjetas entre categorías.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex gap-1 p-1 rounded-xl bg-surface border border-border">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-lg text-[13px] transition-colors ${
                  activeTab === tab.id
                    ? "bg-surface-hover text-foreground font-semibold"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {activeTab === "ideas" && (
            <button
              onClick={() => setNewIdeaSignal((n) => n + 1)}
              className="flex items-center gap-2 h-11 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nueva idea
            </button>
          )}
        </div>
      </div>

      {activeTab === "ideas" && <ContentBoard newIdeaSignal={newIdeaSignal} />}
      {activeTab === "done" && <DoneTab />}
      {activeTab === "categories" && <CategoriesTab />}
    </div>
  );
}
