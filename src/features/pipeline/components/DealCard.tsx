import { AlertTriangle, Clock3, Check } from "lucide-react";
import type { DealRow, Health, StageRow } from "../types";
import { HEALTH_LABEL, daysSince, healthOf } from "../types";
import { HEALTH_STYLE } from "./healthStyle";


export function HealthBadge({ health }: { health: Health }) {
  const Icon = health === "attention" ? AlertTriangle : health === "watch" ? Clock3 : Check;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${HEALTH_STYLE[health].badge}`}
    >
      <Icon className="w-2.5 h-2.5" strokeWidth={3} />
      {HEALTH_LABEL[health]}
    </span>
  );
}

// One deal on the board: who, the last thing that happened, how it's doing
// against its stage's rule and a bar of days spent vs. days allowed.
export default function DealCard({
  deal,
  stage,
  selected,
  onClick,
}: {
  deal: DealRow;
  stage?: StageRow;
  selected: boolean;
  onClick: () => void;
}) {
  const health = healthOf(deal, stage);
  const days = daysSince(deal.last_activity_at);
  const max = Math.max(1, stage?.max_days ?? 1);
  const pct = Math.min(100, (days / max) * 100);

  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col gap-2 p-3 rounded-xl border cursor-pointer transition-all bg-[#1a1a20] ${
        selected ? "border-primary/70 bg-primary/[0.07]" : health === "attention" ? HEALTH_STYLE.attention.ring : "border-[#2a2a32] hover:border-[#3a3a44]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug truncate">{deal.name}</p>
        <HealthBadge health={health} />
      </div>
      {(deal.note || deal.company) && (
        <p className="text-xs text-muted line-clamp-2">{deal.note || deal.company}</p>
      )}
      <div className="flex items-center gap-2">
        <span className="flex-1 h-1 rounded-full bg-white/[0.08] overflow-hidden">
          <span className="block h-full rounded-full" style={{ width: `${Math.max(4, pct)}%`, backgroundColor: HEALTH_STYLE[health].bar }} />
        </span>
        <span className="text-[11px] tabular-nums text-muted whitespace-nowrap">
          {days} {days === 1 ? "day" : "days"}
        </span>
      </div>
    </div>
  );
}
