import { FileText, Plus, Eye, ImageIcon } from "lucide-react";
import type { SubjectRow } from "../types";
import { hasEvalPlan } from "../types";

interface EvalPlanCardProps {
  subject: SubjectRow;
  onOpen: (startInEdit: boolean) => void;
}

// Compact summary of a subject's evaluation plan, shown inside the expanded
// subject above its evaluations table. Clicking through opens the full
// previewer (EvalPlanModal).
export default function EvalPlanCard({ subject, onOpen }: EvalPlanCardProps) {
  const has = hasEvalPlan(subject);
  const snippet = subject.eval_plan_text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const imageCount = subject.eval_plan_images.length;

  if (!has) {
    return (
      <button
        onClick={() => onOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 mb-4 rounded-lg border border-dashed border-border text-sm text-muted hover:border-primary hover:text-primary transition-colors"
      >
        <Plus className="w-4 h-4" />
        Agregar plan de evaluación
      </button>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-medium">Plan de evaluación</span>
          {imageCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted shrink-0">
              <ImageIcon className="w-3.5 h-3.5" />
              {imageCount}
            </span>
          )}
        </div>
        <button
          onClick={() => onOpen(false)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-surface-hover hover:bg-border transition-colors shrink-0"
        >
          <Eye className="w-3.5 h-3.5" />
          Ver plan
        </button>
      </div>

      {(snippet || imageCount > 0) && (
        <div className="flex items-start gap-3 mt-3">
          {subject.eval_plan_images.slice(0, 3).map((url, i) => (
            <button
              key={url}
              onClick={() => onOpen(false)}
              className="w-16 h-12 rounded border border-border overflow-hidden bg-background shrink-0 hover:border-primary transition-colors"
              title="Ver plan"
            >
              <img
                src={url}
                alt={`Plan ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
          {snippet && (
            <p className="text-xs text-muted line-clamp-2 min-w-0">{snippet}</p>
          )}
        </div>
      )}
    </div>
  );
}
