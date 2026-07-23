import { supabase } from "../../lib/supabase";
import type { ShortcutRow } from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
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
