import { supabase } from "../../lib/supabase";
import { NEW_CONVERSATION_TITLE, titleFrom } from "./types";
import type { ChatMessageRow, ConversationRow } from "./types";

async function requireUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

// ============================================
// CONVERSACIONES
// ============================================

export async function getConversations(): Promise<ConversationRow[]> {
  const { data, error } = await supabase
    .from("chat_conversations")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createConversation(
  title = NEW_CONVERSATION_TITLE
): Promise<ConversationRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("chat_conversations")
    .insert({ user_id: user.id, title })
    .select("*")
    .single();
  if (error) throw error;
  return data as ConversationRow;
}

export async function renameConversation(
  id: string,
  title: string
): Promise<void> {
  const { error } = await supabase
    .from("chat_conversations")
    .update({ title })
    .eq("id", id);
  if (error) throw error;
}

// Los mensajes se van con ella: chat_messages.conversation_id es
// on delete cascade.
export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase
    .from("chat_conversations")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// MENSAJES
// ============================================

export async function getMessages(
  conversationId: string
): Promise<ChatMessageRow[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("conversation_id", conversationId)
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
  conversationId: string,
  content: string,
  imagePath?: string | null
): Promise<ChatMessageRow> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      user_id: user.id,
      conversation_id: conversationId,
      role: "user",
      content,
      image_path: imagePath ?? null,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw error;

  // La conversación sube al tope de la lista, y si todavía se llamaba
  // "Nueva conversación" toma el nombre del primer mensaje.
  const { data: conversation } = await supabase
    .from("chat_conversations")
    .select("title")
    .eq("id", conversationId)
    .maybeSingle();

  await supabase
    .from("chat_conversations")
    .update({
      updated_at: new Date().toISOString(),
      ...(conversation?.title === NEW_CONVERSATION_TITLE
        ? { title: titleFrom(content) }
        : {}),
    })
    .eq("id", conversationId);

  return data as ChatMessageRow;
}

// Cancela un mensaje que está en cola o corriendo.
//
// No hay un estado "cancelado" en la tabla, así que se usa "error": el
// worker, mientras ejecuta, mira si su fila sigue en "running" y si no, mata
// el proceso de Claude. Es la señal más simple que no necesita migración.
export async function cancelMessage(id: string): Promise<void> {
  const { error } = await supabase
    .from("chat_messages")
    .update({ status: "error" })
    .eq("id", id)
    .in("status", ["pending", "running"]);
  if (error) throw error;
}

// Vacía una conversación sin borrarla. La sesión de Claude también se
// suelta: si no, la conversación seguiría acordándose de lo que ya no se ve.
export async function clearMessages(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("conversation_id", conversationId);
  if (error) throw error;

  await supabase
    .from("chat_conversations")
    .update({ session_id: null })
    .eq("id", conversationId);
}
