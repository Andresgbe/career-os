import { useState } from "react";
import { ListTodo, ShoppingCart } from "lucide-react";
import TodoTab from "./tabs/TodoTab";
import ToBuyBoard from "../tobuy/components/ToBuyBoard";

// Everything outstanding in one place: personal to-dos and the shopping
// list. Both are "things I still have to do", so they're two views of the
// same section instead of two separate modules.
const TABS = [
  { id: "todo", label: "Tareas", icon: ListTodo },
  { id: "tobuy", label: "To Buy", icon: ShoppingCart },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function TasksPage() {
  const [activeTab, setActiveTab] = useState<TabId>("todo");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold mb-1">Pending</h1>
        <p className="text-sm text-muted">
          {activeTab === "todo"
            ? "Tu lista personal, ordenada por prioridad. Las tareas de un proyecto viven en ese proyecto."
            : "Lo que tenés que comprar, agrupado por categoría."}
        </p>
      </div>

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

      {activeTab === "todo" ? <TodoTab /> : <ToBuyBoard />}
    </div>
  );
}
