import { useEffect, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import type { StageRow } from "../types";
import type { Pipeline } from "../usePipeline";

const field =
  "w-full bg-background/60 border border-border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted/60";

// Edit the stages and the guardian's rule for each: max days without
// movement, the rule in words, and the follow-up template ({nombre}).
export default function StagesModal({ pipeline, onClose }: { pipeline: Pipeline; onClose: () => void }) {
  const [deleting, setDeleting] = useState<StageRow | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-8" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl border border-border bg-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4 border-b border-border">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Stages & rules</h2>
            <p className="text-sm text-muted mt-1">
              The guardian flags a deal once it sits in a stage longer than its rule allows. Use {"{nombre}"} in the template for
              the client's first name.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-muted hover:bg-surface-hover hover:text-foreground" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {pipeline.stages.map((s) => (
            <StageEditor key={s.id} stage={s} pipeline={pipeline} onDelete={() => setDeleting(s)} />
          ))}
          <button
            onClick={() =>
              pipeline.createStage({ name: "New stage", max_days: 3, rule: "", message_template: "", color: "#8b5cf6" })
            }
            className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl border border-dashed border-[#3f3f48] text-sm font-semibold text-muted hover:border-primary hover:text-foreground"
          >
            <Plus className="w-4 h-4" />
            Add stage
          </button>
        </div>
      </div>

      {deleting && (
        <ConfirmDialog
          title="Delete stage"
          confirmLabel="Delete"
          message={`Delete "${deleting.name}"? Its deals move to the first remaining stage.`}
          onConfirm={() => {
            pipeline.removeStage(deleting.id);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function StageEditor({ stage, pipeline, onDelete }: { stage: StageRow; pipeline: Pipeline; onDelete: () => void }) {
  const [draft, setDraft] = useState(stage);
  const commit = (fields: Partial<StageRow>) => {
    const changed = Object.entries(fields).some(([k, v]) => stage[k as keyof StageRow] !== v);
    if (changed) pipeline.editStage(stage.id, fields);
  };

  return (
    <div className="rounded-2xl border border-border bg-background/40 p-4 space-y-3">
      <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-end">
        <div className="space-y-1">
          <label className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">Stage</label>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onBlur={() => draft.name.trim() && commit({ name: draft.name.trim() })}
            className={field}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">Max days</label>
          <input
            type="number"
            min={0}
            value={draft.max_days}
            onChange={(e) => setDraft({ ...draft, max_days: Math.max(0, Number(e.target.value)) })}
            onBlur={() => commit({ max_days: draft.max_days })}
            className={field}
          />
        </div>
        <button onClick={onDelete} className="p-2 rounded-lg text-muted hover:text-red-400 hover:bg-white/5" title="Delete stage">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-1">
        <label className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">Alert if</label>
        <input
          value={draft.rule}
          onChange={(e) => setDraft({ ...draft, rule: e.target.value })}
          onBlur={() => commit({ rule: draft.rule })}
          placeholder="e.g. Más de 3 días sin respuesta"
          className={field}
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">Follow-up template</label>
        <textarea
          rows={2}
          value={draft.message_template}
          onChange={(e) => setDraft({ ...draft, message_template: e.target.value })}
          onBlur={() => commit({ message_template: draft.message_template })}
          className={`${field} resize-none`}
        />
      </div>
    </div>
  );
}
