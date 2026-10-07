import { useEffect, useState } from "react";
import { LayoutGrid, MessageSquare } from "lucide-react";
import {
  getShortcuts,
  addShortcut,
  deleteShortcut,
  reorderShortcuts,
  uploadShortcutIcon,
} from "./api";
import type { ShortcutRow } from "./types";
import ShortcutsBar from "../../components/ShortcutsBar";
import PillTrackerButton from "./components/PillTrackerButton";
import ModuleBoard from "./components/ModuleBoard";
import ChatPanel from "../chat/ChatPanel";
import { usePermissions } from "../../hooks/usePermissions";

// Two views of the dashboard: the module board, and the assistant. The chat
// lives here rather than as its own module so it's one tap away from the
// first screen, the same way To Buy sits inside Pending.
const TABS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "modules", label: "Módulos", icon: LayoutGrid },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DashboardPage() {
  const { isAdmin } = usePermissions();
  // El chat corre con la cuenta de Claude de Andrés a través del worker de
  // su PC, así que solo existe para él. Un invitado escribiría mensajes que
  // nadie va a procesar.
  const tabs = isAdmin ? TABS : TABS.filter((t) => t.id !== "chat");
  // Chat is what you land on: it's the fastest way to drop something into
  // NEXUS from the phone.
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const currentTab = tabs.some((t) => t.id === activeTab)
    ? activeTab
    : tabs[0].id;
  const [shortcuts, setShortcuts] = useState<ShortcutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getShortcuts()
      .then(setShortcuts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    // El chat se lee mejor en una columna más angosta y centrada; el
    // tablero de módulos usa todo el ancho que haya.
    <div className={currentTab === "chat" ? "mx-auto w-full max-w-4xl" : ""}>
      <div className="flex gap-1 border-b border-border pb-0 mb-5 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
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

      {currentTab === "chat" ? (
        <ChatPanel />
      ) : (
        <>
          {/* Shortcuts */}
          <div className="mb-8">
            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
            {!loading && (
              <ShortcutsBar
                items={shortcuts}
                addShortcut={addShortcut}
                deleteShortcut={deleteShortcut}
                reorderShortcuts={reorderShortcuts}
                uploadIcon={uploadShortcutIcon}
                onAdded={(item) => setShortcuts((prev) => [...prev, item])}
                onDeleted={(id) =>
                  setShortcuts((prev) => prev.filter((s) => s.id !== id))
                }
                onReordered={setShortcuts}
                storageKey="dashboard"
              />
            )}
          </div>

          <div className="flex items-start gap-3">
            <PillTrackerButton />
            <div className="flex-1 min-w-0">
              <ModuleBoard />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
