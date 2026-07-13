import type { ComponentType } from "react";
import { Bike, Stethoscope, Video } from "lucide-react";

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
  // Future modules go here
];