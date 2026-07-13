// Content Planner module types.
// These mirror the DB rows (snake_case), same approach as
// the motorcycle and medical modules.

// ============================================
// PLATFORMS (fixed list)
// ============================================

export type Platform =
  | "instagram_reel"
  | "instagram_story"
  | "tiktok_story"
  | "tiktok_video"
  | "youtube_video"
  | "youtube_short"
  | "facebook_video";

export interface PlatformDef {
  value: Platform;
  label: string;
  color: string;      // badge background
  textColor: string;  // badge text
}

export const PLATFORMS: PlatformDef[] = [
  { value: "instagram_reel",  label: "Instagram Reel",  color: "#e1306c", textColor: "#fff" },
  { value: "instagram_story", label: "Instagram Story", color: "#c13584", textColor: "#fff" },
  { value: "tiktok_story",    label: "TikTok Story",    color: "#25f4ee", textColor: "#000" },
  { value: "tiktok_video",    label: "TikTok Video",    color: "#fe2c55", textColor: "#fff" },
  { value: "youtube_video",   label: "YouTube Video",   color: "#ff0000", textColor: "#fff" },
  { value: "youtube_short",   label: "YouTube Short",   color: "#ff4444", textColor: "#fff" },
  { value: "facebook_video",  label: "Facebook Video",  color: "#1877f2", textColor: "#fff" },
];

// ============================================
// PRODUCTION STATUS STEPS
// ============================================

export interface StatusStep {
  key: "script_done" | "recorded" | "edited";
  label: string;
}

export const STATUS_STEPS: StatusStep[] = [
  { key: "script_done", label: "Guion" },
  { key: "recorded",    label: "Grabado" },
  { key: "edited",      label: "Editado" },
];

// ============================================
// CATEGORIES (user-created)
// ============================================

export interface CategoryRow {
  id: string;
  name: string;
  color: string; // hex color for visual tag
}

// ============================================
// CONTENT IDEAS
// ============================================

export interface ContentIdeaRow {
  id: string;
  title: string;
  description: string;
  script: string;           // full script text
  platforms: Platform[];    // stored as jsonb in Supabase
  category_ids: string[];   // stored as jsonb in Supabase
  script_done: boolean;
  recorded: boolean;
  edited: boolean;
  created_at: string;
  updated_at: string;
}
