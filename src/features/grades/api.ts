import { supabase } from "../../lib/supabase";
import type { SubjectRow, EvaluationRow, GradesShortcutRow } from "./types";

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

// ============================================
// CURRICULUM MAP PROGRESS
// ============================================

export type CurriculumStatus = "seen" | "tentative";

export interface CurriculumProgressEntry {
  subject_id: string;
  status: CurriculumStatus;
}

export async function getCurriculumProgress(): Promise<CurriculumProgressEntry[]> {
  const { data, error } = await supabase
    .from("grades_curriculum_progress")
    .select("subject_id, status");
  if (error) throw error;
  return (data ?? []) as CurriculumProgressEntry[];
}

export async function setSubjectStatus(
  subjectId: string,
  status: CurriculumStatus
): Promise<void> {
  const user = await requireUser();
  const { error } = await supabase
    .from("grades_curriculum_progress")
    .upsert(
      { user_id: user.id, subject_id: subjectId, status },
      { onConflict: "user_id,subject_id" }
    );
  if (error) throw error;
}

export async function clearSubjectStatus(subjectId: string): Promise<void> {
  const { error } = await supabase
    .from("grades_curriculum_progress")
    .delete()
    .eq("subject_id", subjectId);
  if (error) throw error;
}

export async function getCurrentUC(): Promise<number> {
  const { data, error } = await supabase
    .from("grades_curriculum_stats")
    .select("current_uc")
    .maybeSingle();
  if (error) throw error;
  return data?.current_uc ?? 0;
}

export async function setCurrentUC(uc: number): Promise<void> {
  const user = await requireUser();
  const { error } = await supabase
    .from("grades_curriculum_stats")
    .upsert({ user_id: user.id, current_uc: uc });
  if (error) throw error;
}

// ============================================
// SHORTCUTS
// ============================================

export async function getGradesShortcuts(): Promise<GradesShortcutRow[]> {
  const { data, error } = await supabase
    .from("grades_shortcuts")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addGradesShortcut(
  name: string,
  url: string,
  iconUrl: string | null
): Promise<GradesShortcutRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("grades_shortcuts")
    .insert({
      user_id: user.id,
      name,
      url,
      icon_url: iconUrl,
      sort_order: Date.now(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as GradesShortcutRow;
}

// Upload a custom shortcut logo (used when a site has no discoverable
// favicon, e.g. internal/local tools). Shares the same public bucket as
// the dashboard, work, and programming shortcuts.
export async function uploadShortcutIcon(file: File): Promise<string> {
  const user = await requireUser();
  const filePath = `${user.id}/${Date.now()}-${file.name}`;

  const { error } = await supabase.storage
    .from("shortcut-icons")
    .upload(filePath, file);
  if (error) throw error;

  return supabase.storage.from("shortcut-icons").getPublicUrl(filePath).data
    .publicUrl;
}

export async function deleteGradesShortcut(id: string): Promise<void> {
  const { error } = await supabase
    .from("grades_shortcuts")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function reorderGradesShortcuts(
  order: { id: string; sort_order: number }[]
): Promise<void> {
  const results = await Promise.all(
    order.map(({ id, sort_order }) =>
      supabase.from("grades_shortcuts").update({ sort_order }).eq("id", id)
    )
  );
  for (const { error } of results) if (error) throw error;
}
