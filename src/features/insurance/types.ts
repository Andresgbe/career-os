// Insurance module types.
// These mirror the DB row (snake_case), same approach as SubjectRow/ContactRow
// in the grades/medical modules.

export type PolicyType = "auto" | "health" | "life" | "home" | "other";

export const POLICY_TYPES: { value: PolicyType; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "health", label: "Health" },
  { value: "life", label: "Life" },
  { value: "home", label: "Home" },
  { value: "other", label: "Other" },
];

export interface InsuranceContact {
  name: string;
  phone: string;
  is_emergency: boolean;
}

export interface InsuranceRow {
  id: string;
  user_id: string;
  insurer_name: string; // e.g. "Mapfre", "Seguros Caracas"
  policy_type: PolicyType;
  policy_number: string;
  premium: number | null; // optional amount, currency left to the user's notes
  renewal_date: string | null; // ISO date (yyyy-mm-dd)
  contacts: InsuranceContact[]; // stored as jsonb in Supabase
  contact_email: string;
  notes: string;
  created_at: string;
}
