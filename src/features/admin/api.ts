import { supabase } from "../../lib/supabase";
import type {
  ModulePermissionRow,
  PermissionMap,
  ProfileRow,
  ProjectPermissionRow,
} from "./types";

// ============================================
// PERFILES
// ============================================

export async function getProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("app_profiles")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// El perfil de quien está usando la app ahora mismo. Devuelve null si la
// tabla todavía no existe o si la cuenta no tiene perfil: en ese caso la
// app trata a la persona como invitado sin permisos, que es el lado seguro.
export async function getMyProfile(): Promise<ProfileRow | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("app_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function updateProfile(
  userId: string,
  fields: Partial<Pick<ProfileRow, "display_name" | "active" | "role">>
): Promise<void> {
  const { error } = await supabase
    .from("app_profiles")
    .update(fields)
    .eq("user_id", userId);
  if (error) throw error;
}

// ============================================
// PERMISOS DE MÓDULO
// ============================================

export async function getModulePermissions(
  userId?: string
): Promise<ModulePermissionRow[]> {
  let query = supabase.from("app_module_permissions").select("*");
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// Guarda el mapa completo de un usuario de una sola vez. Las filas en las
// que no quedó ningún permiso se borran en vez de guardarse en falso, para
// que la tabla diga exactamente lo que está habilitado.
export async function saveModulePermissions(
  userId: string,
  permissions: PermissionMap
): Promise<void> {
  const granted = Object.entries(permissions).filter(
    ([, p]) => p.can_view || p.can_edit
  );

  const { error: delErr } = await supabase
    .from("app_module_permissions")
    .delete()
    .eq("user_id", userId);
  if (delErr) throw delErr;

  if (granted.length === 0) return;

  const { error } = await supabase.from("app_module_permissions").insert(
    granted.map(([module, p]) => ({
      user_id: userId,
      module,
      // editar implica ver: no tiene sentido poder escribir a ciegas
      can_view: p.can_view || p.can_edit,
      can_edit: p.can_edit,
    }))
  );
  if (error) throw error;
}

// ============================================
// PERMISOS DE PROYECTO
// ============================================

export async function getProjectPermissions(
  userId?: string
): Promise<ProjectPermissionRow[]> {
  let query = supabase.from("app_project_permissions").select("*");
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function saveProjectPermissions(
  userId: string,
  projectIds: string[]
): Promise<void> {
  const { error: delErr } = await supabase
    .from("app_project_permissions")
    .delete()
    .eq("user_id", userId);
  if (delErr) throw delErr;

  if (projectIds.length === 0) return;

  const { error } = await supabase
    .from("app_project_permissions")
    .insert(projectIds.map((project_id) => ({ user_id: userId, project_id })));
  if (error) throw error;
}

// ============================================
// MI CUENTA
// ============================================

// Cambia la contraseña de quien está logueado. No necesita la llave de
// servicio de Supabase: es la propia sesión la que se actualiza.
export async function changeMyPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
