// Content Studio module types.
// These mirror the DB rows (snake_case), same approach as
// the motorcycle and medical modules.

// ============================================
// PRODUCTION STATUS STEPS
// ============================================

export type StepKey = "script_done" | "recorded" | "edited";

export interface StatusStep {
  key: StepKey;
  label: string;
}

export const STATUS_STEPS: StatusStep[] = [
  { key: "script_done", label: "Script" },
  { key: "recorded",    label: "Recorded" },
  { key: "edited",      label: "Edited" },
];

// ============================================
// FORMATS (what kind of piece an idea becomes)
// Keys are stored in the DB (and used by the MCP server), so they stay as
// they were; only the labels are shown.
// ============================================

export const FORMATS = [
  { key: "reel",     label: "Reel" },
  { key: "carrusel", label: "Carousel" },
  { key: "post",     label: "Post" },
  { key: "historia", label: "Story" },
  { key: "video",    label: "Long video" },
  { key: "texto",    label: "Blog / text" },
] as const;

export type FormatKey = (typeof FORMATS)[number]["key"];

export function formatLabel(key: string): string {
  return FORMATS.find((f) => f.key === key)?.label ?? "";
}

// ============================================
// STYLES (how a piece is produced) — separate from the format (how it's
// published). Stored in content_ideas.style (BLOQUE 24), '' = not set yet.
// ============================================

export const STYLES = [
  { key: "animado", label: "Animated", color: "#a78bfa" },
  { key: "humano",  label: "Human",    color: "#f59e0b" },
  { key: "noticia", label: "News",     color: "#ef4444" },
  { key: "foto",    label: "Photo",    color: "#22d3ee" },
] as const;

export type StyleKey = (typeof STYLES)[number]["key"];

export function styleOf(key: string) {
  return STYLES.find((s) => s.key === key) ?? null;
}

// ============================================
// CATEGORIES (user-created board columns)
// ============================================

export interface CategoryRow {
  id: string;
  name: string;
  color: string; // hex color for the column accent / card tag
  sort_order: number;
  collapsed: boolean;
}

// ============================================
// CONTENT IDEAS ("piezas" once they have a date)
// ============================================

export interface ContentIdeaRow {
  id: string;
  title: string;
  description: string;
  script: string;              // full script text
  hook: string;                // opening line / gancho
  format: string;              // FormatKey or '' (sin formato)
  style: string;               // StyleKey or '' (not set yet)
  category_id: string | null;  // null = "Sin categoría" column
  sort_order: number;          // position within its category column
  scheduled_date: string | null; // 'YYYY-MM-DD' publish day, null = banco de ideas
  schedule_order: number;      // position within its day in the planner
  do_not_publish: boolean;     // never scheduled / suggested (reveals stack or client process)
  script_done: boolean;
  recorded: boolean;
  edited: boolean;
  created_at: string;
  updated_at: string;
}

// Everything the idea modal edits in one save
export interface IdeaFields {
  title: string;
  description: string;
  script: string;
  hook: string;
  format: string;
  style: string;
  category_id: string | null;
  scheduled_date: string | null;
  script_done: boolean;
  recorded: boolean;
  edited: boolean;
  do_not_publish: boolean;
}

export function isDone(idea: Pick<ContentIdeaRow, StepKey>): boolean {
  return idea.script_done && idea.recorded && idea.edited;
}

export function stepsDone(idea: Pick<ContentIdeaRow, StepKey>): number {
  return [idea.script_done, idea.recorded, idea.edited].filter(Boolean).length;
}

// ============================================
// WEEKLY PLAN
// ============================================

export type WeekStatus = "draft" | "approved" | "done";

export const WEEK_STATUSES: { key: WeekStatus; label: string }[] = [
  { key: "draft",    label: "Draft" },
  { key: "approved", label: "Approved" },
  { key: "done",     label: "Done" },
];

// One row per planned ISO week. Pieces aren't linked to it by id — an idea
// belongs to a week because its scheduled_date falls inside it.
export interface ContentWeekRow {
  id: string;
  week_key: string;  // '2026-W46'
  title: string;     // tema de la semana
  goal: string;      // brief: objetivo, audiencia, ángulo (lo que lee la IA)
  notes: string;
  status: WeekStatus;
  created_at: string;
  updated_at: string;
}

// ============================================
// DATE / ISO WEEK HELPERS
// All dates are local calendar days, kept as 'YYYY-MM-DD' strings so a
// piece never slides a day because of a UTC conversion.
// ============================================

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export function todayISO(): string {
  return toISODate(new Date());
}

// ISO-8601: weeks start Monday, week 1 holds the year's first Thursday.
export function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (t.getDay() + 6) % 7; // Mon=0 … Sun=6
  t.setDate(t.getDate() - day + 3); // Thursday of this week
  const year = t.getFullYear();
  const firstThursday = new Date(year, 0, 4);
  const week =
    1 +
    Math.round(
      ((t.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getDay() + 6) % 7)) /
        7
    );
  return { year, week };
}

export function weekKeyOf(d: Date): string {
  const { year, week } = isoWeek(d);
  return `${year}-W${pad(week)}`;
}

export function weekKeyOfISO(date: string): string {
  return weekKeyOf(parseISODate(date));
}

// Monday of an ISO week key
export function weekStart(key: string): Date {
  const [y, w] = key.split("-W").map(Number);
  const jan4 = new Date(y, 0, 4);
  const mondayW1 = addDays(jan4, -((jan4.getDay() + 6) % 7));
  return addDays(mondayW1, (w - 1) * 7);
}

