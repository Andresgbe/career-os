import type { ComponentType } from "react";
import { Bike } from "lucide-react";

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
  // Future modules go here
];