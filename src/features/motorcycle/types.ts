// Motorcycle general info (single record — "the bike's profile")
export interface MotorcycleInfo {
  id: string;
  make: string;          // e.g. Yamaha
  model: string;         // e.g. MT-03
  year: number | null;
  plate: string;         // license plate
  vin: string;           // chassis / VIN
  color: string;
  purchaseDate: string | null;   // ISO date
  notes: string;
  // Attached files (manual, legal docs) live in Supabase Storage later.
  // For now we just keep their metadata.
  attachments: Attachment[];
}

export interface Attachment {
  id: string;
  label: string;         // e.g. "Owner's manual", "Insurance"
  fileName: string;
  url: string;           // Supabase Storage URL (mock for now)
}

// Oil change milestones — editable list of km checkpoints
export interface OilChange {
  id: string;
  km: number;            // 500, 2000, ...
  done: boolean;
  date: string | null;   // when it was done
  receiptUrl: string | null;  // photo proof (Storage later)
}

// To Buy list
export type ToBuyStatus = "pending" | "purchased";

export interface ToBuyItem {
  id: string;
  name: string;
  referenceUrl: string;  // link to product / reference
  status: ToBuyStatus;
}

// Audit log — history of actions
export type AuditCategory = "maintenance" | "workshop" | "upgrade" | "other";

export interface AuditEntry {
  id: string;
  date: string;          // ISO date
  category: AuditCategory;
  description: string;
  location: string;      // optional place
}