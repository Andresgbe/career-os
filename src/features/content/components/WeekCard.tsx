import type { CategoryRow, ContentIdeaRow, ContentWeekRow } from "../types";
import { isDone, weekNumber, weekRangeLabel } from "../types";
import PieceTile from "./PieceTile";
import WeekStatusBadge from "./WeekStatusBadge";

interface WeekCardProps {
  weekKey: string;
  week?: ContentWeekRow;
  pieces: ContentIdeaRow[];
  categories: CategoryRow[];
  isCurrent: boolean;
  isPast: boolean;
  selected: boolean;
  onSelect: () => void;
}

// One week in the planner strip: ISO key, date range, status, piece count
// and a row of mini covers for its first pieces.
export default function WeekCard({
  weekKey,
  week,
  pieces,
  categories,
  isCurrent,
  isPast,
  selected,
  onSelect,
}: WeekCardProps) {
  const done = pieces.filter(isDone).length;
  const colorOf = (id: string | null) => categories.find((c) => c.id === id)?.color;
  const shown = pieces.slice(0, 4);

  return (
    <button
      data-week={weekKey}
      onClick={onSelect}
      className={`group relative w-[272px] sm:w-[288px] shrink-0 snap-start text-left rounded-2xl border p-4 flex flex-col gap-3 transition-all overflow-hidden ${
        selected
          ? "border-primary/70 bg-[#1a1626] shadow-[0_0_0_1px_rgba(139,92,246,0.35),0_18px_40px_-20px_rgba(139,92,246,0.6)]"
          : "border-border bg-surface hover:border-[#3a3a44] hover:-translate-y-0.5"
      } ${isPast && !selected ? "opacity-70 hover:opacity-100" : ""}`}
    >
      {selected && (
        <span className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/25 blur-3xl pointer-events-none" />
      )}

      <div className="relative flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] tracking-wider text-primary-hover">{weekKey}</span>
        {isCurrent && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            ACTUAL
          </span>
        )}
      </div>

      <div className="relative space-y-1">
        <h3 className="text-[17px] font-bold leading-tight tracking-tight">
          Semana {weekNumber(weekKey)} — {weekRangeLabel(weekKey)}
        </h3>
        <p className="text-xs text-muted line-clamp-1 min-h-4">{week?.title || " "}</p>
      </div>

      <div className="relative flex items-center gap-1.5 flex-wrap">
        <WeekStatusBadge status={week?.status} hasPieces={pieces.length > 0} />
        <span className="px-2 py-0.5 rounded-md border border-border text-[10.5px] font-semibold uppercase tracking-wider text-muted">
          {pieces.length} {pieces.length === 1 ? "pieza" : "piezas"}
        </span>
        {pieces.length > 0 && (
          <span className="ml-auto text-[11px] font-semibold tabular-nums text-emerald-300/90">
            {done}/{pieces.length} listas
          </span>
        )}
      </div>

      <div className="relative grid grid-cols-4 gap-1.5">
        {shown.map((p) => (
          <PieceTile key={p.id} idea={p} color={colorOf(p.category_id)} />
        ))}
        {Array.from({ length: 4 - shown.length }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="aspect-[4/5] rounded-lg border border-dashed border-[#2e2e36] bg-white/[0.015]"
          />
        ))}
      </div>
    </button>
  );
}
