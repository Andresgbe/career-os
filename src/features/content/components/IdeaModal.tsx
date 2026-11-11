import { useEffect, useState } from "react";
import { Check, X as XIcon, Save, Trash2, CalendarDays } from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import type { CategoryRow, ContentIdeaRow, IdeaFields } from "../types";
import {
  FORMATS,
  STATUS_STEPS,
  weekKeyOfISO,
  weekNumber,
  weekRangeLabel,
} from "../types";
import FormatIcon from "./FormatIcon";
import { NO_CATEGORY_COLOR } from "./visuals";

const UNASSIGNED = "unassigned";

interface IdeaModalProps {
  // null = creating a new piece, prefilled with `defaults`
  idea: ContentIdeaRow | null;
  defaults?: Partial<IdeaFields>;
  categories: CategoryRow[];
  onClose: () => void;
  onSave: (fields: IdeaFields) => void;
  onDelete?: () => void;
}

const EMPTY: IdeaFields = {
  title: "",
  description: "",
  script: "",
  hook: "",
  format: "",
  category_id: null,
  scheduled_date: null,
  script_done: false,
  recorded: false,
  edited: false,
};

function pick(idea: ContentIdeaRow): IdeaFields {
  return {
    title: idea.title,
    description: idea.description,
    script: idea.script,
    hook: idea.hook,
    format: idea.format,
    category_id: idea.category_id,
    scheduled_date: idea.scheduled_date,
    script_done: idea.script_done,
    recorded: idea.recorded,
    edited: idea.edited,
  };
}

const label = "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted";
const field =
  "w-full bg-background/60 border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted/60";

export default function IdeaModal({
  idea,
  defaults,
  categories,
  onClose,
  onSave,
  onDelete,
}: IdeaModalProps) {
  const initial = idea ? pick(idea) : { ...EMPTY, ...defaults };
  const [form, setForm] = useState<IdeaFields>(initial);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof IdeaFields>(key: K, value: IdeaFields[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const dirty = (Object.keys(form) as (keyof IdeaFields)[]).some(
    (k) => form[k] !== initial[k]
  );
  const canSave = !!form.title.trim() && (dirty || !idea);

  const handleSave = () => {
    if (!canSave) return;
    onSave({ ...form, title: form.title.trim(), description: form.description.trim(), hook: form.hook.trim() });
    onClose();
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const category = categories.find((c) => c.id === form.category_id);
  const accent = category?.color ?? NO_CATEGORY_COLOR;
  const weekKey = form.scheduled_date ? weekKeyOfISO(form.scheduled_date) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-8" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      <div
        className="relative bg-surface border border-border rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: `linear-gradient(90deg, ${accent}, transparent 70%)` }}
        />

        {/* Header */}
        <div className="flex items-start gap-3 px-5 sm:px-7 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <p className={label}>{idea ? "Pieza de contenido" : "Nueva pieza"}</p>
            <input
              autoFocus={!idea}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Título de la pieza"
              className="w-full mt-1.5 bg-transparent text-2xl sm:text-[28px] font-bold tracking-tight outline-none placeholder:text-muted/50"
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:bg-surface-hover hover:text-foreground transition-colors shrink-0"
            title="Cerrar"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid lg:grid-cols-[1fr_300px]">
            {/* Main writing column */}
            <div className="px-5 sm:px-7 py-5 space-y-5 min-w-0">
              <div className="space-y-2">
                <label className={label}>Hook / gancho</label>
                <input
                  value={form.hook}
                  onChange={(e) => set("hook", e.target.value)}
                  placeholder="La primera línea que detiene el scroll…"
                  className={`${field} text-[15px] italic`}
                />
              </div>

              <div className="space-y-2">
                <label className={label}>Descripción</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="De qué va, el ángulo, la promesa…"
                  className={`${field} resize-none`}
                />
              </div>

              <div className="space-y-2">
                <label className={label}>Guion</label>
                <textarea
                  rows={14}
                  value={form.script}
                  onChange={(e) => set("script", e.target.value)}
                  placeholder="Escribe (o pega) el guion completo…"
                  className={`${field} resize-y font-mono text-[13px] leading-relaxed`}
                />
              </div>
            </div>

            {/* Side panel: production + planning */}
            <aside className="px-5 sm:px-7 lg:px-5 py-5 space-y-6 border-t lg:border-t-0 lg:border-l border-border bg-background/30">
              <div className="space-y-2.5">
                <label className={label}>Producción</label>
                <div className="flex flex-col gap-1.5">
                  {STATUS_STEPS.map((step, i) => {
                    const done = form[step.key];
                    return (
                      <button
                        key={step.key}
                        onClick={() => set(step.key, !done)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                          done
                            ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-300"
                            : "bg-surface border-border text-muted hover:text-foreground hover:border-[#3a3a44]"
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold ${
                            done ? "bg-emerald-400 text-background" : "bg-surface-hover text-muted"
                          }`}
                        >
                          {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
                        </span>
                        {step.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                <label className={label}>Fecha de publicación</label>
                <input
                  type="date"
                  value={form.scheduled_date ?? ""}
                  onChange={(e) => set("scheduled_date", e.target.value || null)}
                  className={`${field} [color-scheme:dark]`}
                />
                {weekKey ? (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-primary-hover font-medium">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {weekNumber(weekKey)} · {weekRangeLabel(weekKey)}
                    </span>
                    <button
                      onClick={() => set("scheduled_date", null)}
                      className="text-muted hover:text-foreground"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted">Sin fecha: queda en el banco de ideas.</p>
                )}
              </div>

              <div className="space-y-2.5">
                <label className={label}>Formato</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {FORMATS.map((f) => {
                    const active = form.format === f.key;
                    return (
                      <button
                        key={f.key}
                        onClick={() => set("format", active ? "" : f.key)}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-medium border transition-colors ${
                          active
                            ? "bg-primary/15 border-primary/50 text-foreground"
                            : "bg-surface border-border text-muted hover:text-foreground"
                        }`}
                      >
                        <FormatIcon format={f.key} />
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                <label className={label}>Categoría</label>
                <div className="flex flex-wrap gap-1.5">
                  {[{ id: UNASSIGNED, name: "Sin categoría", color: NO_CATEGORY_COLOR }, ...categories].map((c) => {
                    const active = (form.category_id ?? UNASSIGNED) === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => set("category_id", c.id === UNASSIGNED ? null : c.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          active ? "text-foreground" : "border-border text-muted hover:text-foreground"
                        }`}
                        style={active ? { borderColor: c.color, backgroundColor: `${c.color}22` } : undefined}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-4 border-t border-border shrink-0">
          {idea && onDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm text-muted hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors disabled:opacity-40"
            >
              <Save className="w-4 h-4" />
              {idea ? "Guardar" : "Crear pieza"}
            </button>
          </div>
        </div>
      </div>

      {confirmDelete && onDelete && (
        <ConfirmDialog
          title="Eliminar pieza"
          confirmLabel="Eliminar"
          message={`¿Eliminar "${idea?.title}"? No se puede deshacer.`}
          onConfirm={() => {
            onDelete();
            setConfirmDelete(false);
            onClose();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
