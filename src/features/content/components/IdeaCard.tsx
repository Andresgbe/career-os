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

const NEXT_STEP = [
  "Siguiente: escribir guion",
  "Siguiente: grabar",
  "Siguiente: editar",
  "Lista para publicar",
];

function updatedLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "hace 1 semana" : `hace ${weeks} semanas`;
}

// One idea: its title, a short description and the three production steps
// as buttons you can tick right from the board. Used in the Kanban board
// and in the Done grid.
export default function IdeaCard({
  idea,
  category,
  onClick,
  onDelete,
  onToggleStatus,
}: IdeaCardProps) {
  const completed = STATUS_STEPS.filter((s) => idea[s.key]).length;
  // The first step not done yet is the one that comes next
  const nextIndex = STATUS_STEPS.findIndex((s) => !idea[s.key]);
  const next = NEXT_STEP[nextIndex === -1 ? 3 : nextIndex];

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col gap-2.5 p-3.5 rounded-xl bg-[#1a1a1f] border border-[#2c2c34] cursor-pointer hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start gap-2 pr-5">
        {category && (
          <span
            className="w-2 h-2 rounded-[2px] mt-1.5 shrink-0"
            style={{ backgroundColor: category.color }}
          />
        )}
        <h3 className="text-sm font-semibold leading-snug line-clamp-2">{idea.title}</h3>
      </div>

      {idea.description && (
        <p className="text-[12.5px] text-muted leading-relaxed line-clamp-2">{idea.description}</p>
      )}

      <div className="grid grid-cols-3 gap-1">
        {STATUS_STEPS.map((step) => {
          const done = idea[step.key];
          return (
            <button
              key={step.key}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(step.key, !done);
              }}
              title={done ? `Desmarcar ${step.label}` : `Marcar ${step.label}`}
              className={`py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                done
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "bg-surface-hover text-muted hover:text-foreground"
              }`}
            >
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

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-2 right-2 p-1 rounded text-muted opacity-0 group-hover:opacity-100 hover:bg-surface-hover hover:text-red-400 transition-all"
        aria-label="Eliminar idea"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
