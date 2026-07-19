// Finance module types.
// These mirror the DB row (snake_case), same approach as EvaluationRow
// in the grades module.

export interface BillRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  amount: number;
  interest_rate: number | null; // percentage, e.g. 12.5 for 12.5%
  due_date: string | null; // ISO date (yyyy-mm-dd)
  paid: boolean;
  created_at: string;
}
