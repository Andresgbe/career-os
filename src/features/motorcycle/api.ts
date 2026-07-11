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