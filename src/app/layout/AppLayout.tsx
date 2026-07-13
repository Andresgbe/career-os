import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut } from "lucide-react";
import { APP_NAME } from "../../lib/constants";
import { MODULES } from "../../lib/modules";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Topbar */}
      <header className="flex items-center gap-4 border-b border-border bg-surface px-4 h-14">
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded hover:bg-surface-hover transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link to="/" className="text-lg font-bold">
          {APP_NAME}
        </Link>

        {/* Horizontal tabs */}
        <nav className="hidden sm:flex gap-1 ml-4">
          <Link
            to="/"
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              location.pathname === "/"
                ? "bg-primary text-white"
                : "text-muted hover:bg-surface-hover"
            }`}
          >
            Dashboard
          </Link>
          {MODULES.map((m) => (
            <Link
              key={m.id}
              to={m.path}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                location.pathname === m.path
                  ? "bg-primary text-white"
                  : "text-muted hover:bg-surface-hover"
              }`}
            >
              {m.name}
            </Link>
          ))}
        </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* User & Logout */}
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-semibold select-none"
              title={user?.email ?? ""}
            >
              {userInitial}
            </div>
            <span className="hidden md:block text-sm text-muted max-w-[140px] truncate" title={user?.email ?? ""}>
              {user?.email}
            </span>
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
          <aside className="relative w-64 h-full bg-surface border-r border-border p-4 flex flex-col">
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
              <Link
                to="/"
                onClick={() => setDrawerOpen(false)}
                className="px-3 py-2 rounded text-sm text-muted hover:bg-surface-hover transition-colors"
              >
                Dashboard
              </Link>
              {MODULES.map((m) => {
                const Icon = m.icon;
                return (
                  <Link
                    key={m.id}
                    to={m.path}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded text-sm text-muted hover:bg-surface-hover transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                    {m.name}
                  </Link>
                );
              })}
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

      {/* Page content */}
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}