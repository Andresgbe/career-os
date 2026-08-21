import { Trash2 } from "lucide-react";
import type { CategoryRow, ContentIdeaRow } from "../types";
import { STATUS_STEPS } from "../types";

interface IdeaCardProps {
  idea: ContentIdeaRow;
  category?: CategoryRow;
  onClick: () => void;
  onDelete: () => void;
  onToggleStatus: (
    field: "script_done" | "recorded" | "edited",
    value: boolean
  ) => void;
}

// Compact square-ish tile for one idea — used both inside the Kanban board
// (wrapped in a Draggable there) and in the Done grid.
export default function IdeaCard({
  idea,
  category,
  onClick,
  onDelete,
  onToggleStatus,
}: IdeaCardProps) {
  const completedSteps = STATUS_STEPS.filter((s) => idea[s.key]).length;

  return (
    <div
      onClick={onClick}
      className="group relative bg-surface border border-border rounded-lg pl-3 pr-2 py-2.5 cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
    >
      {category && (
        <span
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: category.color }}
        />
      )}

      <p className="text-sm font-medium leading-snug line-clamp-2 pr-5">
        {idea.title}
      </p>

      {idea.description && (
        <p className="text-xs text-muted line-clamp-2 mt-1">
          {idea.description}
        </p>
      )}

      <div className="flex items-center gap-1.5 mt-2">
        {STATUS_STEPS.map((step) => {
          const done = idea[step.key];
          return (
            <button
              key={step.key}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(step.key, !done);
              }}
              title={`${step.label}: ${done ? "Done" : "Pending"}`}
              className={`w-3 h-3 rounded-full transition-colors ${
                done ? "bg-emerald-400" : "bg-border hover:bg-muted"
              }`}
            />
          );
        })}
        <span className="text-[10px] text-muted ml-0.5">
          {completedSteps}/{STATUS_STEPS.length}
        </span>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-1.5 right-1.5 p-1 rounded text-muted opacity-0 group-hover:opacity-100 hover:bg-surface-hover hover:text-red-400 transition-all"
        title="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
