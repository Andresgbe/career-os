import { supabase } from "../../lib/supabase";
import type { ToBuyCategoryRow, ToBuyItemRow } from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

// ============================================
// CATEGORIES (board columns)
// ============================================

export async function getCategories(): Promise<ToBuyCategoryRow[]> {
  const { data, error } = await supabase
    .from("tobuy_categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addCategory(
  name: string,
  color: string,
  sortOrder: number
): Promise<ToBuyCategoryRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("tobuy_categories")
    .insert({ user_id: user.id, name, color, sort_order: sortOrder })
    .select("*")
    .single();
  if (error) throw error;
  return data as ToBuyCategoryRow;
}

export async function updateCategory(
  id: string,
  fields: Partial<{
    name: string;
    color: string;
    sort_order: number;
    collapsed: boolean;
  }>
): Promise<ToBuyCategoryRow> {
  const { data, error } = await supabase
    .from("tobuy_categories")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ToBuyCategoryRow;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from("tobuy_categories")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// ITEMS
// ============================================

interface ToBuyItemInsert {
  title: string;
  category_id: string | null;
  sort_order: number;
}

export async function getItems(): Promise<ToBuyItemRow[]> {
  const { data, error } = await supabase
    .from("tobuy_items")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addItem(item: ToBuyItemInsert): Promise<ToBuyItemRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("tobuy_items")
    .insert({ user_id: user.id, ...item })
    .select("*")
    .single();
  if (error) throw error;
  return data as ToBuyItemRow;
}

export async function updateItem(
  id: string,
  fields: Partial<ToBuyItemInsert & { checked: boolean }>
): Promise<ToBuyItemRow> {
  const { data, error } = await supabase
    .from("tobuy_items")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ToBuyItemRow;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase
    .from("tobuy_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Persist a drag-and-drop move: which column (category) each moved item
// now belongs to and its new position within that column.
export async function reorderItems(
  order: { id: string; category_id: string | null; sort_order: number }[]
): Promise<void> {
  const results = await Promise.all(
    order.map(({ id, category_id, sort_order }) =>
      supabase
        .from("tobuy_items")
        .update({ category_id, sort_order })
        .eq("id", id)
    )
  );
  for (const { error } of results) if (error) throw error;
}
