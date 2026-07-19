export type Priority = "high" | "medium" | "low" | null;

export interface Task {
  id: string;
  title: string;
  priority: Priority;
  completed: boolean;
  order: number;
}
