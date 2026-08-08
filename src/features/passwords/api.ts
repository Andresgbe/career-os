import { supabase } from "../../lib/supabase";
import type { PasswordEntryRow } from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function getPasswordEntries(): Promise<PasswordEntryRow[]> {
  const { data, error } = await supabase
    .from("site_credentials")
    .select("*")
    .order("site_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface PasswordEntryFields {
  site_name: string;
  url: string;
  username: string;
  password: string;
  notes: string;
}

// Save (insert or update) a site credential
export async function savePasswordEntry(
  fields: PasswordEntryFields,
  existingId: string | null
): Promise<PasswordEntryRow> {
  if (existingId) {
    const { data, error } = await supabase
      .from("site_credentials")
      .update(fields)
      .eq("id", existingId)
      .select("*")
      .single();
    if (error) throw error;
    return data as PasswordEntryRow;
  }

  const user = await requireUser();
  const { data, error } = await supabase
    .from("site_credentials")
    .insert({ user_id: user.id, ...fields })
    .select("*")
    .single();
  if (error) throw error;
  return data as PasswordEntryRow;
}

export async function deletePasswordEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from("site_credentials")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
