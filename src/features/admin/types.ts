// Admin panel types.
//
// Andrés es el administrador: ve y hace todo. Cualquier otra cuenta no ve
// nada hasta que él la habilite módulo por módulo. Lo que decide de verdad
// son las políticas RLS de Supabase (BLOQUE 4 de PENDIENTE.sql); esto es la
// cara visible de esas mismas tablas, así que esconder algo acá no alcanza
// y nunca es la única defensa.

export type AppRole = "admin" | "member";

export interface ProfileRow {
  user_id: string;
  email: string;
  display_name: string;
  role: AppRole;
  active: boolean;
  created_at: string;
}

export interface ModulePermissionRow {
  id: string;
  user_id: string;
  module: string; // id de MODULES
  can_view: boolean;
  can_edit: boolean;
}

export interface ProjectPermissionRow {
  id: string;
  user_id: string;
  project_id: string;
}

// Lo que el panel edita en memoria antes de guardar
export interface ModulePermission {
  can_view: boolean;
  can_edit: boolean;
}

export type PermissionMap = Record<string, ModulePermission>;

export const NO_PERMISSION: ModulePermission = {
  can_view: false,
  can_edit: false,
};

export function displayName(profile: ProfileRow): string {
  return profile.display_name.trim() || profile.email || "Sin nombre";
}
