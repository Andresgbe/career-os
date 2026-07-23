import { useEffect, useState } from "react";
import { ListChecks, Users, FolderKanban, Info } from "lucide-react";
import TasksTab from "./tabs/TasksTab";
import PeopleTab from "./tabs/PeopleTab";
import ProjectsTab from "./tabs/ProjectsTab";
import GeneralInfoTab from "./tabs/GeneralInfoTab";
import ShortcutsBar from "../../components/ShortcutsBar";
import {
  getWorkShortcuts,
  addWorkShortcut,
  deleteWorkShortcut,
  reorderWorkShortcuts,
  uploadShortcutIcon,
} from "./api";
import type { WorkShortcutRow } from "./types";

const TABS = [
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "people", label: "People", icon: Users },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "general", label: "General Info", icon: Info },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function WorkPage() {
  const [activeTab, setActiveTab] = useState<TabId>("tasks");
  const [shortcuts, setShortcuts] = useState<WorkShortcutRow[]>([]);
  const [shortcutsLoading, setShortcutsLoading] = useState(true);
  const [shortcutsError, setShortcutsError] = useState("");

  useEffect(() => {
    getWorkShortcuts()
      .then(setShortcuts)
      .catch((e) => setShortcutsError(e.message))
      .finally(() => setShortcutsLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border pb-0 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px border-b-2 whitespace-nowrap ${
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
          addShortcut={addWorkShortcut}
          deleteShortcut={deleteWorkShortcut}
          reorderShortcuts={reorderWorkShortcuts}
          uploadIcon={uploadShortcutIcon}
          onAdded={(item) => setShortcuts((prev) => [...prev, item])}
          onDeleted={(id) =>
            setShortcuts((prev) => prev.filter((s) => s.id !== id))
          }
          onReordered={setShortcuts}
        />
      )}

      {/* Tab content */}
      {activeTab === "tasks" && <TasksTab />}
      {activeTab === "people" && <PeopleTab />}
      {activeTab === "projects" && <ProjectsTab />}
      {activeTab === "general" && <GeneralInfoTab />}
    </div>
  );
}
