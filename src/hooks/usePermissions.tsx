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
  profile: ProfileRow | null;
  modules: Record<string, { can_view: boolean; can_edit: boolean }>;
}

const EMPTY: LoadedPermissions = { profile: null, modules: {} };

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
        setLoaded({
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
        // Sin tabla app_profiles todavía (BLOQUE 4 sin correr) la app no
        // puede saber quién es admin. Se queda sin perfil, y eso significa
        // "mostrá todo": como funcionaba antes de los permisos, una cuenta
        // sola viendo sus propias filas.
        if (!cancelled) setLoaded(EMPTY);
      });

    return () => {
      cancelled = true;
    };
  }, [session, authLoading]);

  // Sin sesión no hay nada que cargar, así que no se espera por nada.
  const loading = authLoading || (!!session && loaded === null);
  const current = session ? (loaded ?? EMPTY) : EMPTY;
  const { profile, modules } = current;

  const isAdmin = profile?.role === "admin" && profile.active;
  // Sin perfil no hay sistema de permisos instalado: la app se comporta
  // como antes en vez de quedarse en blanco.
  const unmanaged = !!session && profile === null;

  const canView = useCallback(
    (moduleId: string) =>
      unmanaged || isAdmin || modules[moduleId]?.can_view === true,
    [unmanaged, isAdmin, modules]
  );

  const canEdit = useCallback(
    (moduleId: string) =>
      unmanaged || isAdmin || modules[moduleId]?.can_edit === true,
    [unmanaged, isAdmin, modules]
  );

  return (
    <PermissionsContext.Provider
      value={{
        profile,
        isAdmin: isAdmin || unmanaged,
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
