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