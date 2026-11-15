import { useEffect, useState } from "react";
import { Check, X as XIcon, Save, Trash2, CalendarDays, Send } from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import type { CategoryRow, ContentIdeaRow, IdeaFields, PublicationRow } from "../types";
import {
  FORMATS,
  STYLES,
  STATUS_STEPS,
  platformLabel,
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
  // Existing piece: only the changed fields. New piece: everything filled in.
  onSave: (fields: Partial<IdeaFields>) => void;
  onDelete?: () => void;
  // Where this piece was posted, and the action to record a new post
  publications?: PublicationRow[];
  onMarkPosted?: () => void;
}

const EMPTY: IdeaFields = {
  title: "",
  description: "",
  script: "",
  hook: "",
  format: "",
  style: "",
  category_id: null,
  scheduled_date: null,
  script_done: false,
  recorded: false,
  edited: false,
  do_not_publish: false,
};

function pick(idea: ContentIdeaRow): IdeaFields {
  return {
    title: idea.title,
    description: idea.description,
    script: idea.script,
    hook: idea.hook,
    format: idea.format,
    style: idea.style,
    category_id: idea.category_id,
    scheduled_date: idea.scheduled_date,
    script_done: idea.script_done,
    recorded: idea.recorded,
    edited: idea.edited,
    do_not_publish: idea.do_not_publish,
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
  publications,
  onMarkPosted,
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
    const clean: IdeaFields = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      hook: form.hook.trim(),
    };
    const keys = Object.keys(clean) as (keyof IdeaFields)[];
    // Send only what changed (and skip the default do_not_publish on new
    // pieces), so saving never writes a column the DB may not have yet.
    // Columns added by later PENDIENTE.sql blocks: a new piece only sends them
    // when set, so creating works before those blocks have been run.
    const optional: Partial<IdeaFields> = { do_not_publish: false, style: "" };
    const changed = keys.filter((k) =>
      idea ? clean[k] !== initial[k] : !(k in optional && clean[k] === optional[k])
    );
    onSave(Object.fromEntries(changed.map((k) => [k, clean[k]])) as Partial<IdeaFields>);
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
            <p className={label}>{idea ? "Content piece" : "New piece"}</p>
            <input
              autoFocus={!idea}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Piece title"
              className="w-full mt-1.5 bg-transparent text-2xl sm:text-[28px] font-bold tracking-tight outline-none placeholder:text-muted/50"
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:bg-surface-hover hover:text-foreground transition-colors shrink-0"
            title="Close"
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
                <label className={label}>Hook</label>
                <input
                  value={form.hook}
                  onChange={(e) => set("hook", e.target.value)}
                  placeholder="The first line that stops the scroll…"
                  className={`${field} text-[15px] italic`}
                />
              </div>

              <div className="space-y-2">
                <label className={label}>Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="What it's about, the angle, the promise…"
                  className={`${field} resize-none`}
                />
              </div>

              <div className="space-y-2">
                <label className={label}>Script</label>
                <textarea
                  rows={14}
                  value={form.script}
                  onChange={(e) => set("script", e.target.value)}
                  placeholder="Write (or paste) the full script…"
                  className={`${field} resize-y font-mono text-[13px] leading-relaxed`}
                />
              </div>
            </div>

            {/* Side panel: production + planning */}
            <aside className="px-5 sm:px-7 lg:px-5 py-5 space-y-6 border-t lg:border-t-0 lg:border-l border-border bg-background/30">
              <div className="space-y-2.5">
                <label className={label}>Production</label>
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
                <label className={label}>Publish date</label>
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
                      Clear
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted">No date: it stays in the idea bank.</p>
                )}
              </div>

              <div className="space-y-2.5">
                <label className={label}>Format</label>
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
                <label className={label}>Style</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {STYLES.map((st) => {
                    const active = form.style === st.key;
                    return (
                      <button
                        key={st.key}
                        onClick={() => set("style", active ? "" : st.key)}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-medium border transition-colors ${
                          active ? "text-foreground" : "bg-surface border-border text-muted hover:text-foreground"
                        }`}
                        style={active ? { borderColor: `${st.color}99`, backgroundColor: `${st.color}1f` } : undefined}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color }} />
                        {st.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted">Format is where it's published; style is how it's produced.</p>
              </div>

              <div className="space-y-2.5">
                <label className={label}>Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {[{ id: UNASSIGNED, name: "No category", color: NO_CATEGORY_COLOR }, ...categories].map((c) => {
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

              {idea && (publications?.length || onMarkPosted) && (
                <div className="space-y-2.5">
                  <label className={label}>Posted</label>
                  {publications && publications.length > 0 ? (
                    <ul className="space-y-1">
                      {publications.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex items-center gap-1.5 font-medium text-emerald-300">
                            <Send className="w-3.5 h-3.5" />
                            {platformLabel(p.platform)}
                          </span>
                          <span className="text-xs text-muted tabular-nums">
                            {new Date(p.published_at).toLocaleDateString("en", { month: "short", day: "numeric" })}
                            {p.views !== null && ` · ${p.views.toLocaleString("en")} views`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted">Not posted anywhere yet.</p>
                  )}
                  {onMarkPosted && (
                    <button
                      onClick={onMarkPosted}
                      className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl bg-primary/15 text-primary-hover text-xs font-bold hover:bg-primary/25 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Mark as posted
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-2.5">
                <label className={label}>Publishing</label>
                <button
                  onClick={() => {
                    const next = !form.do_not_publish;
                    setForm((f) => ({ ...f, do_not_publish: next, scheduled_date: next ? null : f.scheduled_date }));
                  }}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left border transition-colors ${
                    form.do_not_publish
                      ? "bg-red-500/10 border-red-500/40 text-red-200"
                      : "bg-surface border-border text-muted hover:text-foreground hover:border-[#3a3a44]"
                  }`}
                >
                  <span
                    className={`mt-0.5 w-4 h-4 shrink-0 rounded-[5px] border flex items-center justify-center ${
                      form.do_not_publish ? "bg-red-500 border-red-500" : "border-muted/60"
                    }`}
                  >
                    {form.do_not_publish && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">Do not publish</span>
                    <span className="block text-xs opacity-80">
                      Stays out of the idea bank and the planner, and the AI never suggests it.
                    </span>
                  </span>
                </button>
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
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors disabled:opacity-40"
            >
              <Save className="w-4 h-4" />
              {idea ? "Save" : "Create piece"}
            </button>
          </div>
        </div>
      </div>

      {confirmDelete && onDelete && (
        <ConfirmDialog
          title="Delete piece"
          confirmLabel="Delete"
          message={`Delete "${idea?.title}"? This can't be undone.`}
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
