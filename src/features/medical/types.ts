// Medical module types.
// These mirror the DB rows (snake_case), same approach as
// OilChangeRow / AttachmentRow in the motorcycle module.

// ============================================
// MEDICAL EXAMS
// ============================================

export interface ExamRow {
  id: string;
  description: string;
  exam_date: string | null; // ISO date (yyyy-mm-dd)
  file_name: string;
  file_path: string; // path inside the "medical-files" bucket
  sort_order: number; // user-controlled ordering (up/down arrows)
}

// ============================================
// MEDICAL HISTORY
// ============================================

export type HistoryEntryType = "consultation" | "lab_exam" | "other";

export const HISTORY_ENTRY_TYPES: { value: HistoryEntryType; label: string }[] = [
  { value: "consultation", label: "Medical consultation" },
  { value: "lab_exam", label: "Lab exam" },
  { value: "other", label: "Other" },
];

export interface HistoryRow {
  id: string;
  entry_date: string; // ISO date
  entry_type: HistoryEntryType;
  place: string; // clinic / location of the visit
  professional: string; // doctor / specialist name (optional)
  notes: string;
}

// Optional files attached to a history entry (invoices, prescriptions...)
export interface HistoryFileRow {
  id: string;
  history_id: string;
  file_name: string;
  file_path: string;
}

// ============================================
// CONTACTS
// ============================================

export interface ContactRow {
  id: string;
  name: string; // person or clinic name
  description: string;
  phones: string[]; // zero or more phone numbers
  location: string; // optional written address
}