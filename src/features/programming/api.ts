import { supabase } from "../../lib/supabase";
import type { ProgrammingResourceRow, ResourceType } from "./types";

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
