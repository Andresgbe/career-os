export type ResourceType = "link" | "article" | "tool" | "other";

export interface ProgrammingResourceRow {
  id: string;
  user_id: string;
  title: string;
  url: string;
  description: string | null;
  type: ResourceType;
  created_at: string;
}

export interface ProgrammingShortcutRow {
  id: string;
  user_id: string;
  name: string;
  url: string;
  icon_url: string | null; // custom uploaded logo; falls back to auto favicon when null
  sort_order: number;
  created_at: string;
}
