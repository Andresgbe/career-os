// Passwords module types.
// These mirror the DB row (snake_case), same approach as InsuranceRow
// in the insurance module.

export interface PasswordEntryRow {
  id: string;
  user_id: string;
  site_name: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  created_at: string;
}
