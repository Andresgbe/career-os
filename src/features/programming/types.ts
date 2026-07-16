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