export function weekDays(key: string): Date[] {
  const start = weekStart(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function shiftWeek(key: string, n: number): string {
  return weekKeyOf(addDays(weekStart(key), n * 7));
}

export function weekNumber(key: string): string {
  return `W${key.split("-W")[1]}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function monthShort(d: Date): string {
  return MONTHS[d.getMonth()];
}

export function dayShort(d: Date): string {
  return DAYS_SHORT[(d.getDay() + 6) % 7];
}

// "Nov 9 – 15, 2026" · "Nov 30 – Dec 6, 2026" · "Dec 28, 2026 – Jan 3, 2027"
export function weekRangeLabel(key: string): string {
  const [a, b] = [weekStart(key), addDays(weekStart(key), 6)];
  if (a.getFullYear() !== b.getFullYear()) {
    return `${monthShort(a)} ${a.getDate()}, ${a.getFullYear()} – ${monthShort(b)} ${b.getDate()}, ${b.getFullYear()}`;
  }
  if (a.getMonth() !== b.getMonth()) {
    return `${monthShort(a)} ${a.getDate()} – ${monthShort(b)} ${b.getDate()}, ${b.getFullYear()}`;
  }
  return `${monthShort(a)} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}`;
}

// "Wed, Nov 12"
export function dateChipLabel(date: string): string {
  const d = parseISODate(date);
  return `${dayShort(d)}, ${monthShort(d)} ${d.getDate()}`;
}

// ============================================
// MONTH CALENDAR HELPERS
// Months are keyed 'YYYY-MM'.
// ============================================

export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function shiftMonth(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  return monthKeyOf(new Date(y, m - 1 + n, 1));
}

// "November 2026"
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

// The Monday-first grid Google Calendar shows for a month: whole weeks from
// the one holding the 1st to the one holding the last day (5 or 6 rows).
export function monthGrid(key: string): Date[][] {
  const [y, m] = key.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  let cursor = addDays(first, -((first.getDay() + 6) % 7));
  const rows: Date[][] = [];
  while (cursor <= last) {
    rows.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
  }
  return rows;
}

// ============================================
// PUBLICATIONS (content_publications, BLOQUE 25)
// One row per piece and platform: where, when, link. A piece is "published"
// once it has a row. Its numbers live in dated snapshots (content_post_metrics).
// ============================================

export const PLATFORMS = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "youtube", label: "YouTube" },
  { key: "otro", label: "Other" },
] as const;

export type PlatformKey = (typeof PLATFORMS)[number]["key"];

export function platformLabel(key: string): string {
  return PLATFORMS.find((p) => p.key === key)?.label ?? key;
}

export interface PublicationRow {
  id: string;
  idea_id: string;
  platform: string;
  published_at: string;
  url: string;
  created_at: string;
}

// ============================================
// ANALYTICS (BLOQUE 27). Every metric is nullable: null = no data, never 0.
// ============================================

// The two networks the stats are about; their series colors were validated
// for the dark surface (dataviz validator: all checks pass, CVD ΔE 11.5)
export const STATS_PLATFORMS = [
  { key: "tiktok", label: "TikTok", color: "#0ea5c6" },
  { key: "instagram", label: "Instagram", color: "#e0457b" },
] as const;
export type StatsPlatform = (typeof STATS_PLATFORMS)[number]["key"];

// One dated snapshot of a publication's numbers (latest = how it's doing now)
export interface PostMetricRow {
  id: string;
  publication_id: string;
  captured_on: string; // YYYY-MM-DD
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  avg_watch_seconds: number | null;
  full_watch_pct: number | null;
  profile_views: number | null;
  follows: number | null;
  source: string;
  updated_at: string;
}

export const POST_METRICS = [
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "saves", label: "Saves" },
  { key: "avg_watch_seconds", label: "Avg watch (s)" },
  { key: "full_watch_pct", label: "Watched full %" },
  { key: "profile_views", label: "Profile views" },
  { key: "follows", label: "Follows" },
] as const;
export type PostMetricKey = (typeof POST_METRICS)[number]["key"];

// Account totals for one day on one platform
export interface AccountDailyRow {
  id: string;
  platform: string;
  day: string; // YYYY-MM-DD
  views: number | null;
  unique_viewers: number | null;
  new_viewers: number | null;
  profile_views: number | null;
  followers_gained: number | null;
  followers_total: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  source: string;
  updated_at: string;
}

export const ACCOUNT_METRICS = [
  { key: "views", label: "Views" },
  { key: "unique_viewers", label: "Unique viewers" },
  { key: "new_viewers", label: "New viewers" },
  { key: "profile_views", label: "Profile views" },
  { key: "followers_gained", label: "Followers gained" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "saves", label: "Saves" },
] as const;
export type AccountMetricKey = (typeof ACCOUNT_METRICS)[number]["key"];

// "Most active times": 0 = Monday … 6 = Sunday, hour in Caracas time
export interface ActiveTimeRow {
  id: string;
  platform: string;
  weekday: number;
  hour: number;
  value: number;
  captured_on: string;
}

// A lead = a pipeline deal whose origin is content (BLOQUE 26 source columns)
export interface ContentLead {
  id: string;
  name: string;
  status: string;
  stage_id: string | null;
  source: string;
  source_idea_id: string | null;
  created_at: string;
}
