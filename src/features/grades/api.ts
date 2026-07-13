import { supabase } from "../../lib/supabase";
import type { SubjectRow, EvaluationRow } from "./types";

// ============================================
// SHARED HELPERS
// ============================================

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

// ============================================
// SUBJECTS
// ============================================

export async function getSubjects(): Promise<SubjectRow[]> {
  const { data, error } = await supabase
    .from("grades_subjects")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addSubject(name: string, color: string): Promise<SubjectRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("grades_subjects")
    .insert({ user_id: user.id, name, color, sort_order: 0 })
    .select("*")
    .single();
  if (error) throw error;
  return data as SubjectRow;
}

export async function updateSubject(
  id: string,
  fields: { name?: string; color?: string; sort_order?: number }
): Promise<SubjectRow> {
  const { data, error } = await supabase
    .from("grades_subjects")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as SubjectRow;
}

export async function deleteSubject(id: string): Promise<void> {
  const { error } = await supabase
    .from("grades_subjects")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// EVALUATIONS
// ============================================

export async function getEvaluations(): Promise<EvaluationRow[]> {
  const { data, error } = await supabase
    .from("grades_evaluations")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addEvaluation(
  subject_id: string,
  name: string,
  weight: number
): Promise<EvaluationRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("grades_evaluations")
    .insert({ user_id: user.id, subject_id, name, weight, sort_order: 0 })
    .select("*")
    .single();
  if (error) throw error;
  return data as EvaluationRow;
}

export async function updateEvaluation(
  id: string,
  fields: { name?: string; weight?: number; grade?: number | null; eval_date?: string | null; sort_order?: number }
): Promise<EvaluationRow> {
  const { data, error } = await supabase
    .from("grades_evaluations")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as EvaluationRow;
}

export async function deleteEvaluation(id: string): Promise<void> {
  const { error } = await supabase
    .from("grades_evaluations")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
