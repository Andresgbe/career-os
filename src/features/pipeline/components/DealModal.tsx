import { useEffect, useState } from "react";
import { X, Save, Trash2, Trophy, CircleX, RotateCcw, Bot, UserRound } from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import type { ActivityRow, DealRow, StageRow } from "../types";
import { CHANNELS, SOURCES } from "../types";
import type { DealFields } from "../api";

const label = "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted";
const field =
  "w-full bg-background/60 border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted/60";

const toDateInput = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface Form {
  name: string;
  company: string;
  contact: string;
  channel: string;
  stage_id: string | null;
  note: string;
  value: string;
  currency: string;
  last_activity: string; // YYYY-MM-DD
  suggested_message: string;
  source: string;
  source_idea_id: string;
}

// Create or edit a deal, plus its history (who did what: you or an agent)
export default function DealModal({
  deal,
  stages,
  activity,
  onClose,
  onSave,
  onStatus,
  onDelete,
  defaultStageId,
  ideaOptions = [],
}: {
  deal: DealRow | null;
  defaultStageId?: string | null;
  ideaOptions?: { id: string; title: string }[];
  stages: StageRow[];
  activity: ActivityRow[];
  onClose: () => void;
  onSave: (fields: DealFields & { name: string }) => void;
  onStatus?: (status: DealRow["status"]) => void;
  onDelete?: () => void;
}) {
  const initial: Form = {
    name: deal?.name ?? "",
    company: deal?.company ?? "",
    contact: deal?.contact ?? "",
    channel: deal?.channel ?? "whatsapp",
    stage_id: deal?.stage_id ?? defaultStageId ?? stages[0]?.id ?? null,
    note: deal?.note ?? "",
    value: deal?.value === null || deal?.value === undefined ? "" : String(deal.value),
    currency: deal?.currency ?? "USD",
    last_activity: toDateInput(deal?.last_activity_at ?? new Date().toISOString()),
    suggested_message: deal?.suggested_message ?? "",
    source: deal?.source ?? "",
    source_idea_id: deal?.source_idea_id ?? "",
  };
  const [form, setForm] = useState<Form>(initial);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function save() {
    if (!form.name.trim()) return;
    const fields: DealFields & { name: string } = {
      name: form.name.trim(),
      company: form.company.trim(),
      contact: form.contact.trim(),
      channel: form.channel,
      stage_id: form.stage_id,
      note: form.note.trim(),
      value: form.value === "" ? null : Number(form.value),
      currency: form.currency,
      suggested_message: form.suggested_message,
    };
    // Only send the origin when it's set or changed (the columns come with
    // BLOQUE 26; this keeps saving working on an older database)
    if (form.source !== initial.source) fields.source = form.source;
    if (form.source_idea_id !== initial.source_idea_id) fields.source_idea_id = form.source_idea_id || null;
    // Only move the clock if the date was actually changed
    if (form.last_activity !== initial.last_activity) {
      fields.last_activity_at = new Date(`${form.last_activity}T12:00:00`).toISOString();
    }
    onSave(fields);
    onClose();
  }

  const history = deal ? activity.filter((a) => a.deal_id === deal.id) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-8" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl border border-border bg-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-border">
          <div className="flex-1 min-w-0">
            <p className={label}>{deal ? (deal.status === "open" ? "Open deal" : deal.status === "won" ? "Won" : "Lost") : "New deal"}</p>
            <input
              autoFocus={!deal}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Client or lead name"
              className="w-full mt-1.5 bg-transparent text-2xl font-bold tracking-tight outline-none placeholder:text-muted/50"
            />
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-muted hover:bg-surface-hover hover:text-foreground" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid md:grid-cols-[1fr_260px]">
          <div className="px-6 py-5 space-y-4 min-w-0">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={label}>Company</label>
                <input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Optional" className={field} />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Contact</label>
                <input value={form.contact} onChange={(e) => set("contact", e.target.value)} placeholder="+58 412… / email / @user" className={field} />
              </div>
              <div className="space-y-1.5">
                <label className={label}>Channel</label>
                <select value={form.channel} onChange={(e) => set("channel", e.target.value)} className={`${field} [color-scheme:dark]`}>
                  {CHANNELS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={label}>Stage</label>
                <select
                  value={form.stage_id ?? ""}
                  onChange={(e) => set("stage_id", e.target.value || null)}
                  className={`${field} [color-scheme:dark]`}
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (max {s.max_days}d)
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={label}>Value</label>
                <div className="flex gap-2">
                  <input
                    inputMode="decimal"
                    value={form.value}
                    onChange={(e) => set("value", e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder="0"
                    className={field}
                  />
                  <select value={form.currency} onChange={(e) => set("currency", e.target.value)} className={`${field} w-24 [color-scheme:dark]`}>
                    {["USD", "VES", "EUR"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={label}>Last movement</label>
                <input type="date" value={form.last_activity} onChange={(e) => set("last_activity", e.target.value)} className={`${field} [color-scheme:dark]`} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={label}>Lead source</label>
                <select value={form.source} onChange={(e) => set("source", e.target.value)} className={`${field} [color-scheme:dark]`}>
                  {SOURCES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={label}>From content piece</label>
                <select
                  value={form.source_idea_id}
                  onChange={(e) => set("source_idea_id", e.target.value)}
                  className={`${field} [color-scheme:dark]`}
                >
                  <option value="">— None —</option>
                  {ideaOptions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title.slice(0, 70)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={label}>Last thing that happened</label>
              <input value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="e.g. Asked for the proposal" className={field} />
            </div>
            <div className="space-y-1.5">
              <label className={label}>Suggested follow-up</label>
              <textarea
                rows={3}
                value={form.suggested_message}
                onChange={(e) => set("suggested_message", e.target.value)}
                placeholder="Leave empty to use the stage's template"
                className={`${field} resize-none`}
              />
            </div>
          </div>

          <aside className="px-5 py-5 border-t md:border-t-0 md:border-l border-border bg-background/30 space-y-3">
            <p className={label}>History</p>
            {history.length === 0 ? (
              <p className="text-xs text-muted">Nothing logged yet.</p>
            ) : (
              <ol className="space-y-2.5">
                {history.map((a) => (
                  <li key={a.id} className="flex gap-2">
                    <span
                      className={`mt-0.5 w-5 h-5 shrink-0 rounded-md flex items-center justify-center ${
                        a.actor === "agent" ? "bg-primary/20 text-primary-hover" : "bg-white/5 text-muted"
                      }`}
                      title={a.actor === "agent" ? "By an agent" : "By you"}
                    >
                      {a.actor === "agent" ? <Bot className="w-3 h-3" /> : <UserRound className="w-3 h-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] leading-snug break-words">{a.body}</span>
                      <span className="block text-[10.5px] text-muted">
                        {new Date(a.created_at).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap px-6 py-4 border-t border-border">
          <div className="flex items-center gap-1.5">
            {deal && onDelete && (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 text-sm font-medium">
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
            {deal && onStatus && deal.status === "open" && (
              <>
                <button
                  onClick={() => {
                    onStatus("won");
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-emerald-300 hover:bg-emerald-400/10 text-sm font-semibold"
                >
                  <Trophy className="w-4 h-4" />
                  Won
                </button>
                <button
                  onClick={() => {
                    onStatus("lost");
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-muted hover:text-foreground hover:bg-white/5 text-sm font-semibold"
                >
                  <CircleX className="w-4 h-4" />
                  Lost
                </button>
              </>
            )}
            {deal && onStatus && deal.status !== "open" && (
              <button
                onClick={() => {
                  onStatus("open");
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-muted hover:text-foreground hover:bg-white/5 text-sm font-semibold"
              >
                <RotateCcw className="w-4 h-4" />
                Reopen
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-muted hover:text-foreground">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!form.name.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold disabled:opacity-40"
            >
              <Save className="w-4 h-4" />
              {deal ? "Save" : "Create deal"}
            </button>
          </div>
        </div>
      </div>

      {confirmDelete && onDelete && (
        <ConfirmDialog
          title="Delete deal"
          confirmLabel="Delete"
          message={`Delete "${deal?.name}" and its history? This can't be undone.`}
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
