import type { WeekStatus } from "../types";

const STYLES: Record<WeekStatus, { label: string; className: string }> = {
  draft:    { label: "Draft",   className: "bg-white/[0.06] text-foreground/70" },
  approved: { label: "Approved",   className: "bg-emerald-400/15 text-emerald-300" },
  done:     { label: "Done", className: "bg-primary/20 text-primary-hover" },
};

// Status pill of a weekly plan. A week nobody has touched yet reads
// "No plan" until it gets pieces or a status.
export default function WeekStatusBadge({
  status,
  hasPieces,
}: {
  status?: WeekStatus;
  hasPieces: boolean;
}) {
  if (!status && !hasPieces) {
    return (
      <span className="px-2 py-0.5 rounded-md text-[10.5px] font-semibold uppercase tracking-wider text-muted/70 border border-dashed border-[#33333b]">
        No plan
      </span>
    );
  }
  const s = STYLES[status ?? "draft"];
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold uppercase tracking-wider ${s.className}`}>
      {s.label}
    </span>
  );
}
