import { Check } from "lucide-react";
import type { ContentIdeaRow } from "../types";
import { isDone } from "../types";
import FormatIcon from "./FormatIcon";
import { coverStyle, NO_CATEGORY_COLOR } from "./visuals";

// Small portrait "cover" of a piece — the thumbnails along the bottom of
// each week card in the planner strip.
export default function PieceTile({
  idea,
  color,
}: {
  idea: ContentIdeaRow;
  color?: string;
}) {
  const accent = color ?? NO_CATEGORY_COLOR;
  const done = isDone(idea);
  return (
    <div
      className="relative aspect-[4/5] rounded-lg border border-white/5 overflow-hidden p-2 flex flex-col justify-between"
      style={coverStyle(accent)}
    >
      <p className="text-[9.5px] leading-[1.15] font-extrabold uppercase tracking-tight text-foreground/90 line-clamp-4 break-words">
        {idea.title}
      </p>
      <div className="flex items-center justify-between">
        <span style={{ color: accent }}>
          <FormatIcon format={idea.format} className="w-3 h-3" />
        </span>
        {done && (
          <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 text-background flex items-center justify-center">
            <Check className="w-2.5 h-2.5" strokeWidth={3} />
          </span>
        )}
      </div>
    </div>
  );
}
