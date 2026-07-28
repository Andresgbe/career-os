import { supabase } from "./supabase";

// Free-form "Context" notes attached to a section (one row per user per
// section, keyed by module id / "dashboard"). Backs the CONTEXT button
// rendered in AppLayout on every page.

export async function getSectionContext(section: string): Promise<string> {
  const { data, error } = await supabase
    .from("section_notes")
    .select("content")
    .eq("section", section)
    .maybeSingle();
  if (error) throw error;
  return data?.content ?? "";
}

export async function saveSectionContext(
  section: string,
  content: string
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("section_notes").upsert(
    {
      user_id: user.id,
      section,
      content,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,section" }
  );
  if (error) throw error;
}
