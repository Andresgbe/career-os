import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, LayoutDashboard } from "lucide-react";
import { ADMIN_MODULE, MODULES, type ModuleDef } from "../../lib/modules";
import { usePermissions } from "../../hooks/usePermissions";

interface CommandPaletteProps {
  onClose: () => void;
}

const DASHBOARD: ModuleDef = { id: "dashboard", name: "Dashboard", path: "/", icon: LayoutDashboard };

// "Buscar o ir a…": type part of a module's name and jump straight to it.
// Opened from the topbar button or with Ctrl/Cmd + K.
export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { isAdmin, canView } = usePermissions();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const all = [
    ...(isAdmin ? [DASHBOARD] : []),
    ...MODULES.filter((m) => canView(m.id)),
    ...(isAdmin ? [ADMIN_MODULE] : []),
  ];
  const needle = query.trim().toLowerCase();
  const results = needle ? all.filter((m) => m.name.toLowerCase().includes(needle)) : all;
  const current = Math.min(selected, Math.max(results.length - 1, 0));

  function go(m: ModuleDef | undefined) {
    if (!m) return;
    navigate(m.path);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-[12vh]" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="flex items-center gap-3 px-4 h-14 border-b border-border">
          <Search className="w-4 h-4 text-muted shrink-0" />
          <span className="sr-only">Buscar módulo</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected(Math.min(current + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected(Math.max(current - 1, 0));
              } else if (e.key === "Enter") {
                go(results[current]);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Buscar o ir a…"
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-muted"
          />
          <kbd className="px-1.5 py-0.5 rounded-md border border-[#33333b] text-[11px] text-muted">Esc</kbd>
        </label>
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted">Nada coincide con "{query}".</li>
          ) : (
            results.map((m, i) => {
              const Icon = m.icon;
              return (
                <li key={m.id}>
                  <button
                    onClick={() => go(m)}
                    onMouseEnter={() => setSelected(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-colors ${
                      i === current ? "bg-surface-hover" : ""
                    }`}
                  >
                    <Icon className="w-4 h-4 text-muted" />
                    {m.name}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
