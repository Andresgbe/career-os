import type { ComponentType } from "react";
import { Bike, Stethoscope, Video, GraduationCap, Laptop, Landmark, Building2, KeyRound, ShieldCheck, Brain, Radar, LayoutDashboard } from "lucide-react";

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
    id: "pipeline",
    name: "Pipeline",
    path: "/pipeline",
    icon: Radar,
  },
  {
    id: "finance",
    name: "Finance",
    path: "/finance",
    icon: Landmark,
  },
  {
    id: "agency-finance",
    name: "Agency Finance",
    path: "/agency-finance",
    icon: Building2,
  },
  {
    id: "passwords",
    name: "Passwords",
    path: "/passwords",
    icon: KeyRound,
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

// BRAIN tampoco es un módulo: es una página fija que va siempre al lado de
// Admin en la barra. No entra en MODULES para que no se pueda mover ni
// agrupar en el tablero; el panel Admin sí lo lista aparte para dar Ver /
// Editar con el id "brain" (borrar sigue siendo solo del admin). La leen los agentes por
// MCP (herramientas `brain` / `brain_write`).
export const BRAIN_MODULE: ModuleDef = {
  id: "brain",
  name: "BRAIN",
  path: "/brain",
  icon: Brain,
};

// La pantalla principal (Chat + tarjetas). Es del admin, pero desde el panel
// Admin se le puede dar "Ver" a otra cuenta: entonces ve esta pantalla y usa
// el chat, que el worker responde con el mismo acceso completo de Andrés
// (decisión suya). El worker solo atiende a cuentas activas con este permiso.
export const DASHBOARD_MODULE: ModuleDef = {
  id: "dashboard",
  name: "Dashboard (chat)",
  path: "/",
  icon: LayoutDashboard,
};
