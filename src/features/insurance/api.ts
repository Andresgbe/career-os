import { supabase } from "../../lib/supabase";
import type { InsuranceContact, InsuranceRow, PolicyType } from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

// Supabase returns jsonb as raw JSON; ensure the array is properly typed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePolicy(row: any): InsuranceRow {
  return {
    ...row,
    contacts: Array.isArray(row.contacts) ? row.contacts : [],
  };
}

export async function getInsurancePolicies(): Promise<InsuranceRow[]> {
  const { data, error } = await supabase
    .from("insurance_policies")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizePolicy);
}

export interface InsuranceFormFields {
  insurer_name: string;
  policy_type: PolicyType;
  policy_number: string;
  premium: number | null;
  renewal_date: string | null;
  contacts: InsuranceContact[];
  contact_email: string;
  notes: string;
}

// Save (insert or update) an insurance policy
export async function saveInsurancePolicy(
  fields: InsuranceFormFields,
  existingId: string | null
): Promise<InsuranceRow> {
  if (existingId) {
    const { data, error } = await supabase
      .from("insurance_policies")
      .update(fields)
      .eq("id", existingId)
      .select("*")
      .single();
    if (error) throw error;
    return normalizePolicy(data);
  }

  const user = await requireUser();
  const { data, error } = await supabase
    .from("insurance_policies")
    .insert({ user_id: user.id, ...fields })
    .select("*")
    .single();
  if (error) throw error;
  return normalizePolicy(data);
}

export async function deleteInsurancePolicy(id: string): Promise<void> {
  const { error } = await supabase
    .from("insurance_policies")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
