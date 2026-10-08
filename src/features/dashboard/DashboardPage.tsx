import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { LayoutGrid, MessageSquare, Lock } from "lucide-react";
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
import { MODULES } from "../../lib/modules";

// Two views of the dashboard: the module board, and the assistant. The chat
// lives here rather than as its own module so it's one tap away from the
// first screen, the same way To Buy sits inside Pending.
const TABS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "modules", label: "Módulos", icon: LayoutGrid },
] as const;

type TabId = (typeof TABS)[number]["id"];

// El dashboard entero (tablero de módulos, accesos directos, pastillas y
// chat) es del administrador. Un invitado solo ve los módulos que le
// asignaron, así que ni siquiera pasa por acá.
export default function DashboardPage() {
  const { isAdmin, canView, loading } = usePermissions();

  if (loading) return null;
  if (!isAdmin) return <GuestLanding canView={canView} />;
  return <AdminDashboard />;
}

// ============================================
// INVITADO
// ============================================

function GuestLanding({ canView }: { canView: (id: string) => boolean }) {
  const allowed = MODULES.filter((m) => canView(m.id));

  // Con acceso a algo, entra directo ahí: no hay "inicio" que mostrarle.
  if (allowed.length > 0) return <Navigate to={allowed[0].path} replace />;

  return (
    <div className="max-w-md mx-auto text-center py-16 space-y-3">
      <Lock className="w-8 h-8 text-muted mx-auto" />
      <h1 className="text-lg font-semibold">Todavía no tenés acceso</h1>
      <p className="text-sm text-muted">
        Tu cuenta está creada, pero no tiene ningún módulo habilitado. Pedile a
        Andrés que te dé acceso desde el panel de administrador.
      </p>
    </div>
  );
}

// ============================================
// ADMINISTRADOR
// ============================================

function AdminDashboard() {
  // Chat is what you land on: it's the fastest way to drop something into
  // NEXUS from the phone.
  const [activeTab, setActiveTab] = useState<TabId>("chat");
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
    <div className={activeTab === "chat" ? "mx-auto w-full max-w-4xl" : ""}>
      <div className="flex gap-1 border-b border-border pb-0 mb-5 overflow-x-auto no-scrollbar">
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

      {activeTab === "chat" ? (
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
