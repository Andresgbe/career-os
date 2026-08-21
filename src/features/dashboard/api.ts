import { supabase } from "../../lib/supabase";
import type {
  ShortcutRow,
  PillItemRow,
  PillLogRow,
  ColumnRow,
  ModulePositionRow,
} from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

// ============================================
// MODULE BOARD
// ============================================

export async function getColumns(): Promise<ColumnRow[]> {
  const { data, error } = await supabase
    .from("dashboard_columns")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addColumn(name: string, sortOrder: number): Promise<ColumnRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("dashboard_columns")
    .insert({ user_id: user.id, name, sort_order: sortOrder })
    .select("*")
    .single();
  if (error) throw error;
  return data as ColumnRow;
}

export async function updateColumn(
  id: string,
  fields: Partial<{ name: string; collapsed: boolean; sort_order: number }>
): Promise<void> {
  const { error } = await supabase.from("dashboard_columns").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteColumn(id: string): Promise<void> {
  const { error } = await supabase.from("dashboard_columns").delete().eq("id", id);
  if (error) throw error;
}

export async function getModulePositions(): Promise<ModulePositionRow[]> {
  const { data, error } = await supabase
    .from("dashboard_module_positions")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addModulePosition(
  moduleId: string,
  columnId: string,
  sortOrder: number
): Promise<ModulePositionRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("dashboard_module_positions")
    .insert({ user_id: user.id, module_id: moduleId, column_id: columnId, sort_order: sortOrder })
    .select("*")
    .single();
  if (error) throw error;
  return data as ModulePositionRow;
}

export async function reorderModulePositions(
  order: { id: string; column_id: string; sort_order: number }[]
): Promise<void> {
  const results = await Promise.all(
    order.map(({ id, column_id, sort_order }) =>
      supabase.from("dashboard_module_positions").update({ column_id, sort_order }).eq("id", id)
    )
  );
  for (const { error } of results) if (error) throw error;
}

export async function getShortcuts(): Promise<ShortcutRow[]> {
  const { data, error } = await supabase
    .from("dashboard_shortcuts")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addShortcut(
  name: string,
  url: string,
  iconUrl: string | null
): Promise<ShortcutRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("dashboard_shortcuts")
    .insert({
      user_id: user.id,
      name,
      url,
      icon_url: iconUrl,
      sort_order: Date.now(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ShortcutRow;
}

// Upload a custom shortcut logo (used when a site has no discoverable
// favicon, e.g. internal/local tools). Public bucket so the URL can be
// embedded directly without re-signing it every render.
export async function uploadShortcutIcon(file: File): Promise<string> {
  const user = await requireUser();
  const filePath = `${user.id}/${Date.now()}-${file.name}`;

  const { error } = await supabase.storage
    .from("shortcut-icons")
    .upload(filePath, file);
  if (error) throw error;

  return supabase.storage.from("shortcut-icons").getPublicUrl(filePath).data
    .publicUrl;
}

export async function deleteShortcut(id: string): Promise<void> {
  const { error } = await supabase
    .from("dashboard_shortcuts")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function reorderShortcuts(
  order: { id: string; sort_order: number }[]
): Promise<void> {
  const results = await Promise.all(
    order.map(({ id, sort_order }) =>
      supabase.from("dashboard_shortcuts").update({ sort_order }).eq("id", id)
    )
  );
  for (const { error } of results) if (error) throw error;
}

// ============================================
// PILL TRACKER
// ============================================

export async function getPillItems(): Promise<PillItemRow[]> {
  const { data, error } = await supabase
    .from("pill_tracker_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addPillItem(name: string): Promise<PillItemRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("pill_tracker_items")
    .insert({ user_id: user.id, name, sort_order: Date.now() })
    .select("*")
    .single();
  if (error) throw error;
  return data as PillItemRow;
}

export async function deletePillItem(id: string): Promise<void> {
  const { error } = await supabase
    .from("pill_tracker_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// All log rows ever, newest date first — used to render the History view
// (grouped by date client-side rather than a separate query per day).
export async function getAllPillLogs(): Promise<PillLogRow[]> {
  const { data, error } = await supabase
    .from("pill_tracker_logs")
    .select("*")
    .order("log_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function markPillTaken(
  itemId: string,
  logDate: string
): Promise<PillLogRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("pill_tracker_logs")
    .insert({ user_id: user.id, item_id: itemId, log_date: logDate })
    .select("*")
    .single();
  if (error) throw error;
  return data as PillLogRow;
}

export async function unmarkPillTaken(
  itemId: string,
  logDate: string
): Promise<void> {
  const { error } = await supabase
    .from("pill_tracker_logs")
    .delete()
    .eq("item_id", itemId)
    .eq("log_date", logDate);
  if (error) throw error;
}
