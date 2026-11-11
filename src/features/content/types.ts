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
  { key: "script_done", label: "Guion" },
  { key: "recorded",    label: "Grabado" },
  { key: "edited",      label: "Editado" },
];

// ============================================
// FORMATS (what kind of piece an idea becomes)
// ============================================

export const FORMATS = [
  { key: "reel",     label: "Reel" },
  { key: "carrusel", label: "Carrusel" },
  { key: "post",     label: "Post" },
  { key: "historia", label: "Historia" },
  { key: "video",    label: "Video largo" },
  { key: "texto",    label: "Texto / hilo" },
] as const;

export type FormatKey = (typeof FORMATS)[number]["key"];

export function formatLabel(key: string): string {
  return FORMATS.find((f) => f.key === key)?.label ?? "";
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
  category_id: string | null;  // null = "Sin categoría" column
  sort_order: number;          // position within its category column
  scheduled_date: string | null; // 'YYYY-MM-DD' publish day, null = banco de ideas
  schedule_order: number;      // position within its day in the planner
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
  category_id: string | null;
  scheduled_date: string | null;
  script_done: boolean;
  recorded: boolean;
  edited: boolean;
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
  { key: "draft",    label: "Borrador" },
  { key: "approved", label: "Aprobada" },
  { key: "done",     label: "Completada" },
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

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DAYS_SHORT = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

export function monthShort(d: Date): string {
  return MONTHS[d.getMonth()];
}

export function dayShort(d: Date): string {
  return DAYS_SHORT[(d.getDay() + 6) % 7];
}

// "9 al 15 nov 2026" · "30 nov al 6 dic 2026" · "29 dic 2026 al 4 ene 2027"
export function weekRangeLabel(key: string): string {
  const [a, b] = [weekStart(key), addDays(weekStart(key), 6)];
  if (a.getFullYear() !== b.getFullYear()) {
    return `${a.getDate()} ${monthShort(a)} ${a.getFullYear()} al ${b.getDate()} ${monthShort(b)} ${b.getFullYear()}`;
  }
  if (a.getMonth() !== b.getMonth()) {
    return `${a.getDate()} ${monthShort(a)} al ${b.getDate()} ${monthShort(b)} ${b.getFullYear()}`;
  }
  return `${a.getDate()} al ${b.getDate()} ${monthShort(b)} ${b.getFullYear()}`;
}

// "mié 12 nov"
export function dateChipLabel(date: string): string {
  const d = parseISODate(date);
  return `${dayShort(d)} ${d.getDate()} ${monthShort(d)}`;
}
