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

// ============================================
// PAYMENT PLANS
// ============================================

export interface PaymentPlanRow {
  id: string;
  user_id: string;
  name: string;
  cuota_inicial: number;
  mes_2: number;
  mes_3: number;
  mes_4: number;
  mes_5: number;
  ci: number;
  subjects: string[]; // subjects tentatively taken under this plan
  sort_order: number;
  created_at: string;
}

export const PAYMENT_FIELDS: {
  key: "cuota_inicial" | "mes_2" | "mes_3" | "mes_4" | "mes_5" | "ci";
  label: string;
}[] = [
  { key: "cuota_inicial", label: "Cuota inicial (+DI)" },
  { key: "mes_2", label: "2do mes" },
  { key: "mes_3", label: "3er mes" },
  { key: "mes_4", label: "4to mes" },
  { key: "mes_5", label: "5to mes" },
  { key: "ci", label: "CI" },
];

export function getPaymentPlanTotal(plan: PaymentPlanRow): number {
  return (
    plan.cuota_inicial +
    plan.mes_2 +
    plan.mes_3 +
    plan.mes_4 +
    plan.mes_5 +
    plan.ci
  );
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
