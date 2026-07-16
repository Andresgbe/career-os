import type { ComponentType } from "react";
import { Bike, Stethoscope, Video, GraduationCap, Laptop, Terminal } from "lucide-react";

export interface ModuleDef {
  id: string;
  name: string;
  path: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

export const MODULES: ModuleDef[] = [
  {
    id: "motorcycle",
    name: "Motorcycle",
    path: "/motorcycle",
    description: "Track personal and relevant info about my motorcycle",
    icon: Bike,
  },
  {
    id: "medical",
    name: "Medical",
    path: "/medical",
    description: "Medical exams, visit history, and healthcare contacts",
    icon: Stethoscope,
  },
  {
    id: "content",
    name: "Content",
    path: "/content",
    description: "Organize content ideas, scripts, and publishing pipeline",
    icon: Video,
  },
  {
    id: "grades",
    name: "Grades",
    path: "/grades",
    description: "Manage subjects, evaluations, and track your points",
    icon: GraduationCap,
  },
  {
    id: "projects",
    name: "Projects Management",
    path: "/projects",
    description: "Manage IT projects and track their progress",
    icon: Laptop,
  },
  {
    id: "programming",
    name: "Programming",
    path: "/programming",
    description: "Manage programming resources, snippets, and tools",
    icon: Terminal,
  },
  // Future modules go here
];