import type { ComponentType } from "react";
import { Bike, Stethoscope, Video, GraduationCap, Laptop, Terminal, ListTodo, Shield, Landmark, KeyRound, BookMarked, ShieldCheck } from "lucide-react";

export interface ModuleDef {
  id: string;
  name: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
}

export const MODULES: ModuleDef[] = [
  {
    id: "tasks",
    name: "Pending",
    path: "/tasks",
    icon: ListTodo,
  },
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
    id: "passwords",
    name: "Passwords",
    path: "/passwords",
    icon: KeyRound,
  },
  {
    id: "knowledge",
    name: "Knowledge",
    path: "/knowledge",
    icon: BookMarked,
  },
  // Future modules go here
];

// El panel de administrador no va en MODULES a propósito: MODULES es la
// lista de módulos sobre los que se dan permisos, y sobre el panel no se
// dan permisos — o sos el admin, o no existe para vos.
export const ADMIN_MODULE: ModuleDef = {
  id: "admin",
  name: "Admin",
  path: "/admin",
  icon: ShieldCheck,
};
