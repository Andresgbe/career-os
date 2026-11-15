import { Check, CalendarDays, Trash2, Ban, Send } from "lucide-react";
import type { CategoryRow, ContentIdeaRow, StepKey } from "../types";
import {
  STATUS_STEPS,
  dateChipLabel,
  formatLabel,
  styleOf,
  stepsDone,
  weekKeyOfISO,
  weekNumber,
} from "../types";
import FormatIcon from "./FormatIcon";
import { NO_CATEGORY_COLOR } from "./visuals";

interface IdeaCardProps {
  idea: ContentIdeaRow;
  category?: CategoryRow;
  onClick: () => void;
  onDelete?: () => void;
  onToggleStatus: (field: StepKey, value: boolean) => void;
  // Finished tab: show "Mark as posted"; once posted, the platforms instead
  onMarkPosted?: () => void;
  postedOn?: string[];
}

const NEXT_STEP = [
  "Next: write the script",
  "Next: record",
  "Next: edit",
  "Ready to post",
];

function updatedLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
}

// One idea on the board / in the published grid: category, format and date
// chips, the title and hook, and the three production steps as toggles.
export default function IdeaCard({
  idea,
  category,
  onClick,
  onDelete,
  onToggleStatus,
  onMarkPosted,
  postedOn,
}: IdeaCardProps) {
  const completed = stepsDone(idea);
  const nextIndex = STATUS_STEPS.findIndex((s) => !idea[s.key]);
  const next = NEXT_STEP[nextIndex === -1 ? 3 : nextIndex];
  const accent = category?.color ?? NO_CATEGORY_COLOR;

  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col gap-3 p-4 rounded-2xl bg-[#18181d] border cursor-pointer hover:border-primary/50 hover:-translate-y-px hover:shadow-[0_8px_30px_-12px_rgba(139,92,246,0.35)] transition-all overflow-hidden ${
        idea.do_not_publish ? "border-red-500/30 opacity-60 hover:opacity-100" : "border-[#2a2a32]"
      }`}
    >
      {/* category glow along the top edge */}
      <span
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
      />

      <div className="flex items-center gap-1.5 flex-wrap pr-6">
        {idea.do_not_publish && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/15 text-[11px] font-bold uppercase tracking-wider text-red-300">
            <Ban className="w-3 h-3" />
            Do not publish
          </span>
        )}
        {idea.format && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 text-[11px] font-medium text-foreground/80">
            <FormatIcon format={idea.format} className="w-3 h-3" />
            {formatLabel(idea.format)}
          </span>
        )}
        {styleOf(idea.style) && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold"
            style={{ backgroundColor: `${styleOf(idea.style)!.color}1f`, color: styleOf(idea.style)!.color }}
          >
            {styleOf(idea.style)!.label}
          </span>
        )}
        {idea.scheduled_date && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/12 text-[11px] font-medium text-primary-hover">
            <CalendarDays className="w-3 h-3" />
            {weekNumber(weekKeyOfISO(idea.scheduled_date))} · {dateChipLabel(idea.scheduled_date)}
          </span>
        )}
        {category && !idea.format && !idea.scheduled_date && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
            {category.name}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <h3 className="text-[15px] font-semibold leading-snug line-clamp-3">{idea.title}</h3>
        {idea.hook ? (
          <p className="text-[12.5px] text-foreground/70 italic leading-relaxed line-clamp-2">
            “{idea.hook}”
          </p>
        ) : (
          idea.description && (
            <p className="text-[12.5px] text-muted leading-relaxed line-clamp-2">{idea.description}</p>
          )
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {STATUS_STEPS.map((step) => {
          const done = idea[step.key];
          return (
            <button
              key={step.key}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(step.key, !done);
              }}
              title={done ? `Unmark ${step.label}` : `Mark ${step.label}`}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                done
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "bg-white/[0.04] text-muted hover:text-foreground hover:bg-white/[0.08]"
              }`}
            >
              {done && <Check className="w-3 h-3" strokeWidth={3} />}
              {step.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className={completed === 3 ? "text-emerald-300 font-semibold" : "text-primary-hover font-medium"}>
          {next}
        </span>
        <span className="text-muted">{updatedLabel(idea.updated_at)}</span>
      </div>

      {postedOn && postedOn.length > 0 ? (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
          <Send className="w-3.5 h-3.5" />
          Posted on {postedOn.join(", ")}
        </p>
      ) : (
        onMarkPosted && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkPosted();
            }}
            className="flex items-center justify-center gap-1.5 h-9 rounded-xl bg-primary/15 text-primary-hover text-xs font-bold hover:bg-primary/25 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            Mark as posted
          </button>
        )
      )}

      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-muted opacity-0 group-hover:opacity-100 hover:bg-surface-hover hover:text-red-400 transition-all"
          aria-label="Delete idea"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
