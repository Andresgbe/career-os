import { Check } from "lucide-react";
import type { CategoryRow, ContentIdeaRow } from "../types";
import { STATUS_STEPS, formatLabel, isDone } from "../types";
import FormatIcon from "./FormatIcon";
import { NO_CATEGORY_COLOR } from "./visuals";

// Compact piece for the planner's day columns and the idea bank: format,
// title and a three-segment production bar.
export default function PieceCard({
  idea,
  category,
  onClick,
}: {
  idea: ContentIdeaRow;
  category?: CategoryRow;
  onClick: () => void;
}) {
  const accent = category?.color ?? NO_CATEGORY_COLOR;
  const done = isDone(idea);

  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col gap-2 pl-3.5 pr-2.5 py-2.5 rounded-xl border cursor-pointer transition-colors overflow-hidden ${
        done
          ? "bg-emerald-400/[0.06] border-emerald-400/25 hover:border-emerald-400/50"
          : "bg-[#1a1a20] border-[#2a2a32] hover:border-primary/50"
      }`}
    >
      <span className="absolute left-0 inset-y-0 w-[3px]" style={{ backgroundColor: accent }} />

      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted">
        <span style={{ color: accent }}>
          <FormatIcon format={idea.format} className="w-3 h-3" />
        </span>
        <span className="truncate">{formatLabel(idea.format) || category?.name || "Idea"}</span>
        {done && (
          <span className="ml-auto w-4 h-4 shrink-0 rounded-full bg-emerald-400 text-background flex items-center justify-center">
            <Check className="w-2.5 h-2.5" strokeWidth={3.5} />
          </span>
        )}
      </div>

      <p className="text-[13px] font-semibold leading-snug line-clamp-3 break-words">{idea.title}</p>

      {!done && (
        <div className="flex gap-1" title={STATUS_STEPS.map((s) => `${s.label}: ${idea[s.key] ? "sí" : "no"}`).join(" · ")}>
          {STATUS_STEPS.map((s) => (
            <span
              key={s.key}
              className={`h-1 flex-1 rounded-full ${idea[s.key] ? "bg-emerald-400" : "bg-white/10"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
