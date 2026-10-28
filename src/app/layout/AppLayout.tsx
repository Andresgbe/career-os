import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, Search } from "lucide-react";
import { APP_NAME } from "../../lib/constants";
import { useAuth } from "../../hooks/useAuth";
import { usePermissions } from "../../hooks/usePermissions";
import { supabase } from "../../lib/supabase";
import SectionContextButton from "../../components/SectionContextButton";
import ModuleNavGroups from "./ModuleNavGroups";
import CommandPalette from "./CommandPalette";
import { getWorkerLastSeen } from "../../features/chat/api";
import { BoardProvider } from "../../features/dashboard/BoardContext";

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const [paletteOpen, setPaletteOpen] = useState(false);
  // null = unknown (never checked, or no heartbeat table yet)
  const [workerOnline, setWorkerOnline] = useState<boolean | null>(null);

  // Ctrl/Cmd + K opens the module search from anywhere
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Whether the chat worker on Andrés's PC is listening. The worker writes a
  // heartbeat every few seconds, so a minute-old one means it's off.
  useEffect(() => {
    if (!isAdmin) return;
    const check = () =>
      getWorkerLastSeen()
        .then((ms) => setWorkerOnline(ms === null ? null : ms < 60000))
        .catch(() => {});
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, [isAdmin]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <BoardProvider>
      <div className="min-h-screen bg-background text-foreground">
      {/* Topbar */}
      <header className="sticky top-0 z-30 flex items-center gap-2 sm:gap-4 border-b border-border bg-surface/85 backdrop-blur px-3 sm:px-6 h-[60px]">
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg hover:bg-surface-hover transition-colors shrink-0 lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <span className="w-[30px] h-[30px] rounded-[9px] bg-primary text-white flex items-center justify-center font-bold text-[15px]">
            {APP_NAME.charAt(0)}
          </span>
          <span className="font-bold text-base tracking-[0.04em]">{APP_NAME}</span>
        </Link>

        {/* Horizontal tabs, grouped like the dashboard's module board.
            Scrolls sideways instead of wrapping — the header is a fixed
            height, so a wrapped second row would be clipped. */}
        <nav className="hidden sm:flex items-center gap-0.5 p-1 ml-1 rounded-xl bg-surface border border-border min-w-0 overflow-x-auto no-scrollbar">
          {isAdmin && (
            <Link
              to="/"
              className={`px-3.5 py-1.5 rounded-lg text-sm transition-colors shrink-0 ${
                location.pathname === "/"
                  ? "bg-surface-hover text-foreground font-medium"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Dashboard
            </Link>
          )}
          <ModuleNavGroups variant="topbar" />
        </nav>

          {/* Spacer */}
          <div className="flex-1" />

          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden md:flex items-center gap-2.5 h-[38px] px-3 min-w-[220px] rounded-[10px] border border-border bg-surface text-[13px] text-muted hover:text-foreground hover:border-[#3a3a44] transition-colors shrink-0"
          >
            <Search className="w-[15px] h-[15px]" />
            <span className="flex-1 text-left">Buscar o ir a…</span>
            <kbd className="px-1.5 py-0.5 rounded-[5px] border border-[#33333b] text-[11px]">Ctrl K</kbd>
          </button>
          <button
            onClick={() => setPaletteOpen(true)}
            className="md:hidden p-2 rounded-lg text-muted hover:bg-surface-hover shrink-0"
            aria-label="Buscar"
          >
            <Search className="w-4 h-4" />
          </button>

          {isAdmin && workerOnline !== null && (
            <span
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 ${
                workerOnline ? "bg-emerald-400/10 text-emerald-300" : "bg-surface-hover text-muted"
              }`}
              title="El worker del chat en tu computadora"
            >
              <span className={`w-[7px] h-[7px] rounded-full ${workerOnline ? "bg-emerald-400" : "bg-muted"}`} />
              {workerOnline ? "PC en línea" : "PC apagada"}
            </span>
          )}

          {/* User & Logout */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className="w-9 h-9 rounded-full bg-[#2e1065] text-[#c4b5fd] flex items-center justify-center text-sm font-semibold select-none"
              title={user?.email ?? ""}
            >
              {userInitial}
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 rounded text-muted hover:text-red-400 hover:bg-surface-hover transition-colors"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
      </header>

      {/* Drawer (hamburger menu) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Panel */}
          <aside className="relative w-64 max-w-[85vw] h-full bg-surface border-r border-border p-4 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <span className="font-bold">{APP_NAME}</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded hover:bg-surface-hover"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {isAdmin && (
                <Link
                  to="/"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-2 rounded text-sm text-muted hover:bg-surface-hover transition-colors"
                >
                  Dashboard
                </Link>
              )}
              <ModuleNavGroups
                variant="drawer"
                onNavigate={() => setDrawerOpen(false)}
              />
            </nav>

              {/* Drawer footer: user + logout */}
              <div className="mt-auto pt-4 border-t border-border">
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                    {userInitial}
                  </div>
                  <span className="text-xs text-muted truncate" title={user?.email ?? ""}>
                    {user?.email}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    handleSignOut();
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded text-sm text-red-400 hover:bg-surface-hover transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
          </aside>
        </div>
      )}

      <SectionContextButton />

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}

      {/* Page content */}
      <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
    </BoardProvider>
  );
}