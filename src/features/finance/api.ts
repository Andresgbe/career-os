import { supabase } from "../../lib/supabase";
import type { BillRow } from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

// ============================================
// BILLS
// ============================================

export async function getBills(): Promise<BillRow[]> {
  const { data, error } = await supabase
    .from("finance_bills")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addBill(fields: {
  name: string;
  description: string;
  amount: number;
  interest_rate: number | null;
  due_date: string | null;
}): Promise<BillRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("finance_bills")
    .insert({ user_id: user.id, ...fields })
    .select("*")
    .single();
  if (error) throw error;
  return data as BillRow;
}

export async function updateBill(
  id: string,
  fields: {
    name?: string;
    description?: string;
    amount?: number;
    interest_rate?: number | null;
    due_date?: string | null;
    paid?: boolean;
  }
): Promise<BillRow> {
  const { data, error } = await supabase
    .from("finance_bills")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as BillRow;
}

export async function deleteBill(id: string): Promise<void> {
  const { error } = await supabase.from("finance_bills").delete().eq("id", id);
  if (error) throw error;
}
