// ============================================
// MODULE BOARD
// ============================================

// A user-defined column on the dashboard's module board (e.g. "Trabajo",
// "Personal"). Every module card belongs to exactly one column.
export interface ColumnRow {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  collapsed: boolean;
  created_at: string;
}

// Where one module's card sits: which column and what position within it.
// module_id matches a MODULES entry's id (src/lib/modules.ts); a stale id
// left over from a removed module is simply skipped when rendering.
export interface ModulePositionRow {
  id: string;
  user_id: string;
  module_id: string;
  column_id: string;
  sort_order: number;
  created_at: string;
}

export interface ShortcutRow {
  id: string;
  user_id: string;
  name: string;
  url: string;
  icon_url: string | null; // custom uploaded logo; falls back to auto favicon when null
  sort_order: number;
  created_at: string;
}

// ============================================
// PILL TRACKER
// ============================================

// A pill/medication the user has added to their daily checklist (persists
// across days — it's the checkmark state per day that resets, not this row)
export interface PillItemRow {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

// One row = one item was marked taken on log_date (Venezuela calendar date).
// Unchecking an item deletes its row for that date rather than storing a
// "false" state, so a fresh day naturally starts with nothing checked.
export interface PillLogRow {
  id: string;
  user_id: string;
  item_id: string;
  log_date: string; // YYYY-MM-DD, Venezuela timezone
  created_at: string;
}

// The daily reset is defined by calendar date in the America/Caracas
// timezone, computed client-side — no server-side cron/reset job needed,
// since "today" simply has no log rows yet until something is checked.
export function getVenezuelaDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
  }).format(date);
}
