export interface SubjectRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface EvaluationRow {
  id: string;
  user_id: string;
  subject_id: string;
  name: string;
  weight: number; // Percentage (e.g. 20 for 20%)
  grade: number | null; // Note out of 20
  eval_date: string | null; // YYYY-MM-DD
  sort_order: number;
  created_at: string;
}

export const MAX_GRADE = 20;

export function getMaxPoints(weight: number): number {
  return MAX_GRADE * (weight / 100);
}

export function getEarnedPoints(weight: number, grade: number | null): number {
  if (grade == null) return 0;
  return (grade / MAX_GRADE) * getMaxPoints(weight);
}

export function getSubjectTotal(evaluations: EvaluationRow[]): number {
  return evaluations.reduce((acc, ev) => acc + getEarnedPoints(ev.weight, ev.grade), 0);
}

export interface GradesShortcutRow {
  id: string;
  user_id: string;
  name: string;
  url: string;
  icon_url: string | null; // custom uploaded logo; falls back to auto favicon when null
  sort_order: number;
  created_at: string;
}
