import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { usePermissions } from "../hooks/usePermissions";

// Los guardas viven acá y no en router.tsx porque ese archivo exporta el
// router (que no es un componente), y mezclar las dos cosas rompe el
// hot-reload de React.

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

// Un invitado que escriba la URL a mano no debe quedarse mirando una página
// vacía. La barrera real es RLS en Supabase: esto es cortesía, no seguridad.
export function RequireModule({
  module,
  children,
}: {
  module: string;
  children: ReactNode;
}) {
  const { canView, loading } = usePermissions();
  if (loading) return null;
  if (!canView(module)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = usePermissions();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
