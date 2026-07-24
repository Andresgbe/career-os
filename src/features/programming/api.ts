import { supabase } from "../../lib/supabase";
import type {
  ProgrammingResourceRow,
  ResourceType,
  ProgrammingShortcutRow,
} from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function getResources(): Promise<ProgrammingResourceRow[]> {
  const { data, error } = await supabase
    .from("programming_resources")
    .select("*")
    .order("created_at", { ascending: false });
    
  if (error) throw error;
  return data ?? [];
}

export async function addResource(entry: {
  title: string;
  url: string;
  description: string;
  type: ResourceType;
}) {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("programming_resources")
    .insert({
      user_id: user.id,
      ...entry,
    })
    .select("*")
    .single();
    
  if (error) throw error;
  return data as ProgrammingResourceRow;
}

export async function deleteResource(id: string) {
  const { error } = await supabase
    .from("programming_resources")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ============================================
// SHORTCUTS
// ============================================

export async function getProgrammingShortcuts(): Promise<ProgrammingShortcutRow[]> {
  const { data, error } = await supabase
    .from("programming_shortcuts")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addProgrammingShortcut(
  name: string,
  url: string,
  iconUrl: string | null
): Promise<ProgrammingShortcutRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("programming_shortcuts")
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
  return data as ProgrammingShortcutRow;
}

// Upload a custom shortcut logo (used when a site has no discoverable
// favicon, e.g. internal/local tools). Shares the same public bucket as
// the dashboard and work shortcuts.
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

export async function deleteProgrammingShortcut(id: string): Promise<void> {
  const { error } = await supabase
    .from("programming_shortcuts")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function reorderProgrammingShortcuts(
  order: { id: string; sort_order: number }[]
): Promise<void> {
  const results = await Promise.all(
    order.map(({ id, sort_order }) =>
      supabase.from("programming_shortcuts").update({ sort_order }).eq("id", id)
    )
  );
  for (const { error } of results) if (error) throw error;
}
