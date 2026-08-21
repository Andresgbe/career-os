// Content Planner module types.
// These mirror the DB rows (snake_case), same approach as
// the motorcycle and medical modules.

// ============================================
// PRODUCTION STATUS STEPS
// ============================================

export interface StatusStep {
  key: "script_done" | "recorded" | "edited";
  label: string;
}

export const STATUS_STEPS: StatusStep[] = [
  { key: "script_done", label: "Guion" },
  { key: "recorded",    label: "Grabado" },
  { key: "edited",      label: "Editado" },
];

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
// CONTENT IDEAS
// ============================================

export interface ContentIdeaRow {
  id: string;
  title: string;
  description: string;
  script: string;              // full script text
  category_id: string | null;  // null = "Sin categoría" column
  sort_order: number;          // position within its category column
  script_done: boolean;
  recorded: boolean;
  edited: boolean;
  created_at: string;
  updated_at: string;
}
