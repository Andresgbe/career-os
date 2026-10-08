import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getMyProfile, getModulePermissions } from "../features/admin/api";
import type { ProfileRow } from "../features/admin/types";
import { useAuth } from "./useAuth";

interface PermissionsContextValue {
  profile: ProfileRow | null;
  isAdmin: boolean;
  loading: boolean;
  canView: (moduleId: string) => boolean;
  canEdit: (moduleId: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  profile: null,
  isAdmin: false,
  loading: true,
  canView: () => false,
  canEdit: () => false,
});

interface LoadedPermissions {
  // false = las tablas de permisos todavía no existen (BLOQUE 4 sin correr)
  installed: boolean;
  profile: ProfileRow | null;
  modules: Record<string, { can_view: boolean; can_edit: boolean }>;
}

const NOT_INSTALLED: LoadedPermissions = {
  installed: false,
  profile: null,
  modules: {},
};

// Qué módulos puede abrir la cuenta actual.
//
// Esto es solo para la interfaz: sirve para no mostrar un link que lleva a
// una página vacía. Quien decide de verdad es RLS en Supabase, así que un
// invitado que escriba la URL a mano igual no ve datos. Nunca tratar este
// hook como la barrera de seguridad.
export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  // null = todavía no se cargó para esta sesión
  const [loaded, setLoaded] = useState<LoadedPermissions | null>(null);

  useEffect(() => {
    if (authLoading || !session) return;

    let cancelled = false;

    Promise.all([getMyProfile(), getModulePermissions()])
      .then(([profile, perms]) => {
        if (cancelled) return;
        // La consulta respondió, así que las tablas existen. Que no haya
        // perfil para esta cuenta significa "sin acceso", NO "sin sistema
        // de permisos": si no, cualquiera a quien RLS le esconda su propia
        // fila pasaría por administrador.
        setLoaded({
          installed: true,
          profile,
          modules: Object.fromEntries(
            perms.map((p) => [
              p.module,
              { can_view: p.can_view, can_edit: p.can_edit },
            ])
          ),
        });
      })
      .catch(() => {
        // Falla la consulta = la tabla no existe todavía (BLOQUE 4 sin
        // correr). Ahí la app se comporta como antes de los permisos: una
        // cuenta sola viendo sus propias filas, en vez de quedarse en
        // blanco.
        if (!cancelled) setLoaded(NOT_INSTALLED);
      });

    return () => {
      cancelled = true;
    };
  }, [session, authLoading]);

  // Sin sesión no hay nada que cargar, así que no se espera por nada.
  const loading = authLoading || (!!session && loaded === null);
  const current = session ? (loaded ?? NOT_INSTALLED) : NOT_INSTALLED;
  const { installed, profile, modules } = current;

  const isAdmin = profile?.role === "admin" && profile.active;
  // Antes de instalar los permisos no hay a quién limitar: la única cuenta
  // es la de Andrés. Mientras TODAVÍA se está cargando no se sabe quién es,
  // y ahí la respuesta es "nadie": si no, un invitado vería por un instante
  // el Dashboard y los links de admin antes de que llegue su perfil.
  const unmanaged = !!session && !loading && !installed;

  const canView = useCallback(
    (moduleId: string) =>
      !loading && (unmanaged || isAdmin || modules[moduleId]?.can_view === true),
    [loading, unmanaged, isAdmin, modules]
  );

  const canEdit = useCallback(
    (moduleId: string) =>
      !loading && (unmanaged || isAdmin || modules[moduleId]?.can_edit === true),
    [loading, unmanaged, isAdmin, modules]
  );

  return (
    <PermissionsContext.Provider
      value={{
        profile,
        // Hasta saber quién es, no es admin. Se abre cuando se confirma,
        // no mientras se averigua.
        isAdmin: !loading && (isAdmin || unmanaged),
        loading,
        canView,
        canEdit,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePermissions() {
  return useContext(PermissionsContext);
}
