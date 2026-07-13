import { supabase } from "../../lib/supabase";
import type {
  ExamRow,
  HistoryRow,
  HistoryFileRow,
  ContactRow,
} from "./types";

// ============================================
// SHARED HELPERS (Storage + auth)
// ============================================

const BUCKET = "medical-files";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

// Get a temporary signed URL to view/open a private file
export async function getFileUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60 * 60); // valid for 1 hour
  if (error) throw error;
  return data.signedUrl;
}

// ============================================
// MEDICAL EXAMS
// ============================================

export async function getExams(): Promise<ExamRow[]> {
  const { data, error } = await supabase
    .from("medical_exams")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Upload the exam file and register it in the table
export async function uploadExam(file: File, nextOrder: number) {
  const user = await requireUser();

  // Store under a folder named after the user's ID (required by our policies)
  const filePath = `${user.id}/exams/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file);
  if (uploadError) throw uploadError;

  const { data, error: dbError } = await supabase
    .from("medical_exams")
    .insert({
      user_id: user.id,
      file_name: file.name,
      file_path: filePath,
      sort_order: nextOrder,
    })
    .select("*")
    .single();
  if (dbError) throw dbError;
  return data as ExamRow;
}

// Update description and/or date of an exam
export async function updateExam(
  id: string,
  fields: { description?: string; exam_date?: string | null }
) {
  const { error } = await supabase
    .from("medical_exams")
    .update(fields)
    .eq("id", id);
  if (error) throw error;
}

// Swap the sort_order of two exams (used by the up/down arrows)
export async function swapExamOrder(a: ExamRow, b: ExamRow) {
  const results = await Promise.all([
    supabase
      .from("medical_exams")
      .update({ sort_order: b.sort_order })
      .eq("id", a.id),
    supabase
      .from("medical_exams")
      .update({ sort_order: a.sort_order })
      .eq("id", b.id),
  ]);
  for (const { error } of results) if (error) throw error;
}

// Delete an exam (file from storage + row from the table)
export async function deleteExam(id: string, filePath: string) {
  await supabase.storage.from(BUCKET).remove([filePath]);
  const { error } = await supabase
    .from("medical_exams")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// MEDICAL HISTORY
// ============================================

export async function getHistory(): Promise<{
  entries: HistoryRow[];
  files: HistoryFileRow[];
}> {
  const [entriesRes, filesRes] = await Promise.all([
    supabase
      .from("medical_history")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("medical_history_files").select("*"),
  ]);
  if (entriesRes.error) throw entriesRes.error;
  if (filesRes.error) throw filesRes.error;
  return { entries: entriesRes.data ?? [], files: filesRes.data ?? [] };
}

export async function addHistoryEntry(entry: {
  entry_date: string;
  entry_type: string;
  place: string;
  professional: string;
  notes: string;
}) {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("medical_history")
    .insert({ user_id: user.id, ...entry })
    .select("*")
    .single();
  if (error) throw error;
  return data as HistoryRow;
}

export async function updateHistoryEntry(
  id: string,
  fields: {
    entry_date: string;
    entry_type: string;
    place: string;
    professional: string;
    notes: string;
  }
) {
  const { data, error } = await supabase
    .from("medical_history")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as HistoryRow;
}

// Attach a file (invoice, prescription...) to a history entry
export async function uploadHistoryFile(historyId: string, file: File) {
  const user = await requireUser();

  const filePath = `${user.id}/history/${historyId}-${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file);
  if (uploadError) throw uploadError;

  const { data, error: dbError } = await supabase
    .from("medical_history_files")
    .insert({
      user_id: user.id,
      history_id: historyId,
      file_name: file.name,
      file_path: filePath,
    })
    .select("*")
    .single();
  if (dbError) throw dbError;
  return data as HistoryFileRow;
}

export async function deleteHistoryFile(id: string, filePath: string) {
  await supabase.storage.from(BUCKET).remove([filePath]);
  const { error } = await supabase
    .from("medical_history_files")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Delete an entry, its attached files in storage, and (via cascade) its file rows
export async function deleteHistoryEntry(id: string, filePaths: string[]) {
  if (filePaths.length > 0) {
    await supabase.storage.from(BUCKET).remove(filePaths);
  }
  const { error } = await supabase
    .from("medical_history")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// CONTACTS
// ============================================

export async function getContacts(): Promise<ContactRow[]> {
  const { data, error } = await supabase
    .from("medical_contacts")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Save (insert or update) a contact
export async function saveContact(
  contact: Omit<ContactRow, "id">,
  existingId: string | null
) {
  const user = await requireUser();

  const row = {
    user_id: user.id,
    name: contact.name,
    description: contact.description,
    phones: contact.phones,
    location: contact.location,
  };

  if (existingId) {
    const { data, error } = await supabase
      .from("medical_contacts")
      .update(row)
      .eq("id", existingId)
      .select("*")
      .single();
    if (error) throw error;
    return data as ContactRow;
  } else {
    const { data, error } = await supabase
      .from("medical_contacts")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    return data as ContactRow;
  }
}

export async function deleteContact(id: string) {
  const { error } = await supabase
    .from("medical_contacts")
    .delete()
    .eq("id", id);
  if (error) throw error;
}