// To Buy module types.
// Same shape as the Content module's category board: categories act as
// Kanban columns, items are draggable rows within a column.

export interface ToBuyCategoryRow {
  id: string;
  name: string;
  color: string; // column accent color
  sort_order: number;
  collapsed: boolean;
}

export interface ToBuyItemRow {
  id: string;
  title: string;
  checked: boolean;            // bought / done
  category_id: string | null;  // null = "Sin categoría" column
  sort_order: number;          // position within its category column
  created_at: string;
  updated_at: string;
}
