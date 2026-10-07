import { useEffect, useMemo, useState } from "react";
import {
  KeyRound,
  Save,
  ShieldCheck,
  UserPlus,
  Users,
  Ban,
  Check,
} from "lucide-react";
import { errorMessage } from "../../lib/errors";
import { MODULES } from "../../lib/modules";
import ConfirmDialog from "../../components/ConfirmDialog";
import { getProjects } from "../projects/api";
import type { ProjectRow } from "../projects/types";
import {
  changeMyPassword,
  getModulePermissions,
  getProfiles,
  getProjectPermissions,
  saveModulePermissions,
  saveProjectPermissions,
  updateProfile,
} from "./api";
import { displayName, NO_PERMISSION } from "./types";
import type { PermissionMap, ProfileRow } from "./types";

export default function AdminPage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getProfiles(), getProjects()])
      .then(([profileRows, projectRows]) => {
        setProfiles(profileRows);
        setProjects(projectRows);
        const firstMember = profileRows.find((p) => p.role !== "admin");
        if (firstMember) setSelectedId(firstMember.user_id);
      })
      .catch((err) => setError(errorMessage(err, "Error cargando el panel")))
      .finally(() => setLoading(false));
  }, []);

  const selected = profiles.find((p) => p.user_id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          Panel de administrador
        </h1>
        <p className="text-sm text-muted mt-1">
          Quién entra a NEXUS y qué puede ver de tus datos.
        </p>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <MyAccountCard />

      {loading ? (
        <p className="text-muted text-sm">Cargando...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">
          <UserList
            profiles={profiles}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          {selected ? (
            selected.role === "admin" ? (
              <div className="bg-surface border border-border rounded-xl p-5">
                <p className="text-sm">
                  <strong>{displayName(selected)}</strong> es administrador:
                  acceso total a todos los módulos y a todos los proyectos. No
                  hay permisos que configurar.
                </p>
              </div>
            ) : (
              <PermissionEditor
                key={selected.user_id}
                profile={selected}
                projects={projects}
                onProfileChange={(next) =>
                  setProfiles((prev) =>
                    prev.map((p) => (p.user_id === next.user_id ? next : p))
                  )
                }
              />
            )
          ) : (
            <div className="bg-surface border border-border rounded-xl p-5 text-sm text-muted">
              Elegí un usuario de la lista.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// MI CUENTA
// ============================================

function MyAccountCard() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setMessage("");
    if (password.length < 8) {
      setError("La contraseña tiene que tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    setSaving(true);
    try {
      await changeMyPassword(password);
      setPassword("");
      setConfirm("");
      setMessage("Contraseña cambiada.");
    } catch (err) {
      setError(errorMessage(err, "No se pudo cambiar la contraseña"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-surface border border-border rounded-xl p-5 space-y-3">
      <h2 className="font-semibold flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-primary" />
        Mi contraseña
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Nueva contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Repetila"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}
      <button
        onClick={submit}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        <Save className="w-4 h-4" />
        {saving ? "Guardando..." : "Cambiar contraseña"}
      </button>
    </section>
  );
}

// ============================================
// LISTA DE USUARIOS
// ============================================

interface UserListProps {
  profiles: ProfileRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function UserList({ profiles, selectedId, onSelect }: UserListProps) {
  return (
    <section className="bg-surface border border-border rounded-xl p-3 space-y-1">
      <h2 className="font-semibold flex items-center gap-2 px-2 py-1 text-sm">
        <Users className="w-4 h-4 text-primary" />
        Usuarios ({profiles.length})
      </h2>

      {profiles.map((profile) => {
        const active = profile.user_id === selectedId;
        return (
          <button
            key={profile.user_id}
            onClick={() => onSelect(profile.user_id)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              active ? "bg-primary/15 text-primary" : "hover:bg-surface-hover"
            }`}
          >
            <span className="block truncate font-medium">
              {displayName(profile)}
            </span>
            <span className="block truncate text-xs text-muted">
              {profile.role === "admin"
                ? "Administrador"
                : profile.active
                  ? "Acceso activo"
                  : "Acceso revocado"}
            </span>
          </button>
        );
      })}

      <p className="text-xs text-muted px-3 pt-3 pb-1 leading-relaxed border-t border-border mt-2">
        <UserPlus className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
        Para sumar a alguien, creale la cuenta en Supabase →{" "}
        <strong>Authentication</strong> → <strong>Add user</strong>. Aparece
        acá sin permisos; vos decidís qué ve. Para borrar la cuenta de verdad,
        también es desde ahí: acá podés revocarle el acceso, que la deja sin
        ver nada al instante.
      </p>
    </section>
  );
}

// ============================================
// EDITOR DE PERMISOS
// ============================================

interface PermissionEditorProps {
  profile: ProfileRow;
  projects: ProjectRow[];
  onProfileChange: (profile: ProfileRow) => void;
}

function PermissionEditor({
  profile,
  projects,
  onProfileChange,
}: PermissionEditorProps) {
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [projectIds, setProjectIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  // El componente se remonta por usuario (key={user_id}), así que arranca
  // en loading y no hace falta volver a ponerlo acá.
  useEffect(() => {
    Promise.all([
      getModulePermissions(profile.user_id),
      getProjectPermissions(profile.user_id),
    ])
      .then(([modulePerms, projectPerms]) => {
        setPermissions(
          Object.fromEntries(
            modulePerms.map((p) => [
              p.module,
              { can_view: p.can_view, can_edit: p.can_edit },
            ])
          )
        );
        setProjectIds(new Set(projectPerms.map((p) => p.project_id)));
      })
      .catch((err) => setError(errorMessage(err, "Error cargando permisos")))
      .finally(() => setLoading(false));
  }, [profile.user_id]);

  const projectsVisible = useMemo(
    () => permissions.projects?.can_view || permissions.projects?.can_edit,
    [permissions]
  );

  function toggle(moduleId: string, field: "can_view" | "can_edit") {
    setSaved(false);
    setPermissions((prev) => {
      const current = prev[moduleId] ?? NO_PERMISSION;
      const next = { ...current, [field]: !current[field] };
      // Editar implica ver; destildar "ver" apaga todo el módulo.
      if (field === "can_edit" && next.can_edit) next.can_view = true;
      if (field === "can_view" && !next.can_view) next.can_edit = false;
      return { ...prev, [moduleId]: next };
    });
  }

  function toggleProject(id: string) {
    setSaved(false);
    setProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await saveModulePermissions(profile.user_id, permissions);
      await saveProjectPermissions(
        profile.user_id,
        projectsVisible ? [...projectIds] : []
      );
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, "Error guardando permisos"));
    } finally {
      setSaving(false);
    }
  }

  async function setActive(active: boolean) {
    try {
      await updateProfile(profile.user_id, { active });
      onProfileChange({ ...profile, active });
    } catch (err) {
      setError(errorMessage(err, "Error actualizando el usuario"));
    }
  }

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-5 text-sm text-muted">
        Cargando permisos...
      </div>
    );
  }

  return (
    <section className="bg-surface border border-border rounded-xl p-5 space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold truncate">{displayName(profile)}</h2>
          <p className="text-xs text-muted truncate">{profile.email}</p>
        </div>
        {profile.active ? (
          <button
            onClick={() => setConfirmRevoke(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors"
          >
            <Ban className="w-3.5 h-3.5" />
            Revocar acceso
          </button>
        ) : (
          <button
            onClick={() => setActive(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/10 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Devolver acceso
          </button>
        )}
      </header>

      {!profile.active && (
        <p className="text-sm text-amber-400 bg-amber-400/10 rounded px-3 py-2">
          Esta cuenta tiene el acceso revocado: puede iniciar sesión, pero no
          ve ningún dato tuyo, tenga los permisos que tenga marcados acá.
        </p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full min-w-[380px] text-sm">
          <thead className="text-xs text-muted uppercase border-b border-border">
            <tr>
              <th className="py-2 text-left font-medium">Módulo</th>
              <th className="py-2 w-20 text-center font-medium">Ver</th>
              <th className="py-2 w-20 text-center font-medium">Editar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {MODULES.map((module) => {
              const Icon = module.icon;
              const perm = permissions[module.id] ?? NO_PERMISSION;
              return (
                <tr key={module.id}>
                  <td className="py-2.5">
                    <span className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted shrink-0" />
                      {module.name}
                    </span>
                  </td>
                  <td className="py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={perm.can_view}
                      onChange={() => toggle(module.id, "can_view")}
                      className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer"
                    />
                  </td>
                  <td className="py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={perm.can_edit}
                      onChange={() => toggle(module.id, "can_edit")}
                      className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        "Editar" incluye crear y modificar, nunca borrar: borrar tus datos
        sigue siendo solo tuyo.
      </p>

      {projectsVisible && (
        <div className="space-y-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">
            Proyectos que puede ver en Project Management
          </h3>
          <p className="text-xs text-muted">
            Sin ninguno marcado, el módulo le abre vacío.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
            {projects.map((project) => (
              <label
                key={project.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-surface-hover cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={projectIds.has(project.id)}
                  onChange={() => toggleProject(project.id)}
                  className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer shrink-0"
                />
                <span className="truncate">{project.name}</span>
              </label>
            ))}
            {projects.length === 0 && (
              <p className="text-xs text-muted">Todavía no hay proyectos.</p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Save className="w-4 h-4" />
          {saving ? "Guardando..." : "Guardar permisos"}
        </button>
        {saved && <span className="text-sm text-emerald-400">Guardado.</span>}
      </div>

      {confirmRevoke && (
        <ConfirmDialog
          title="Revocar acceso"
          confirmLabel="Revocar"
          message={`${displayName(profile)} va a dejar de ver cualquier dato tuyo de inmediato. Los permisos quedan guardados por si se lo devolvés.`}
          onCancel={() => setConfirmRevoke(false)}
          onConfirm={() => {
            setConfirmRevoke(false);
            setActive(false);
          }}
        />
      )}
    </section>
  );
}
