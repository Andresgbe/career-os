import { supabase } from "../../lib/supabase";
import type { ChatMessageRow } from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function getMessages(): Promise<ChatMessageRow[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

const BUCKET = "chat-files";

// Uploads an attachment and returns its path inside the private bucket.
// The folder is the user's id, which is what the storage policies check.
export async function uploadChatImage(file: File): Promise<string> {
  const user = await requireUser();
  const path = `${user.id}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;
  return path;
}

// Private bucket, so displaying a thumbnail needs a short-lived signed URL
export async function getChatImageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

// Queues a message for the worker. It comes back as "pending" until the
// worker on the user's machine picks it up.
export async function sendMessage(
  content: string,
  imagePath?: string | null
): Promise<ChatMessageRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      user_id: user.id,
      role: "user",
      content,
      image_path: imagePath ?? null,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ChatMessageRow;
}

export async function clearMessages(): Promise<void> {
  const user = await requireUser();
  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("user_id", user.id);
  if (error) throw error;
}
