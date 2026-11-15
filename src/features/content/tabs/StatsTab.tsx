import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, ClipboardPlus, Sparkles } from "lucide-react";
import type { AccountMetricKey } from "../types";
import { ACCOUNT_METRICS, STATS_PLATFORMS, formatLabel, styleOf, todayISO } from "../types";
import {
  accountTotals,
  activeGrid,
  basisNote,
  comparable,
  shortRange,
  dailySeries,
  delta,
  funnel,
  groupPerf,
  leadsIn,
  periodFor,
  periodLabel,
  pieceStats,
  previousPeriod,
  shiftPeriod,
  topByConversion,
  topByViews,
  topSlots,
  writtenSummary,
} from "../stats";
import type { GroupPerf, Period, PeriodKind, PieceStat, PlatformFilter } from "../stats";
import LogMetricsSheet from "../components/LogMetricsSheet";
import type { ContentStudio } from "../useContentStudio";

const n0 = (v: number) => Math.round(v).toLocaleString("en");
const short = (v: number) => (Math.abs(v) >= 10000 ? `${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k` : n0(v));
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Card({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 space-y-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

const NoData = ({ text = "No data for this period yet." }: { text?: string }) => <p className="text-xs text-muted py-2">{text}</p>;

// Content analytics: account totals vs. the previous period, the conversion
// funnel (views → profile → followers → leads), daily chart, best pieces,
// format/style performance, best times and a written summary. Numbers come
// from the hand/Claude-entered tables of BLOQUE 27; missing ones say "No data".
export default function StatsTab({ studio, onOpenIdea }: { studio: ContentStudio; onOpenIdea: (id: string) => void }) {
  const [kind, setKind] = useState<PeriodKind>("week");
  const [period, setPeriod] = useState<Period>(() => periodFor("week", todayISO()));
  const [platform, setPlatform] = useState<PlatformFilter>("both");
  const [metric, setMetric] = useState<AccountMetricKey>("views");
  const [logOpen, setLogOpen] = useState(false);

  const totals = useMemo(() => accountTotals(studio, period, platform, studio.leadsReady), [studio, period, platform]);
  const prev = useMemo(() => accountTotals(studio, previousPeriod(period), platform, studio.leadsReady), [studio, period, platform]);
  const pieces = useMemo(() => pieceStats(studio, period, platform), [studio, period, platform]);
  const summary = useMemo(() => writtenSummary(studio, period, platform, studio.leadsReady), [studio, period, platform]);

  function changeKind(k: PeriodKind) {
    setKind(k);
    if (k === "range") setPeriod({ kind: "range", from: period.from, to: period.to });
    else setPeriod(periodFor(k, todayISO()));
  }

  const chartPlatforms = platform === "both" ? STATS_PLATFORMS.map((p) => p.key as string) : [platform];
  const series = dailySeries(studio, period, metric, chartPlatforms);
  const { grid, max } = activeGrid(studio, platform);
  const slots = topSlots(grid, 3);
  const leadPieces = leadsIn(studio, period, platform).filter((l) => l.source_idea_id);
  const usedTotals = [
    ...new Set(
      Object.values(totals.basis)
        .flat()
        .filter((b) => b.kind === "total")
        .map((b) => (b.kind === "total" ? `${shortRange(b.from, b.to)}${b.partial ? " (partly outside this period)" : ""}` : ""))
    ),
  ];

  return (
    <div className="space-y-4">
      {/* ===== Period + platform bar (sticky on phones) ===== */}
      <div className="sticky top-[60px] z-20 -mx-4 px-4 sm:mx-0 sm:px-0 py-2 bg-background/90 backdrop-blur space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-0.5 p-1 rounded-xl bg-surface border border-border">
            {(["week", "month", "range"] as const).map((k) => (
              <button
                key={k}
                onClick={() => changeKind(k)}
                className={`px-3 h-8 rounded-lg text-xs font-bold uppercase tracking-wider ${kind === k ? "bg-surface-hover text-foreground" : "text-muted"}`}
              >
                {k === "week" ? "Week" : k === "month" ? "Month" : "Range"}
              </button>
            ))}
          </div>
          {kind === "range" ? (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={period.from}
                max={period.to}
                onChange={(e) => e.target.value && setPeriod({ kind: "range", from: e.target.value, to: period.to })}
                className="h-9 px-2 rounded-xl bg-surface border border-border text-xs [color-scheme:dark]"
              />
              <span className="text-muted text-xs">→</span>
              <input
                type="date"
                value={period.to}
                min={period.from}
                onChange={(e) => e.target.value && setPeriod({ kind: "range", from: period.from, to: e.target.value })}
                className="h-9 px-2 rounded-xl bg-surface border border-border text-xs [color-scheme:dark]"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={() => setPeriod((p) => shiftPeriod(p, -1))} className="w-8 h-8 rounded-lg border border-border bg-surface flex items-center justify-center text-muted" aria-label="Previous">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-1.5 text-sm font-semibold whitespace-nowrap">{periodLabel(period)}</span>
              <button onClick={() => setPeriod((p) => shiftPeriod(p, 1))} className="w-8 h-8 rounded-lg border border-border bg-surface flex items-center justify-center text-muted" aria-label="Next">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          <button
            onClick={() => setLogOpen(true)}
            className="ml-auto flex items-center gap-1.5 h-9 px-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold"
          >
            <ClipboardPlus className="w-4 h-4" />
            Log metrics
          </button>
        </div>
        <div className="flex gap-1">
          {([{ key: "both", label: "Both" }, ...STATS_PLATFORMS] as { key: PlatformFilter; label: string; color?: string }[]).map((p) => (
            <button
              key={p.key}
              onClick={() => setPlatform(p.key)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border ${
                platform === p.key ? "bg-surface-hover border-[#3a3a44] text-foreground" : "border-transparent text-muted"
              }`}
            >
              {p.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />}
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!studio.statsReady && (
        <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          Run BLOQUES 25–27 of PENDIENTE.sql to start loading metrics. Until then every number shows "No data".
        </p>
      )}

      {/* ===== KPI cards ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
        {[
          ...ACCOUNT_METRICS.flatMap((m) => [
            { key: m.key as AccountMetricKey | "leads" | "followers_total", label: m.label },
            ...(m.key === "followers_gained" ? [{ key: "followers_total" as const, label: "Followers" }] : []),
          ]),
          { key: "leads" as const, label: "Leads" },
        ].map((m) => {
          // Followers is the latest total (with its date), never a sum
          if (m.key === "followers_total") {
            const fv = totals.followers.value;
            return (
              <div key={m.key} className="rounded-2xl border border-border bg-surface px-3.5 py-3">
                <p className="text-[12px] text-muted truncate">{m.label}</p>
                {fv === null ? (
                  <p className="text-sm font-semibold text-muted mt-2">No data</p>
                ) : (
                  <p className="text-[24px] font-extrabold tabular-nums leading-none tracking-tight mt-1.5">{n0(fv)}</p>
                )}
                <p className="mt-1.5 h-4 text-[11px] text-muted truncate">
                  {totals.followers.asOf && `as of ${new Date(`${totals.followers.asOf}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" })}`}
                </p>
              </div>
            );
          }
          const v = totals.values[m.key];
          const d =
            m.key === "leads" || comparable(totals.basis[m.key], prev.basis[m.key]) ? delta(v, prev.values[m.key]) : null;
          const note = m.key === "leads" ? "" : basisNote(totals.basis[m.key]);
          return (
            <div key={m.key} className="rounded-2xl border border-border bg-surface px-3.5 py-3">
              <p className="text-[12px] text-muted truncate">{m.label}</p>
              {v === null ? (
                <p className="text-sm font-semibold text-muted mt-2">No data</p>
              ) : (
                <p className="text-[24px] font-extrabold tabular-nums leading-none tracking-tight mt-1.5">{short(v)}</p>
              )}
              <div className="mt-1.5 h-4 text-[11px] tabular-nums">
                {d !== null ? (
                  <span className={`inline-flex items-center gap-0.5 font-semibold ${d >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                    {d >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {d >= 0 ? "+" : ""}
                    {Math.round(d * 100)}% vs prev.
                  </span>
                ) : (
                  v !== null && <span className="text-muted">no previous data</span>
                )}
              </div>
              {note && (
                <p className="mt-1 text-[10.5px] font-semibold text-primary-hover truncate" title={`${note}. A platform total, not a sum of days.`}>
                  {note}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {totals.daysWithData > 0 && totals.daysWithData < totals.daysInPeriod && (
        <p className="text-[11px] text-muted -mt-2">
          Account numbers loaded for {totals.daysWithData} of {totals.daysInPeriod} days — sums only count those days.
        </p>
      )}
      {usedTotals.length > 0 && (
        <p className="text-[11px] text-muted -mt-2">
          Cards marked "Period total" use the platform's own total for {usedTotals.join(", ")} — shown as is, not split into
          days.
        </p>
      )}

      <div className="grid lg:grid-cols-2 gap-3">
        {/* ===== Funnel ===== */}
        <Card title="Conversion funnel">
          <FunnelView totals={totals} />
        </Card>

        {/* ===== Written summary ===== */}
        <Card title="Summary" right={<Sparkles className="w-4 h-4 text-primary-hover" />}>
          {summary.length ? (
            <ul className="space-y-2">
              {summary.map((l, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed">
                  <span className="mt-2 w-1.5 h-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="text-foreground/90">{l}</span>
                </li>
              ))}
            </ul>
          ) : (
            <NoData text="Load some numbers and the summary writes itself. For a deeper read, ask Claude in the chat (it uses get_analytics_summary)." />
          )}
        </Card>
      </div>

      {/* ===== Daily chart ===== */}
      <Card
        title="By day"
        right={
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as AccountMetricKey)}
            className="h-8 px-2 rounded-lg bg-background border border-border text-xs [color-scheme:dark]"
          >
            {ACCOUNT_METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        }
      >
        <DailyChart
          series={series}
          platforms={chartPlatforms}
          emptyText={
            usedTotals.length
              ? "Only period totals for these dates — no daily breakdown to chart."
              : undefined
          }
        />
      </Card>

      {/* ===== Top pieces ===== */}
      <div className="grid lg:grid-cols-2 gap-3">
        <Card title="Top 5 by views">
          <PieceList pieces={topByViews(pieces)} value={(x) => (x.views === null ? "—" : `${short(x.views)} views`)} onOpen={onOpenIdea} studio={studio} />
        </Card>
        <Card title="Top 5 by conversion">
          <PieceList
            pieces={topByConversion(pieces)}
            value={(x) => `${x.conversion!.toFixed(1)} / 1k ${x.conversionBasis === "profile" ? "profile" : "follows+leads"}`}
            onOpen={onOpenIdea}
            studio={studio}
          />
        </Card>
      </div>

      {/* ===== Format / style ===== */}
      <div className="grid lg:grid-cols-2 gap-3">
        <Card title="By format · average per piece">
          <GroupTable rows={groupPerf(pieces, "format")} />
        </Card>
        <Card title="By style · average per piece">
          <GroupTable rows={groupPerf(pieces, "style")} />
        </Card>
      </div>

      {/* ===== Best times ===== */}
      <Card title="Best times to post" right={<span className="text-[11px] text-muted">Caracas time</span>}>
        {max === 0 ? (
          <NoData text='Load "Most active times" from TikTok (or ask Claude to read the screenshot).' />
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {slots.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-primary/15 text-primary-hover text-xs font-semibold">
                  #{i + 1} {DAYS[s.weekday]} {s.hour}:00
                </span>
              ))}
            </div>
            <div className="overflow-x-auto -mx-1 px-1">
              <div className="min-w-[620px]">
                <div className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-[2px] text-[9.5px] text-muted mb-1">
                  <span />
                  {Array.from({ length: 24 }, (_, h) => (
                    <span key={h} className="text-center">
                      {h % 3 === 0 ? h : ""}
                    </span>
                  ))}
                </div>
                {grid.map((row, d) => (
                  <div key={d} className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-[2px] mb-[2px]">
                    <span className="text-[10.5px] text-muted self-center">{DAYS[d]}</span>
                    {row.map((v, h) => (
                      <span
                        key={h}
                        title={`${DAYS[d]} ${h}:00 — ${v === null ? "no data" : n0(v)}`}
                        className={`h-5 rounded-[3px] ${v === null ? "border border-dashed border-border/60" : ""}`}
                        style={v === null ? undefined : { backgroundColor: "var(--color-primary)", opacity: 0.12 + 0.88 * (v / max) }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Card>

      {/* ===== Leads by piece ===== */}
      <Card title="Leads by piece">
        {!studio.leadsReady ? (
          <NoData text="Run BLOQUE 26 of PENDIENTE.sql (pipeline) to count leads." />
        ) : leadPieces.length === 0 ? (
          <NoData text="No lead in this period is linked to a piece. Log one with “Log metrics → Lead”, or set the source on a deal in Pipeline." />
        ) : (
          <ul className="divide-y divide-border">
            {Object.entries(
              leadPieces.reduce<Record<string, string[]>>((acc, l) => ({ ...acc, [l.source_idea_id!]: [...(acc[l.source_idea_id!] ?? []), l.name] }), {})
            )
              .sort((a, b) => b[1].length - a[1].length)
              .map(([ideaId, names]) => {
                const idea = studio.ideas.find((i) => i.id === ideaId);
                return (
                  <li key={ideaId} className="flex items-center gap-3 py-2">
                    <span className="w-8 h-8 rounded-lg bg-primary/15 text-primary-hover text-sm font-bold flex items-center justify-center tabular-nums">
                      {names.length}
                    </span>
                    <span className="min-w-0 flex-1">
                      <button onClick={() => idea && onOpenIdea(ideaId)} className="block text-sm font-medium truncate text-left hover:text-primary-hover">
                        {idea?.title ?? "(deleted piece)"}
                      </button>
                      <span className="block text-[11px] text-muted truncate">{names.join(", ")}</span>
                    </span>
                  </li>
                );
              })}
          </ul>
        )}
      </Card>

      {logOpen && <LogMetricsSheet studio={studio} onClose={() => setLogOpen(false)} />}
    </div>
  );
}

// ---------- pieces ----------

function FunnelView({ totals }: { totals: ReturnType<typeof accountTotals> }) {
  const steps = funnel(totals);
  if (!steps.length) return <NoData text="Load account views to see the funnel." />;
  const top = steps[0].value || 1;
  return (
    <ol className="space-y-2.5">
      {steps.map((s) => (
        <li key={s.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-muted">{s.label}</span>
            <span className="tabular-nums">
              <span className="font-semibold">{n0(s.value!)}</span>
              {s.rateFromPrev !== null && <span className="text-muted text-xs"> · {(s.rateFromPrev * 100).toFixed(1)}% of previous</span>}
            </span>
          </div>
          <span className="block h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(1.5, ((s.value ?? 0) / top) * 100)}%` }} />
          </span>
        </li>
      ))}
      {steps.length < 4 && (
        <li className="text-[11px] text-muted">
          The funnel stops at {steps[steps.length - 1].label.toLowerCase()}: the next step has no data in this period.
        </li>
      )}
    </ol>
  );
}

function DailyChart({
  series,
  platforms,
  emptyText,
}: {
  series: ReturnType<typeof dailySeries>;
  platforms: string[];
  emptyText?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const values = series.flatMap((d) => platforms.map((p) => d.values[p])).filter((v): v is number => v !== null);
  if (!values.length) return <NoData text={emptyText} />;
  const W = 640;
  const H = 200;
  const pad = { l: 40, r: 12, t: 12, b: 24 };
  const maxV = Math.max(1, ...values);
  const minV = Math.min(0, ...values);
  const x = (i: number) => pad.l + (series.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (series.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - minV) / (maxV - minV || 1)) * (H - pad.t - pad.b);
  const color = (p: string) => STATS_PLATFORMS.find((s) => s.key === p)?.color ?? "var(--color-primary)";
  const ticks = [minV, (minV + maxV) / 2, maxV];
  const labelEvery = Math.max(1, Math.ceil(series.length / 7));

  // A line breaks where a day has no data instead of drawing through a fake 0
  const paths = (p: string) => {
    const segs: string[] = [];
    let cur = "";
    series.forEach((d, i) => {
      const v = d.values[p];
      if (v === null) {
        if (cur) segs.push(cur);
        cur = "";
      } else cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    });
    if (cur) segs.push(cur);
    return segs;
  };

  return (
    <div className="space-y-2">
      {platforms.length > 1 && (
        <div className="flex gap-3 text-xs">
          {platforms.map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5 text-muted">
              <span className="w-3 h-[2px] rounded" style={{ backgroundColor: color(p) }} />
              {STATS_PLATFORMS.find((s) => s.key === p)?.label}
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Daily chart">
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-border)" strokeDasharray={i === 0 ? undefined : "3 4"} />
              <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--color-muted)">
                {short(t)}
              </text>
            </g>
          ))}
          {series.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d.day} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-muted)">
                {Number(d.day.slice(8))}
              </text>
            ) : null
          )}
          {active !== null && <line x1={x(active)} x2={x(active)} y1={pad.t} y2={H - pad.b} stroke="var(--color-muted)" strokeOpacity="0.4" />}
          {platforms.map((p) =>
            paths(p).map((d, i) => <path key={`${p}-${i}`} d={d} fill="none" stroke={color(p)} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />)
          )}
          {platforms.map((p) =>
            series.map((d, i) => {
              const v = d.values[p];
              if (v === null) return null;
              const isolated = series[i - 1]?.values[p] == null && series[i + 1]?.values[p] == null;
              return (active === i || isolated) ? (
                <circle key={`${p}-${i}`} cx={x(i)} cy={y(v)} r="4" fill={color(p)} stroke="var(--color-surface)" strokeWidth="2" />
              ) : null;
            })
          )}
          {/* hit targets wider than the marks: one band per day */}
          {series.map((d, i) => (
            <rect
              key={d.day}
              x={x(i) - (W - pad.l - pad.r) / Math.max(1, series.length - 1) / 2}
              y={0}
              width={(W - pad.l - pad.r) / Math.max(1, series.length - 1)}
              height={H}
              fill="transparent"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onClick={() => setActive(i)}
            />
          ))}
        </svg>
        {active !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-border bg-background/95 px-2.5 py-1.5 text-xs shadow-xl whitespace-nowrap"
            style={{ left: `${(x(active) / W) * 100}%` }}
          >
            <p className="font-semibold">{new Date(`${series[active].day}T12:00:00`).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}</p>
            {platforms.map((p) => (
              <p key={p} className="flex items-center gap-1.5 tabular-nums text-muted">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color(p) }} />
                {STATS_PLATFORMS.find((s) => s.key === p)?.label}:{" "}
                <span className="text-foreground font-semibold">{series[active].values[p] === null ? "no data" : n0(series[active].values[p]!)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PieceList({
  pieces,
  value,
  onOpen,
  studio,
}: {
  pieces: PieceStat[];
  value: (x: PieceStat) => string;
  onOpen: (id: string) => void;
  studio: ContentStudio;
}) {
  if (!pieces.length) return <NoData text="No piece posted in this period has these numbers yet." />;
  return (
    <ol className="space-y-1">
      {pieces.map((x, i) => {
        const cat = studio.categories.find((c) => c.id === x.idea.category_id);
        const style = styleOf(x.idea.style);
        return (
          <li key={x.idea.id}>
            <button onClick={() => onOpen(x.idea.id)} className="w-full flex items-start gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-white/[0.03]">
              <span className="w-6 text-sm font-bold text-muted tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium truncate">{x.idea.title}</span>
                <span className="flex items-center gap-1.5 flex-wrap mt-0.5 text-[11px] text-muted">
                  <span>{formatLabel(x.idea.format) || "No format"}</span>
                  <span>·</span>
                  {style ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.color }} />
                      {style.label}
                    </span>
                  ) : (
                    <span>No style</span>
                  )}
                  {cat && (
                    <>
                      <span>·</span>
                      <span className="truncate max-w-[120px]">{cat.name}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>{new Date(`${x.publishedOn}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" })}</span>
                </span>
              </span>
              <span className="text-xs font-semibold tabular-nums whitespace-nowrap text-right">{value(x)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function GroupTable({ rows }: { rows: GroupPerf[] }) {
  const withData = rows.filter((r) => r.avgViews !== null);
  if (!withData.length) return <NoData />;
  const max = Math.max(1, ...withData.map((r) => r.avgViews!));
  const cell = (v: number | null) => (v === null ? <span className="text-muted">—</span> : short(v));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-sm">
        <thead>
          <tr className="text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">
            <th className="py-1.5 pr-2">Group</th>
            <th className="py-1.5 px-2 text-right">Views</th>
            <th className="py-1.5 px-2 text-right">Comm.</th>
            <th className="py-1.5 pl-2 text-right">Shares</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key || "none"} className="border-t border-border/60" title={`${r.pieces} pieces`}>
              <td className="py-2 pr-2">
                <span className="block truncate max-w-[130px]">{r.label}</span>
                {r.avgViews !== null && (
                  <span className="block h-1 mt-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(r.avgViews / max) * 100}%` }} />
                  </span>
                )}
              </td>
              <td className="py-2 px-2 text-right tabular-nums font-semibold">{cell(r.avgViews)}</td>
              <td className="py-2 px-2 text-right tabular-nums">{cell(r.avgComments)}</td>
              <td className="py-2 pl-2 text-right tabular-nums">{cell(r.avgShares)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-muted mt-2">
        <BarChart3 className="inline w-3 h-3 mr-1" />
        Average of the latest numbers of each piece posted in the period.
      </p>
    </div>
  );
}
