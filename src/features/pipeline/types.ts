// Pipeline module types: client follow-up with a "guardian" that compares
// how long each deal has been sitting in its stage against that stage's rule.
// Mirrors the DB rows (BLOQUE 26 of PENDIENTE.sql).

export interface StageRow {
  id: string;
  name: string;
  max_days: number; // alert when a deal sits here longer than this
  rule: string; // human description of the rule ("Más de 2 días sin respuesta")
  message_template: string; // follow-up message suggested by the guardian; {nombre} = deal name
  color: string;
  sort_order: number;
}

export type DealStatus = "open" | "won" | "lost";

export interface DealRow {
  id: string;
  name: string; // client / lead
  company: string;
  contact: string; // phone, email or @handle
  channel: string; // whatsapp | email | instagram | linkedin | llamada | otro
  stage_id: string | null;
  note: string; // the last thing that happened ("Pidió información")
  value: number | null;
  currency: string;
  status: DealStatus;
  last_activity_at: string; // last real movement with the client
  suggested_message: string; // written by Andrés or an agent; '' = use the stage template
  source: string; // where the lead came from: tiktok | instagram | referido | web | otro | ''
  source_idea_id: string | null; // the content piece that brought it (Content → Stats counts it)
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ActivityRow {
  id: string;
  deal_id: string;
  kind: string; // note | stage | contacted | won | lost | created | edited
  body: string;
  actor: string; // andres | agent
  created_at: string;
}

export const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "instagram", label: "Instagram" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "llamada", label: "Call" },
  { key: "otro", label: "Other" },
] as const;

export const SOURCES = [
  { key: "", label: "Unknown" },
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
  { key: "referido", label: "Referral" },
  { key: "web", label: "Website" },
  { key: "otro", label: "Other" },
] as const;

export function channelLabel(key: string): string {
  return CHANNELS.find((c) => c.key === key)?.label ?? key;
}

// ============================================
// THE GUARDIAN'S RULE
// ============================================

export type Health = "ok" | "watch" | "attention";

export function daysSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86400000));
}

// on time  → comfortably inside the rule
// watch    → on the last day the rule allows
// attention→ past the rule: the deal is going cold
export function healthOf(deal: DealRow, stage: StageRow | undefined, now = Date.now()): Health {
  if (!stage || deal.status !== "open") return "ok";
  const days = daysSince(deal.last_activity_at, now);
  if (days > stage.max_days) return "attention";
  if (days >= Math.max(1, stage.max_days)) return "watch";
  return "ok";
}

export const HEALTH_LABEL: Record<Health, string> = {
  ok: "On time",
  watch: "Watch",
  attention: "Needs attention",
};

// The message the guardian proposes: the deal's own if someone wrote one,
// otherwise the stage template with the name filled in.
export function proposedMessage(deal: DealRow, stage: StageRow | undefined): string {
  if (deal.suggested_message.trim()) return deal.suggested_message;
  const first = deal.name.trim().split(/\s+/)[0] ?? "";
  return (stage?.message_template ?? "").replace(/\{nombre\}/gi, first);
}

// wa.me link when the contact looks like a phone number
export function whatsappLink(contact: string, message: string): string | null {
  const digits = contact.replace(/[^\d]/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
