import { useEffect, useMemo, useState } from "react";
import { X, Check } from "lucide-react";
import type { AccountDailyRow, PeriodTotalRow, PostMetricKey, PostMetricRow } from "../types";
import { ACCOUNT_METRICS, POST_METRICS, STATS_PLATFORMS, addDays, platformLabel, todayISO, toISODate } from "../types";
import { latestSnapshot } from "../stats";
import type { ContentStudio } from "../useContentStudio";

type Tab = "account" | "post" | "lead";
const field =
  "w-full h-11 bg-background/60 border border-border rounded-xl px-3 text-[15px] outline-none focus:border-primary transition-colors placeholder:text-muted/50";
const lbl = "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted";

// Numeric inputs keep the text as typed; "" = no data (saved as null)
const toNum = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
const toStr = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

// Quick phone form to load numbers by hand: an account day, a post's
// snapshot, or a lead. Pre-fills what's already loaded for the chosen day so
// saving never wipes a number by accident.
export default function LogMetricsSheet({ studio, onClose }: { studio: ContentStudio; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("account");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <span className="mx-auto sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/15" />
          <h2 className="text-lg font-bold">Log metrics</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-muted hover:bg-white/5" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-background/60 border border-border">
            {(["account", "post", "lead"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`h-9 rounded-lg text-sm font-semibold ${tab === t ? "bg-surface-hover text-foreground" : "text-muted"}`}
              >
                {t === "account" ? "Account" : t === "post" ? "Post" : "Lead"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!studio.statsReady && tab !== "lead" ? (
            <p className="text-sm text-amber-200">Run BLOQUES 25–27 of PENDIENTE.sql first.</p>
          ) : tab === "account" ? (
            <AccountForm studio={studio} onDone={onClose} />
          ) : tab === "post" ? (
            <PostForm studio={studio} onDone={onClose} />
          ) : !studio.leadsReady ? (
            <p className="text-sm text-amber-200">Run BLOQUE 26 of PENDIENTE.sql (pipeline) first.</p>
          ) : (
            <LeadForm studio={studio} onDone={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: "day" | "period"; onChange: (m: "day" | "period") => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-background/60 border border-border">
      {([
        ["day", "One day"],
        ["period", "Period total"],
      ] as const).map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} className={`h-9 rounded-lg text-sm font-semibold ${mode === k ? "bg-surface-hover text-foreground" : "text-muted"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function PlatformPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {STATS_PLATFORMS.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className={`flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-semibold ${
            value === p.key ? "text-foreground" : "border-border text-muted"
          }`}
          style={value === p.key ? { borderColor: p.color, backgroundColor: `${p.color}22` } : undefined}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.label}
        </button>
      ))}
    </div>
  );
}

function SaveButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-primary hover:bg-primary-hover text-white text-[15px] font-semibold disabled:opacity-40"
    >
      <Check className="w-4 h-4" />
      {label}
    </button>
  );
}

// ---------- account day ----------

const ACCOUNT_FIELDS = [...ACCOUNT_METRICS.map((m) => ({ key: m.key as string, label: m.label })), { key: "followers_total", label: "Followers total" }];

// "Last N days" ending yesterday — how TikTok / Instagram show their totals
const lastDays = (n: number) => ({ from: toISODate(addDays(new Date(), -n)), to: toISODate(addDays(new Date(), -1)) });

function AccountForm({ studio, onDone }: { studio: ContentStudio; onDone: () => void }) {
  const [platform, setPlatform] = useState("tiktok");
  // One day, or the platform's own total for a range (never split into days)
  const [mode, setMode] = useState<"day" | "period">("day");
  // TikTok's numbers for "today" aren't final yet, so default to yesterday
  const [day, setDay] = useState(() => toISODate(addDays(new Date(), -1)));
  const [range, setRange] = useState(() => lastDays(7));
  const existing =
    mode === "day"
      ? studio.accountDaily.find((r) => r.platform === platform && r.day === day)
      : studio.periodTotals.find((r) => r.platform === platform && r.from_day === range.from && r.to_day === range.to);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loadedFor, setLoadedFor] = useState("");
  const key = `${mode}|${platform}|${day}|${range.from}|${range.to}`;
  if (loadedFor !== key) {
    setLoadedFor(key);
    setValues(
      Object.fromEntries(
        ACCOUNT_FIELDS.map((f) => [f.key, toStr(existing?.[f.key as keyof AccountDailyRow & keyof PeriodTotalRow] as number | null)])
      )
    );
  }
  const any = Object.values(values).some((v) => v.trim() !== "");
  const rangeOk = range.from && range.to && range.to >= range.from;

  async function save() {
    const fields = Object.fromEntries(ACCOUNT_FIELDS.map((f) => [f.key, toNum(values[f.key] ?? "")]));
    const ok =
      mode === "day"
        ? await studio.saveAccountDay(platform, day, fields)
        : await studio.savePeriodTotal(platform, range.from, range.to, fields);
    if (ok) onDone();
  }

  if (mode === "period" && !studio.periodTotalsReady) {
    return (
      <div className="space-y-4">
        <ModeToggle mode={mode} onChange={setMode} />
        <p className="text-sm text-amber-200">Run BLOQUE 28 of PENDIENTE.sql to save period totals.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ModeToggle mode={mode} onChange={setMode} />
      <PlatformPicker value={platform} onChange={setPlatform} />
      {mode === "day" ? (
        <div className="space-y-1.5">
          <label className={lbl}>Day</label>
          <input type="date" value={day} max={todayISO()} onChange={(e) => e.target.value && setDay(e.target.value)} className={`${field} [color-scheme:dark]`} />
          {existing && <p className="text-xs text-muted">Already has numbers — saving updates them.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <label className={lbl}>Period (as the app shows it)</label>
          <div className="flex gap-1.5">
            {[7, 28, 30].map((n) => {
              const r = lastDays(n);
              const on = r.from === range.from && r.to === range.to;
              return (
                <button
                  key={n}
                  onClick={() => setRange(r)}
                  className={`flex-1 h-9 rounded-xl border text-xs font-semibold ${on ? "bg-primary/15 border-primary/50 text-foreground" : "border-border text-muted"}`}
                >
                  Last {n} days
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))}
              className={`${field} [color-scheme:dark]`}
              aria-label="From"
            />
            <input
              type="date"
              value={range.to}
              min={range.from}
              max={todayISO()}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))}
              className={`${field} [color-scheme:dark]`}
              aria-label="To"
            />
          </div>
          <p className="text-xs text-muted">
            {existing ? "This range already has a total — saving updates it. " : ""}
            Saved as one total for the whole range; it's never split into days.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {ACCOUNT_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <label className={lbl}>{f.label}</label>
            <input
              inputMode={f.key === "followers_gained" ? "text" : "numeric"}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value.replace(f.key === "followers_gained" ? /[^\d-]/g : /[^\d]/g, "") }))}
              placeholder="—"
              className={`${field} tabular-nums`}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">Leave a field empty if the screen doesn't show it — it's saved as "no data", not 0.</p>
      <SaveButton
        onClick={save}
        disabled={!any || (mode === "period" && !rangeOk)}
        label={mode === "day" ? `Save ${platformLabel(platform)} · ${day}` : `Save ${platformLabel(platform)} total · ${range.from} → ${range.to}`}
      />
    </div>
  );
}

// ---------- post snapshot ----------

function PostForm({ studio, onDone }: { studio: ContentStudio; onDone: () => void }) {
  const pubs = useMemo(
    () =>
      studio.publications
        .filter((p) => p.platform === "tiktok" || p.platform === "instagram")
        .slice()
        .sort((a, b) => b.published_at.localeCompare(a.published_at)),
    [studio.publications]
  );
  const [pubId, setPubId] = useState(pubs[0]?.id ?? "");
  const [day, setDay] = useState(todayISO());
  const [values, setValues] = useState<Record<string, string>>({});
  const [loadedFor, setLoadedFor] = useState("");
  const key = `${pubId}|${day}`;
  if (loadedFor !== key) {
    setLoadedFor(key);
    const snap: PostMetricRow | null = pubId ? latestSnapshot(studio, pubId, day) : null;
    setValues(Object.fromEntries(POST_METRICS.map((m) => [m.key, toStr(snap?.[m.key as PostMetricKey])])));
  }

  if (!pubs.length) {
    return <p className="text-sm text-muted">Nothing is marked as posted on TikTok or Instagram yet. Use "Mark as posted" on a finished piece first.</p>;
  }
  const ideaTitle = (id: string) => studio.ideas.find((i) => i.id === id)?.title ?? "(deleted piece)";

  async function save() {
    const fields = Object.fromEntries(POST_METRICS.map((m) => [m.key, toNum(values[m.key] ?? "")]));
    await studio.savePostMetric(pubId, fields, day);
    onDone();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className={lbl}>Post</label>
        <select value={pubId} onChange={(e) => setPubId(e.target.value)} className={`${field} [color-scheme:dark]`}>
          {pubs.map((p) => (
            <option key={p.id} value={p.id}>
              {platformLabel(p.platform)} · {ideaTitle(p.idea_id).slice(0, 60)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className={lbl}>Numbers as of</label>
        <input type="date" value={day} max={todayISO()} onChange={(e) => e.target.value && setDay(e.target.value)} className={`${field} [color-scheme:dark]`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {POST_METRICS.map((m) => (
          <div key={m.key} className="space-y-1">
            <label className={lbl}>{m.label}</label>
            <input
              inputMode={m.key === "avg_watch_seconds" || m.key === "full_watch_pct" ? "decimal" : "numeric"}
              value={values[m.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [m.key]: e.target.value.replace(/[^\d.,]/g, "") }))}
              placeholder="—"
              className={`${field} tabular-nums`}
            />
          </div>
        ))}
      </div>
      <SaveButton onClick={save} disabled={!pubId} label="Save snapshot" />
    </div>
  );
}

// ---------- lead ----------

function LeadForm({ studio, onDone }: { studio: ContentStudio; onDone: () => void }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [source, setSource] = useState("tiktok");
  const [ideaId, setIdeaId] = useState("");
  const [note, setNote] = useState("");
  const posted = studio.ideas
    .filter((i) => studio.publishedIds.has(i.id))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  async function save() {
    if (!name.trim()) return;
    const ok = await studio.addLead({ name: name.trim(), contact: contact.trim(), source, source_idea_id: ideaId || null, note: note.trim() });
    if (ok) onDone();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className={lbl}>Who</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or @user" className={field} />
      </div>
      <div className="space-y-1.5">
        <label className={lbl}>Contact (optional)</label>
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+58 412… / email" className={field} />
      </div>
      <div className="space-y-1.5">
        <label className={lbl}>Came from</label>
        <div className="grid grid-cols-3 gap-1.5">
          {[...STATS_PLATFORMS.map((p) => ({ key: p.key as string, label: p.label })), { key: "otro", label: "Other" }].map((s) => (
            <button
              key={s.key}
              onClick={() => setSource(s.key)}
              className={`h-11 rounded-xl border text-sm font-semibold ${source === s.key ? "bg-primary/15 border-primary/50 text-foreground" : "border-border text-muted"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <label className={lbl}>Piece (optional)</label>
        <select value={ideaId} onChange={(e) => setIdeaId(e.target.value)} className={`${field} [color-scheme:dark]`}>
          <option value="">— Not sure —</option>
          {posted.map((i) => (
            <option key={i.id} value={i.id}>
              {i.title.slice(0, 70)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className={lbl}>Note (optional)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder='e.g. Commented "GUÍA"' className={field} />
      </div>
      <SaveButton onClick={save} disabled={!name.trim()} label="Add lead to Pipeline" />
      <p className="text-xs text-muted">It's created as a deal in the first Pipeline stage, so the guardian follows it up.</p>
    </div>
  );
}
