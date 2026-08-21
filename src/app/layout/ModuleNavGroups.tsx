import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MODULES, type ModuleDef } from "../../lib/modules";
import { useBoardContext } from "../../features/dashboard/BoardContext";

interface ModuleGroup {
  id: string;
  name: string;
  modules: ModuleDef[];
}

// One accent color per group (cycled by position) so it's visually obvious
// which modules belong to which category, matching the dashboard board's
// per-column color coding.
const GROUP_COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#ec4899",
  "#3b82f6",
  "#f97316",
];

interface ModuleNavGroupsProps {
  variant: "topbar" | "drawer";
  onNavigate?: () => void;
}

// Groups the module nav links the same way the dashboard's ModuleBoard
// groups module cards into columns, so the top navbar (and the mobile
// drawer) don't have to list every module flat. Collapsed by default;
// clicking a group name toggles it open/closed, like Chrome tab groups.
export default function ModuleNavGroups({
  variant,
  onNavigate,
}: ModuleNavGroupsProps) {
  const location = useLocation();
  const { columns, positions, loading } = useBoardContext();
  // null = no manual choice yet; fall back to auto-opening the group that
  // contains the current page. Once the user toggles anything, this takes
  // over completely so their choice sticks across navigation.
  const [customOpen, setCustomOpen] = useState<Set<string> | null>(null);

  const groups: ModuleGroup[] = columns
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((col) => ({
      id: col.id,
      name: col.name || "Sin nombre",
      modules: positions
        .filter((p) => p.column_id === col.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => MODULES.find((m) => m.id === p.module_id))
        .filter((m): m is ModuleDef => !!m),
    }));

  const groupedIds = new Set(positions.map((p) => p.module_id));
  const ungrouped = MODULES.filter((m) => !groupedIds.has(m.id));
  const useFlatNav = loading || columns.length === 0;

  // Until the user makes a manual choice, keep whichever group contains
  // the current page open so navigating there doesn't hide where you are.
  const autoOpen = useFlatNav
    ? new Set<string>()
    : (() => {
        const active = groups.find((g) =>
          g.modules.some((m) => m.path === location.pathname)
        );
        return active ? new Set([active.id]) : new Set<string>();
      })();
  const openGroups = customOpen ?? autoOpen;

  function toggleGroup(id: string) {
    setCustomOpen((prev) => {
      const base = prev ?? autoOpen;
      const next = new Set(base);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (variant === "topbar") {
    const linkClass = (active: boolean) =>
      `px-3 py-1.5 rounded text-sm transition-colors whitespace-nowrap ${
        active
          ? "bg-primary text-white"
          : "text-muted hover:bg-surface-hover"
      }`;

    if (useFlatNav) {
      return (
        <>
          {MODULES.map((m) => (
            <Link key={m.id} to={m.path} className={linkClass(location.pathname === m.path)}>
              {m.name}
            </Link>
          ))}
        </>
      );
    }

    return (
      <>
        {groups.map((group, index) => {
          const color = GROUP_COLORS[index % GROUP_COLORS.length];
          const isOpen = openGroups.has(group.id);
          const isActiveGroup = group.modules.some(
            (m) => m.path === location.pathname
          );
          return (
            <div
              key={group.id}
              className="flex items-center gap-1 rounded-lg py-0.5 pl-0.5 pr-1 transition-colors"
              style={{
                backgroundColor: isOpen ? `${color}14` : "transparent",
                border: `1px solid ${isOpen ? `${color}45` : "transparent"}`,
              }}
            >
              <button
                onClick={() => toggleGroup(group.id)}
                style={{ color }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-semibold whitespace-nowrap transition-colors ${
                  isActiveGroup && !isOpen ? "" : "hover:bg-surface-hover"
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                {group.name}
                {isOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
              {isOpen &&
                group.modules.map((m) => (
                  <Link key={m.id} to={m.path} className={linkClass(location.pathname === m.path)}>
                    {m.name}
                  </Link>
                ))}
            </div>
          );
        })}
        {ungrouped.map((m) => (
          <Link key={m.id} to={m.path} className={linkClass(location.pathname === m.path)}>
            {m.name}
          </Link>
        ))}
      </>
    );
  }

  // ===== drawer variant (vertical accordion) =====
  const drawerLinkClass = (active: boolean) =>
    `flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
      active
        ? "bg-primary/15 text-primary"
        : "text-muted hover:bg-surface-hover"
    }`;

  if (useFlatNav) {
    return (
      <>
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.id}
              to={m.path}
              onClick={onNavigate}
              className={drawerLinkClass(location.pathname === m.path)}
            >
              <Icon className="w-4 h-4" />
              {m.name}
            </Link>
          );
        })}
      </>
    );
  }

  return (
    <>
      {groups.map((group, index) => {
        const color = GROUP_COLORS[index % GROUP_COLORS.length];
        const isOpen = openGroups.has(group.id);
        const isActiveGroup = group.modules.some(
          (m) => m.path === location.pathname
        );
        return (
          <div key={group.id}>
            <button
              onClick={() => toggleGroup(group.id)}
              style={{
                color,
                backgroundColor:
                  isActiveGroup && !isOpen ? `${color}1a` : "transparent",
              }}
              className="flex items-center justify-between w-full px-3 py-2 rounded text-sm font-semibold hover:bg-surface-hover transition-colors"
            >
              <span className="flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                {group.name}
              </span>
              {isOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            {isOpen && (
              <div
                className="flex flex-col gap-1 pl-3 mt-1 ml-3"
                style={{ borderLeft: `2px solid ${color}40` }}
              >
                {group.modules.map((m) => {
                  const Icon = m.icon;
                  return (
                    <Link
                      key={m.id}
                      to={m.path}
                      onClick={onNavigate}
                      className={drawerLinkClass(location.pathname === m.path)}
                    >
                      <Icon className="w-4 h-4" />
                      {m.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {ungrouped.map((m) => {
        const Icon = m.icon;
        return (
          <Link
            key={m.id}
            to={m.path}
            onClick={onNavigate}
            className={drawerLinkClass(location.pathname === m.path)}
          >
            <Icon className="w-4 h-4" />
            {m.name}
          </Link>
        );
      })}
    </>
  );
}
