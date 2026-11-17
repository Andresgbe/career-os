import { ChevronDown } from "lucide-react";

// Chevron button that minimizes / expands a block. Pair it with
// `useCollapsed()` (src/hooks/useCollapsed.ts) to remember the choice.
export default function CollapseToggle({
  collapsed,
  onToggle,
  label,
  className = "",
}: {
  collapsed: boolean;
  onToggle: () => void;
  label?: string; // what the block is, for the tooltip / screen readers
  className?: string;
}) {
  const what = label ? ` ${label}` : "";
  return (
    <button
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? `Expand${what}` : `Minimize${what}`}
      title={collapsed ? "Expand" : "Minimize"}
      className={`w-8 h-8 shrink-0 rounded-lg border border-border bg-background/50 flex items-center justify-center text-muted hover:text-foreground hover:border-[#3a3a44] transition-colors ${className}`}
    >
      <ChevronDown className={`w-4 h-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
    </button>
  );
}
