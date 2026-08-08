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

export interface MonthlyExpenseRow {
  id: string;
  user_id: string;
  month: string; // yyyy-mm the entry was logged for (or started, if recurring)
  category: string;
  description: string;
  amount: number;
  recurring: boolean; // true = repeats every month, false = one-time for `month`
  created_at: string;
}
