import { useEffect, useState } from "react";
import { BookOpen, Code2 } from "lucide-react";
import ResourcesTab from "./tabs/ResourcesTab";
import ShortcutsBar from "../../components/ShortcutsBar";
import {
  getProgrammingShortcuts,
  addProgrammingShortcut,
  deleteProgrammingShortcut,
  reorderProgrammingShortcuts,
  uploadShortcutIcon,
} from "./api";
import type { ProgrammingShortcutRow } from "./types";

const TABS = [
  { id: "resources", label: "Resources", icon: BookOpen },
  { id: "snippets", label: "Snippets", icon: Code2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ProgrammingPage() {
  const [activeTab, setActiveTab] = useState<TabId>("resources");
  const [shortcuts, setShortcuts] = useState<ProgrammingShortcutRow[]>([]);
  const [shortcutsLoading, setShortcutsLoading] = useState(true);
  const [shortcutsError, setShortcutsError] = useState("");

  useEffect(() => {
    getProgrammingShortcuts()
      .then(setShortcuts)
      .catch((e) => setShortcutsError(e.message))
      .finally(() => setShortcutsLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Programming</h1>
        <p className="text-sm text-muted">
          Manage your programming resources, useful links, and code snippets.
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

      {/* Shortcuts */}
      {shortcutsError && (
        <p className="text-sm text-red-400">{shortcutsError}</p>
      )}
      {!shortcutsLoading && (
        <ShortcutsBar
          items={shortcuts}
          size="lg"
          addShortcut={addProgrammingShortcut}
          deleteShortcut={deleteProgrammingShortcut}
          reorderShortcuts={reorderProgrammingShortcuts}
          uploadIcon={uploadShortcutIcon}
          onAdded={(item) => setShortcuts((prev) => [...prev, item])}
          onDeleted={(id) =>
            setShortcuts((prev) => prev.filter((s) => s.id !== id))
          }
          onReordered={setShortcuts}
        />
      )}

      {/* Tab content */}
      {activeTab === "resources" && <ResourcesTab />}
      {activeTab === "snippets" && (
        <div className="p-8 text-center text-muted bg-surface rounded-xl border border-border">
          <Code2 className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p>Snippets tab coming soon...</p>
        </div>
      )}
    </div>
  );
}
