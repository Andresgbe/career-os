import { supabase } from "../../lib/supabase";
import type { MotorcycleInfo } from "./types";

// The DB uses snake_case; our app uses camelCase.
// These helpers translate between the two.

interface MotorcycleInfoRow {
  id: string;
  make: string;
  model: string;
  year: number | null;
  plate: string;
  vin: string;
  engine_serial: string;      // ← nuevo
  invoice_number: string;     // ← nuevo
  color: string;
  purchase_date: string | null;
  notes: string;
}

// Fetch the current user's motorcycle info (or null if none yet)
export async function getMotorcycleInfo(): Promise<MotorcycleInfoRow | null> {
  const { data, error } = await supabase
    .from("motorcycle_info")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Save (insert or update) the motorcycle info
export async function saveMotorcycleInfo(
  info: Omit<MotorcycleInfo, "id" | "attachments">,
  existingId: string | null
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

const row = {
    user_id: user.id,
    make: info.make,
    model: info.model,
    year: info.year,
    plate: info.plate,
    vin: info.vin,
    engine_serial: info.engineSerial,      // ← nuevo
    invoice_number: info.invoiceNumber,    // ← nuevo
    color: info.color,
    purchase_date: info.purchaseDate || null,
    notes: info.notes,
    updated_at: new Date().toISOString(),
  };

  if (existingId) {
    // Update existing record
    const { error } = await supabase
      .from("motorcycle_info")
      .update(row)
      .eq("id", existingId);
    if (error) throw error;
    return existingId;
  } else {
    // Insert new record
    const { data, error } = await supabase
      .from("motorcycle_info")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }
}

// ============================================
// ATTACHMENTS (Supabase Storage)
// ============================================

const BUCKET = "motorcycle-files";

export interface AttachmentRow {
  id: string;
  label: string;
  file_name: string;
  file_path: string;
}

// List all attachments for the current user
export async function getAttachments(): Promise<AttachmentRow[]> {
  const { data, error } = await supabase
    .from("motorcycle_attachments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Upload a file and register it in the attachments table
export async function uploadAttachment(file: File, label: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Store under a folder named after the user's ID (required by our policies)
  const filePath = `${user.id}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file);
  if (uploadError) throw uploadError;

  const { error: dbError } = await supabase
    .from("motorcycle_attachments")
    .insert({
      user_id: user.id,
      label: label || file.name,
      file_name: file.name,
      file_path: filePath,
    });
  if (dbError) throw dbError;
}

// Get a temporary signed URL to view/open a private file
export async function getFileUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60 * 60); // valid for 1 hour
  if (error) throw error;
  return data.signedUrl;
}

// Delete a file (from storage and the table)
export async function deleteAttachment(id: string, filePath: string) {
  await supabase.storage.from(BUCKET).remove([filePath]);
  const { error } = await supabase
    .from("motorcycle_attachments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// OIL CHANGES
// ============================================

export interface OilChangeRow {
  id: string;
  km: number;
  done: boolean;
  date: string | null;
  receipt_url: string | null;  // stores the file PATH, not the full URL
}

export async function getOilChanges(): Promise<OilChangeRow[]> {
  const { data, error } = await supabase
    .from("oil_changes")
    .select("*")
    .order("km", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Seed the default 9 milestones for a first-time user
export async function seedOilChanges() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const defaults = [500, 2000, 3500, 5000, 6500, 8000, 9500, 11000, 12000];
  const rows = defaults.map((km) => ({ user_id: user.id, km }));

  const { error } = await supabase.from("oil_changes").insert(rows);
  if (error) throw error;
}

export async function toggleOilChange(
  id: string,
  done: boolean,
  date: string | null
) {
  const { error } = await supabase
    .from("oil_changes")
    .update({ done, date })
    .eq("id", id);
  if (error) throw error;
}

export async function addOilChange(km: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("oil_changes")
    .insert({ user_id: user.id, km })
    .select("*")
    .single();
  if (error) throw error;
  return data as OilChangeRow;
}

export async function deleteOilChange(id: string) {
  const { error } = await supabase.from("oil_changes").delete().eq("id", id);
  if (error) throw error;
}

// Upload a receipt photo for a specific oil change milestone
export async function uploadOilReceipt(id: string, file: File) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const filePath = `${user.id}/oil-receipts/${id}-${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("motorcycle-files")
    .upload(filePath, file);
  if (uploadError) throw uploadError;

  const { error: dbError } = await supabase
    .from("oil_changes")
    .update({ receipt_url: filePath })
    .eq("id", id);
  if (dbError) throw dbError;

  return filePath;
}