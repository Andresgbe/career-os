import { supabase } from "../../lib/supabase";
import type { ActivityRow, DealRow, StageRow } from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

// ============================================
// STAGES
// ============================================

export async function getStages(): Promise<StageRow[]> {
  const { data, error } = await supabase.from("pipeline_stages").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []) as StageRow[];
}

export async function addStage(fields: Omit<StageRow, "id">): Promise<StageRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("pipeline_stages")
    .insert({ user_id: user.id, ...fields })
    .select("*")
    .single();
  if (error) throw error;
  return data as StageRow;
}

export async function updateStage(id: string, fields: Partial<Omit<StageRow, "id">>): Promise<void> {
  const { error } = await supabase.from("pipeline_stages").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteStage(id: string): Promise<void> {
  const { error } = await supabase.from("pipeline_stages").delete().eq("id", id);
  if (error) throw error;
}

// ============================================
// DEALS
// ============================================

export async function getDeals(): Promise<DealRow[]> {
  const { data, error } = await supabase.from("pipeline_deals").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []).map((d) => ({ ...d, value: d.value === null ? null : Number(d.value) })) as DealRow[];
}

export type DealFields = Partial<Omit<DealRow, "id" | "created_at" | "updated_at">>;

export async function addDeal(fields: DealFields & { name: string }): Promise<DealRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("pipeline_deals")
    .insert({ user_id: user.id, ...fields })
    .select("*")
    .single();
  if (error) throw error;
  return data as DealRow;
}

export async function updateDeal(id: string, fields: DealFields): Promise<DealRow> {
  const { data, error } = await supabase
    .from("pipeline_deals")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as DealRow;
}

export async function deleteDeal(id: string): Promise<void> {
  const { error } = await supabase.from("pipeline_deals").delete().eq("id", id);
  if (error) throw error;
}

// ============================================
// ACTIVITY (history of each deal: by Andrés or by an agent)
// ============================================

export async function getActivity(): Promise<ActivityRow[]> {
  const { data, error } = await supabase
    .from("pipeline_activity")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as ActivityRow[];
}

export async function logActivity(dealId: string, kind: string, body: string): Promise<ActivityRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("pipeline_activity")
    .insert({ user_id: user.id, deal_id: dealId, kind, body, actor: "andres" })
    .select("*")
    .single();
  if (error) throw error;
  return data as ActivityRow;
}
