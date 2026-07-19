export interface MotorcycleInfo {
  id: string;
  make: string;
  model: string;
  year: number | null;
  plate: string;
  vin: string;
  engineSerial: string;      // ← nuevo
  invoiceNumber: string;     // ← nuevo
  color: string;
  purchaseDate: string | null;
  notes: string;
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
