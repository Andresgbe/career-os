import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { APP_NAME } from "../lib/constants";
import { MODULES } from "../lib/modules";
import { supabase } from "../lib/supabase";
import { LogOut } from "lucide-react";

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Topbar */}
      <header className="border-b border-border bg-surface">
        <div className="max-w-7xl mx-auto flex items-center gap-4 px-4 h-14">
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
            <button
              onClick={() => supabase.auth.signOut()}
              className="ml-auto p-2 rounded hover:bg-surface-hover transition-colors text-muted"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
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
          <aside className="relative w-64 bg-surface border-r border-border p-4">
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
          </aside>
        </div>
      )}

      {/* Page content */}
      <main className="max-w-7xl mx-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}