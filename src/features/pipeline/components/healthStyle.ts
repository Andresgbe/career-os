import type { Health } from "../types";

// Badge / progress-bar colors per guardian status (always shown with a label
// and icon, never color alone)
export const HEALTH_STYLE: Record<Health, { badge: string; bar: string; ring: string }> = {
  ok: { badge: "bg-white/[0.06] text-muted", bar: "#71717a", ring: "" },
  watch: { badge: "bg-amber-400/15 text-amber-300", bar: "#f59e0b", ring: "" },
  attention: {
    badge: "bg-red-500/15 text-red-300",
    bar: "#ef4444",
    ring: "border-red-500/50 shadow-[0_0_0_1px_rgba(239,68,68,0.25)]",
  },
};
