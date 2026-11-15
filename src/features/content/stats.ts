// Content analytics engine: pure functions over the rows the store loads.
// Rule everywhere: a metric nobody entered is null ("no data"), never 0.
// Totals only sum values that exist; a total with no values at all is null.
import type {
  AccountDailyRow,
  AccountMetricKey,
  ActiveTimeRow,
  ContentIdeaRow,
  ContentLead,
  PostMetricRow,
  PublicationRow,
} from "./types";
import { ACCOUNT_METRICS, addDays, formatLabel, parseISODate, styleOf, toISODate, weekKeyOf, weekStart } from "./types";

export interface StatsData {
  ideas: ContentIdeaRow[];
  publications: PublicationRow[];
  postMetrics: PostMetricRow[];
  accountDaily: AccountDailyRow[];
  activeTimes: ActiveTimeRow[];
  leads: ContentLead[];
}

export type PlatformFilter = "both" | "tiktok" | "instagram";
export type PeriodKind = "week" | "month" | "range";

export interface Period {
  kind: PeriodKind;
  from: string; // YYYY-MM-DD, inclusive
  to: string; // YYYY-MM-DD, inclusive
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---------- periods ----------

export function periodFor(kind: PeriodKind, anchor: string, rangeTo?: string): Period {
  const d = parseISODate(anchor);
  if (kind === "week") {
    const start = weekStart(weekKeyOf(d));
    return { kind, from: toISODate(start), to: toISODate(addDays(start, 6)) };
  }
  if (kind === "month") {
    return {
      kind,
      from: toISODate(new Date(d.getFullYear(), d.getMonth(), 1)),
      to: toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    };
  }
  const to = rangeTo && rangeTo >= anchor ? rangeTo : anchor;
  return { kind, from: anchor, to };
}

export function daysOf(p: Period): string[] {
  const out: string[] = [];
  for (let d = parseISODate(p.from); toISODate(d) <= p.to; d = addDays(d, 1)) out.push(toISODate(d));
  return out;
}

// The same-length period right before (previous week / month / range)
export function previousPeriod(p: Period): Period {
  if (p.kind === "month") {
    const d = parseISODate(p.from);
    return periodFor("month", toISODate(new Date(d.getFullYear(), d.getMonth() - 1, 1)));
  }
  const len = daysOf(p).length;
  return { kind: p.kind, from: toISODate(addDays(parseISODate(p.from), -len)), to: toISODate(addDays(parseISODate(p.from), -1)) };
}

export function shiftPeriod(p: Period, dir: 1 | -1): Period {
  if (p.kind === "month") {
    const d = parseISODate(p.from);
    return periodFor("month", toISODate(new Date(d.getFullYear(), d.getMonth() + dir, 1)));
  }
  const len = daysOf(p).length;
  return { kind: p.kind, from: toISODate(addDays(parseISODate(p.from), dir * len)), to: toISODate(addDays(parseISODate(p.to), dir * len)) };
}

export function periodLabel(p: Period): string {
  const a = parseISODate(p.from);
  const b = parseISODate(p.to);
  if (p.kind === "month") return `${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
  const left = `${MONTHS[a.getMonth()]} ${a.getDate()}`;
  const right = a.getMonth() === b.getMonth() ? `${b.getDate()}` : `${MONTHS[b.getMonth()]} ${b.getDate()}`;
  return `${left} – ${right}, ${b.getFullYear()}`;
}

const localDay = (iso: string) => toISODate(new Date(iso));
const inPeriod = (day: string, p: Period) => day >= p.from && day <= p.to;
const platformOk = (platform: string, f: PlatformFilter) => f === "both" || platform === f;

function sumOrNull(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
}

function avgOrNull(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

// ---------- account totals ----------

export interface Totals {
  values: Record<AccountMetricKey | "leads", number | null>;
  daysWithData: number;
  daysInPeriod: number;
}

export function leadsIn(data: StatsData, p: Period, f: PlatformFilter): ContentLead[] {
  return data.leads.filter(
    (l) => inPeriod(localDay(l.created_at), p) && (f === "both" || l.source === f)
  );
}

export function accountTotals(data: StatsData, p: Period, f: PlatformFilter, leadsReady: boolean): Totals {
  const rows = data.accountDaily.filter((r) => platformOk(r.platform, f) && inPeriod(r.day, p));
  const values = Object.fromEntries(
    ACCOUNT_METRICS.map((m) => [m.key, sumOrNull(rows.map((r) => r[m.key]))])
  ) as Record<AccountMetricKey, number | null>;
  return {
    values: { ...values, leads: leadsReady ? leadsIn(data, p, f).length : null },
    daysWithData: new Set(rows.map((r) => r.day)).size,
    daysInPeriod: daysOf(p).length,
  };
}

// Relative change; null when either side has no data or the base is 0
export function delta(now: number | null, before: number | null): number | null {
  if (now === null || before === null || before === 0) return null;
  return (now - before) / Math.abs(before);
}

// ---------- funnel ----------

export interface FunnelStep {
  key: string;
  label: string;
  value: number | null;
  rateFromPrev: number | null; // share of the previous step that reached this one
}

// views → profile views → followers → leads. Stops at the first step with
// no data instead of showing a made-up 0.
export function funnel(t: Totals): FunnelStep[] {
  const raw = [
    { key: "views", label: "Views", value: t.values.views },
    { key: "profile_views", label: "Profile views", value: t.values.profile_views },
    { key: "followers_gained", label: "Followers", value: t.values.followers_gained },
    { key: "leads", label: "Leads", value: t.values.leads },
  ];
  const out: FunnelStep[] = [];
  for (const [i, s] of raw.entries()) {
    if (s.value === null) break;
    const prev = i > 0 ? raw[i - 1].value : null;
    out.push({ ...s, rateFromPrev: prev ? s.value / prev : null });
  }
  return out;
}

// ---------- daily series ----------

export function dailySeries(
  data: StatsData,
  p: Period,
  metric: AccountMetricKey,
  platforms: string[]
): { day: string; values: Record<string, number | null> }[] {
  return daysOf(p).map((day) => ({
    day,
    values: Object.fromEntries(
      platforms.map((pl) => {
        const row = data.accountDaily.find((r) => r.platform === pl && r.day === day);
        return [pl, row ? row[metric] : null];
      })
    ),
  }));
}

// ---------- pieces ----------

export function latestSnapshot(data: StatsData, publicationId: string, upTo?: string): PostMetricRow | null {
  let best: PostMetricRow | null = null;
  for (const m of data.postMetrics) {
    if (m.publication_id !== publicationId) continue;
    if (upTo && m.captured_on > upTo) continue;
    if (!best || m.captured_on > best.captured_on) best = m;
  }
  return best;
}

export interface PieceStat {
  idea: ContentIdeaRow;
  publishedOn: string; // first publication date in the filter
  platforms: string[];
  views: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  follows: number | null;
  profileViews: number | null;
  leads: number;
  conversion: number | null; // per 1,000 views
  conversionBasis: "follows+leads" | "profile" | null;
}

// Pieces with a publication (on the filtered platform) inside the period,
// each with the latest numbers of its publications summed across platforms.
export function pieceStats(data: StatsData, p: Period, f: PlatformFilter): PieceStat[] {
  const byIdea = new Map<string, PublicationRow[]>();
  for (const pub of data.publications) {
    if (!platformOk(pub.platform, f) || !inPeriod(localDay(pub.published_at), p)) continue;
    byIdea.set(pub.idea_id, [...(byIdea.get(pub.idea_id) ?? []), pub]);
  }
  const out: PieceStat[] = [];
  for (const [ideaId, pubs] of byIdea) {
    const idea = data.ideas.find((i) => i.id === ideaId);
    if (!idea) continue;
    const snaps = pubs.map((pub) => latestSnapshot(data, pub.id)).filter((s): s is PostMetricRow => !!s);
    const views = sumOrNull(snaps.map((s) => s.views));
    const follows = sumOrNull(snaps.map((s) => s.follows));
    const profileViews = sumOrNull(snaps.map((s) => s.profile_views));
    const leads = data.leads.filter((l) => l.source_idea_id === ideaId && (f === "both" || !l.source || l.source === f)).length;
    let conversion: number | null = null;
    let basis: PieceStat["conversionBasis"] = null;
    if (views) {
      if (follows !== null || leads > 0) {
        conversion = (((follows ?? 0) + leads) / views) * 1000;
        basis = "follows+leads";
      } else if (profileViews !== null) {
        conversion = (profileViews / views) * 1000;
        basis = "profile";
      }
    }
    out.push({
      idea,
      publishedOn: pubs.map((x) => localDay(x.published_at)).sort()[0],
      platforms: [...new Set(pubs.map((x) => x.platform))],
      views,
      comments: sumOrNull(snaps.map((s) => s.comments)),
      shares: sumOrNull(snaps.map((s) => s.shares)),
      saves: sumOrNull(snaps.map((s) => s.saves)),
      follows,
      profileViews,
      leads,
      conversion,
      conversionBasis: basis,
    });
  }
  return out;
}

export const topByViews = (pieces: PieceStat[], n = 5) =>
  pieces.filter((x) => x.views !== null).sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, n);

export const topByConversion = (pieces: PieceStat[], n = 5) =>
  pieces.filter((x) => x.conversion !== null).sort((a, b) => (b.conversion ?? 0) - (a.conversion ?? 0)).slice(0, n);

export interface GroupPerf {
  key: string;
  label: string;
  pieces: number;
  avgViews: number | null;
  avgComments: number | null;
  avgShares: number | null;
}

export function groupPerf(pieces: PieceStat[], by: "format" | "style"): GroupPerf[] {
  const groups = new Map<string, PieceStat[]>();
  for (const x of pieces) {
    const key = by === "format" ? x.idea.format : x.idea.style;
    groups.set(key, [...(groups.get(key) ?? []), x]);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({
      key,
      label: by === "format" ? formatLabel(key) || "No format" : styleOf(key)?.label ?? "No style",
      pieces: list.length,
      avgViews: avgOrNull(list.map((x) => x.views)),
      avgComments: avgOrNull(list.map((x) => x.comments)),
      avgShares: avgOrNull(list.map((x) => x.shares)),
    }))
    .sort((a, b) => (b.avgViews ?? -1) - (a.avgViews ?? -1));
}

// ---------- active times ----------

export function activeGrid(data: StatsData, f: PlatformFilter): { grid: (number | null)[][]; max: number; platforms: string[] } {
  const rows = data.activeTimes.filter((r) => platformOk(r.platform, f));
  const grid: (number | null)[][] = Array.from({ length: 7 }, () => Array<number | null>(24).fill(null));
  for (const r of rows) grid[r.weekday][r.hour] = (grid[r.weekday][r.hour] ?? 0) + r.value;
  const max = Math.max(0, ...grid.flat().map((v) => v ?? 0));
  return { grid, max, platforms: [...new Set(rows.map((r) => r.platform))] };
}

export function topSlots(grid: (number | null)[][], n = 3): { weekday: number; hour: number; value: number }[] {
  const cells: { weekday: number; hour: number; value: number }[] = [];
  grid.forEach((row, weekday) => row.forEach((value, hour) => value !== null && cells.push({ weekday, hour, value })));
  return cells.sort((a, b) => b.value - a.value).slice(0, n);
}

// ---------- written summary ----------

const n0 = (v: number) => Math.round(v).toLocaleString("en");
const pct = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`;
const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// 3–5 plain lines built only from the numbers that exist
export function writtenSummary(
  data: StatsData,
  p: Period,
  f: PlatformFilter,
  leadsReady: boolean
): string[] {
  const now = accountTotals(data, p, f, leadsReady);
  const before = accountTotals(data, previousPeriod(p), f, leadsReady);
  const pieces = pieceStats(data, p, f);
  const unit = p.kind === "month" ? "month" : p.kind === "week" ? "week" : "period";
  const lines: string[] = [];

  const v = now.values.views;
  if (v !== null) {
    const d = delta(v, before.values.views);
    lines.push(`Views: ${n0(v)}${d !== null ? ` (${pct(d)} vs. the previous ${unit})` : ""}.`);
  }

  const styles = groupPerf(pieces, "style").filter((g) => g.avgViews !== null && g.key);
  if (styles.length >= 2) {
    const best = styles[0];
    const worst = styles[styles.length - 1];
    lines.push(`What worked: ${best.label.toLowerCase()} pieces averaged ${n0(best.avgViews!)} views; ${worst.label.toLowerCase()} ones only ${n0(worst.avgViews!)}.`);
  } else if (styles.length === 1) {
    lines.push(`Only ${styles[0].label.toLowerCase()} pieces have numbers so far (${n0(styles[0].avgViews!)} views on average).`);
  }

  const pv = now.values.profile_views;
  const fg = now.values.followers_gained;
  if (v && pv !== null && fg !== null && pv > 0) {
    lines.push(`Conversion: ${((pv / v) * 100).toFixed(1)}% of views visited the profile and ${((fg / pv) * 100).toFixed(1)}% of those followed.`);
  }

  if (leadsReady) {
    const ls = leadsIn(data, p, f);
    const fromPieces = ls.filter((l) => l.source_idea_id);
    if (ls.length === 0) lines.push(`No leads came from content this ${unit}.`);
    else {
      const top = pieces.filter((x) => x.leads > 0).sort((a, b) => b.leads - a.leads)[0];
      lines.push(
        `${ls.length} ${ls.length === 1 ? "lead" : "leads"} from content${top ? `, most from "${top.idea.title}"` : fromPieces.length ? "" : " (no piece attached)"}.`
      );
    }
  }

  const topPiece = topByConversion(pieces, 1)[0] ?? topByViews(pieces, 1)[0];
  const slot = topSlots(activeGrid(data, f).grid, 1)[0];
  if (topPiece) {
    const what = [formatLabel(topPiece.idea.format), styleOf(topPiece.idea.style)?.label].filter(Boolean).join(" · ");
    lines.push(`Repeat next ${unit}: more like "${topPiece.idea.title}"${what ? ` (${what})` : ""}${slot ? `, posted around ${DAY[slot.weekday]} ${slot.hour}:00` : ""}.`);
  } else if (slot) {
    lines.push(`Best time to post so far: ${DAY[slot.weekday]} around ${slot.hour}:00.`);
  }
  return lines.slice(0, 5);
}

// Plain-text block for the "Plan with AI" prompt (last 28 days)
export function metricsSummary(data: StatsData): string {
  const to = toISODate(new Date());
  const p: Period = { kind: "range", from: toISODate(addDays(new Date(), -27)), to };
  const lines = writtenSummary(data, p, "both", true).filter((l) => !l.startsWith("No leads"));
  const styles = groupPerf(pieceStats(data, p, "both"), "style").filter((g) => g.avgViews !== null);
  if (!lines.length && !styles.length) return "";
  return ["Content metrics, last 28 days (entered by hand; missing numbers are left out):", ...lines.map((l) => `- ${l}`)].join("\n");
}
