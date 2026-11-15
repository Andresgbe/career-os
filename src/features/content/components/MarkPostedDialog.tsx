import { useEffect, useState } from "react";
import { Send, X, Check } from "lucide-react";
import type { ContentIdeaRow } from "../types";
import { PLATFORMS, todayISO } from "../types";

// Records where and when a piece went out: one content_publications row per
// selected platform, all on the same date, each with its own URL.
export default function MarkPostedDialog({
  idea,
  onConfirm,
  onClose,
}: {
  idea: ContentIdeaRow;
  onConfirm: (entries: { platform: string; published_at: string; url: string }[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  // A scheduled piece defaults to its planned day; otherwise today
  const [date, setDate] = useState(idea.scheduled_date && idea.scheduled_date <= todayISO() ? idea.scheduled_date : todayISO());
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function confirm() {
    if (!selected.length || !date) return;
    // Noon local time, so the day never shifts when stored as UTC
    const published_at = new Date(`${date}T12:00:00`).toISOString();
    onConfirm(selected.map((platform) => ({ platform, published_at, url: (urls[platform] ?? "").trim() })));
    onClose();
  }

  const field =
    "w-full bg-background/60 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary transition-colors placeholder:text-muted/60";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-3xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Mark as posted</p>
            <h2 className="text-lg font-bold leading-snug mt-1 line-clamp-2">{idea.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-white/5" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Where</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => {
                const on = selected.includes(p.key);
                return (
                  <button
                    key={p.key}
                    onClick={() => toggle(p.key)}
                    className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium border transition-colors ${
                      on ? "bg-primary/15 border-primary/50 text-foreground" : "border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {on && <Check className="w-3.5 h-3.5 text-primary-hover" strokeWidth={3} />}
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">When</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${field} [color-scheme:dark]`} />
          </div>

          {selected.length > 0 && (
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Links (optional)</label>
              {selected.map((key) => (
                <input
                  key={key}
                  value={urls[key] ?? ""}
                  onChange={(e) => setUrls((u) => ({ ...u, [key]: e.target.value }))}
                  placeholder={`${PLATFORMS.find((p) => p.key === key)?.label} URL`}
                  className={field}
                />
              ))}
            </div>
          )}

          <button
            onClick={confirm}
            disabled={!selected.length || !date}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
            {selected.length > 1 ? `Mark as posted on ${selected.length} platforms` : "Mark as posted"}
          </button>
        </div>
      </div>
    </div>
  );
}
