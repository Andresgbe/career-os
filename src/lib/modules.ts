import type { ComponentType } from "react";
import { Bike, Stethoscope, Video, GraduationCap, Laptop, Terminal, ListTodo, Shield, Landmark, Briefcase, KeyRound } from "lucide-react";

export interface ModuleDef {
  id: string;
  name: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
}

export const MODULES: ModuleDef[] = [
  {
    id: "motorcycle",
    name: "Motorcycle",
    path: "/motorcycle",
    icon: Bike,
  },
  {
    id: "medical",
    name: "Medical",
    path: "/medical",
    icon: Stethoscope,
  },
  {
    id: "content",
    name: "Content",
    path: "/content",
    icon: Video,
  },
  {
    id: "grades",
    name: "University",
    path: "/grades",
    icon: GraduationCap,
  },
  {
    id: "projects",
    name: "Project Management",
    path: "/projects",
    icon: Laptop,
  },
  {
    id: "programming",
    name: "Programming",
    path: "/programming",
    icon: Terminal,
  },
  {
    id: "tasks",
    name: "Tasks",
    path: "/tasks",
    icon: ListTodo,
  },
  {
    id: "insurance",
    name: "Insurance",
    path: "/insurance",
    icon: Shield,
  },
  {
    id: "finance",
    name: "Finance",
    path: "/finance",
    icon: Landmark,
  },
  {
    id: "work",
    name: "Work Tracker",
    path: "/work",
    icon: Briefcase,
  },
  {
    id: "passwords",
    name: "Passwords",
    path: "/passwords",
    icon: KeyRound,
  },
  // Future modules go here
];
