import { errorMessage } from "../../../lib/errors";
import { useEffect, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
  type DraggableProvidedDragHandleProps,
} from "@hello-pangea/dnd";
import {
  Plus,
  Trash2,
  KeyRound,
  Eye,
  EyeOff,
  Pencil,
  Check,
  X,
  ChevronDown,
  GripVertical,
  FolderPlus,
  Lock,
  Copy,
} from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import {
  updateProjectResources,
  getPrivateCredentials,
  addPrivateCredential,
  updatePrivateCredential,
  reorderPrivateCredentials,
  deletePrivateCredential,
} from "../api";
import { BOARD_COLORS } from "../types";
import type { ProjectRow, ProjectResource, PrivateCredentialRow } from "../types";

interface CredentialsTabProps {
  project: ProjectRow;
  onProjectChange: (project: ProjectRow) => void;
}

// Bucket id for credentials that aren't in any category.
const NONE = "none";
// Bucket id of the "Privada" category, backed by its own table.
const PRIVATE = "private";

const INPUT =
  "bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none";

// Categories and credentials both live in the project's `resources` jsonb:
// a category is a "credential_group" resource, a credential points at it
// through `category`. Order inside the array is the order on screen, so a
// drag just rebuilds the array.
//
// The "Privada" category is the exception: those credentials live in
// project_private_credentials, which only their creator can read (the
// resources column is readable by anyone with access to the project).
export default function CredentialsTab({ project, onProjectChange }: CredentialsTabProps) {
  const [label, setLabel] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [category, setCategory] = useState(NONE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState<Set<string>>(new Set());
  // "<id>:user" / "<id>:pass" of the value just copied, for the check mark
  const [copied, setCopied] = useState<string | null>(null);
  // Which blocks are minimized. Remembered per project in this browser.
  const collapsedKey = `nexus:credentials-collapsed:${project.id}`;
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(collapsedKey) ?? "[]");
      return new Set(Array.isArray(saved) ? saved : []);
    } catch {
      return new Set();
    }
  });

  // Per-item editing: one credential at a time, not the whole project
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [toDelete, setToDelete] = useState<ProjectResource | null>(null);

  // Category editing
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [colorMenuId, setColorMenuId] = useState<string | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<ProjectResource | null>(null);

  const [privates, setPrivates] = useState<PrivateCredentialRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    getPrivateCredentials(project.id)
      .then((rows) => {
        if (!cancelled) setPrivates(rows);
      })
      .catch((err) => {
        if (!cancelled)
          setError(errorMessage(err, "No se pudieron cargar las credenciales privadas"));
      });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const privateIds = new Set(privates.map((p) => p.id));
  const privateResources: ProjectResource[] = privates.map((p) => ({
    id: p.id,
    type: "credential",
    label: p.label,
    value: "",
    username: p.username,
    password: p.password,
    file_path: "",
  }));

  const groups = project.resources.filter((r) => r.type === "credential_group");
  const credentials = project.resources.filter((r) => r.type === "credential");
  const groupIds = new Set(groups.map((g) => g.id));
  const bucketOf = (c: ProjectResource) =>
    c.category && groupIds.has(c.category) ? c.category : NONE;

  const buckets = (): Record<string, ProjectResource[]> => {
    const result: Record<string, ProjectResource[]> = { [NONE]: [] };
    for (const g of groups) result[g.id] = [];
    for (const c of credentials) result[bucketOf(c)].push(c);
    return result;
  };

  // Lays the array back out as: other resources, categories, credentials
  // grouped by category in on-screen order.
  const rebuild = (
    nextGroups: ProjectResource[],
    nextBuckets: Record<string, ProjectResource[]>
  ): ProjectResource[] => {
    const others = project.resources.filter(
      (r) => r.type !== "credential" && r.type !== "credential_group"
    );
    const creds = [NONE, ...nextGroups.map((g) => g.id)].flatMap((id) =>
      (nextBuckets[id] ?? []).map((c) => ({ ...c, category: id === NONE ? "" : id }))
    );
    return [...others, ...nextGroups, ...creds];
  };

  const toggleIn = (setter: typeof setVisible, id: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Writes the whole resources array back, optimistically
  const persist = async (resources: ProjectResource[], failMsg: string) => {
    const prev = project;
    onProjectChange({ ...project, resources });
    try {
      const updated = await updateProjectResources(project.id, resources);
      onProjectChange(updated);
      return true;
    } catch (err) {
      onProjectChange(prev);
      setError(err instanceof Error ? err.message : failMsg);
      return false;
    }
  };

  const reorderPrivates = async (next: PrivateCredentialRow[]) => {
    const prev = privates;
    const ordered = next.map((p, i) => ({ ...p, sort_order: i }));
    setPrivates(ordered);
    try {
      await reorderPrivateCredentials(ordered.map(({ id, sort_order }) => ({ id, sort_order })));
    } catch (err) {
      setPrivates(prev);
      setError(errorMessage(err, "No se pudo reordenar"));
    }
  };

  // ---------- Credentials ----------

  const startEdit = (resource: ProjectResource) => {
    setEditId(resource.id);
    setEditLabel(resource.label);
    setEditUsername(resource.username);
    setEditPassword(resource.password);
    setError("");
  };

  const saveEdit = async () => {
    const id = editId;
    if (!id) return;
    setEditId(null);
    if (privateIds.has(id)) {
      const fields = {
        label: editLabel.trim(),
        username: editUsername.trim(),
        password: editPassword.trim(),
      };
      const prev = privates;
      setPrivates((ps) => ps.map((p) => (p.id === id ? { ...p, ...fields } : p)));
      try {
        await updatePrivateCredential(id, fields);
      } catch (err) {
        setPrivates(prev);
        setError(errorMessage(err, "No se pudo guardar la credencial"));
      }
      return;
    }
    await persist(
      project.resources.map((r) =>
        r.id === id
          ? {
              ...r,
              label: editLabel.trim(),
              username: editUsername.trim(),
              password: editPassword.trim(),
            }
          : r
      ),
      "No se pudo guardar la credencial"
    );
  };

  const confirmDelete = async () => {
    const resource = toDelete;
    setToDelete(null);
    if (!resource) return;
    if (privateIds.has(resource.id)) {
      const prev = privates;
      setPrivates((ps) => ps.filter((p) => p.id !== resource.id));
      try {
        await deletePrivateCredential(resource.id);
      } catch (err) {
        setPrivates(prev);
        setError(errorMessage(err, "No se pudo eliminar la credencial"));
      }
      return;
    }
    await persist(
      project.resources.filter((r) => r.id !== resource.id),
      "No se pudo eliminar la credencial"
    );
  };

  const handleAdd = async () => {
    if (!username.trim() && !password.trim()) {
      setError("Escribe un usuario o una contraseña.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (category === PRIVATE) {
        const row = await addPrivateCredential(project.id, {
          label: label.trim(),
          username: username.trim(),
          password: password.trim(),
          sort_order: privates.length,
        });
        setPrivates((ps) => [...ps, row]);
        setLabel("");
        setUsername("");
        setPassword("");
        return;
      }
      const next = buckets();
      const target = groupIds.has(category) ? category : NONE;
      next[target].push({
        id: crypto.randomUUID(),
        type: "credential",
        label: label.trim(),
        value: "",
        username: username.trim(),
        password: password.trim(),
        file_path: "",
        category: "",
      });
      const updated = await updateProjectResources(project.id, rebuild(groups, next));
      onProjectChange(updated);
      setLabel("");
      setUsername("");
      setPassword("");
    } catch (err) {
      setError(errorMessage(err, "No se pudo agregar la credencial"));
    } finally {
      setSaving(false);
    }
  };

  // ---------- Categories ----------

  const addGroup = async () => {
    const name = newGroupName.trim();
    setNewGroupOpen(false);
    setNewGroupName("");
    if (!name) return;
    const group: ProjectResource = {
      id: crypto.randomUUID(),
      type: "credential_group",
      label: name,
      value: BOARD_COLORS[groups.length % BOARD_COLORS.length],
      username: "",
      password: "",
      file_path: "",
    };
    await persist(rebuild([...groups, group], buckets()), "No se pudo crear la categoría");
  };

  const updateGroup = async (id: string, patch: Partial<ProjectResource>) => {
    await persist(
      project.resources.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      "No se pudo actualizar la categoría"
    );
  };

  const commitRename = async (group: ProjectResource) => {
    const name = renameDraft.trim();
    setRenameId(null);
    if (name && name !== group.label) await updateGroup(group.id, { label: name });
  };

  // Deleting a category keeps its credentials: they drop to "Sin categoría".
  const confirmDeleteGroup = async () => {
    const group = groupToDelete;
    setGroupToDelete(null);
    if (!group) return;
    const next = buckets();
    next[NONE] = [...next[NONE], ...next[group.id]];
    delete next[group.id];
    if (category === group.id) setCategory(NONE);
    await persist(
      rebuild(
        groups.filter((g) => g.id !== group.id),
        next
      ),
      "No se pudo eliminar la categoría"
    );
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    if (type === "CATEGORY") {
      const next = [...groups];
      const [moved] = next.splice(source.index, 1);
      next.splice(destination.index, 0, moved);
      await persist(rebuild(next, buckets()), "No se pudo reordenar");
      return;
    }

    const fromPrivate = source.droppableId === PRIVATE;
    const toPrivate = destination.droppableId === PRIVATE;

    if (fromPrivate && toPrivate) {
      const next = [...privates];
      const [moved] = next.splice(source.index, 1);
      next.splice(destination.index, 0, moved);
      await reorderPrivates(next);
      return;
    }

    // Leaving "Privada": copy into the project's resources, then drop the
    // private row.
    if (fromPrivate) {
      const moved = privates[source.index];
      const next = buckets();
      const to = [...next[destination.droppableId]];
      to.splice(destination.index, 0, {
        id: crypto.randomUUID(),
        type: "credential",
        label: moved.label,
        value: "",
        username: moved.username,
        password: moved.password,
        file_path: "",
        category: "",
      });
      next[destination.droppableId] = to;
      const prev = privates;
      setPrivates((ps) => ps.filter((p) => p.id !== moved.id));
      if (!(await persist(rebuild(groups, next), "No se pudo mover la credencial"))) {
        setPrivates(prev);
        return;
      }
      try {
        await deletePrivateCredential(moved.id);
      } catch (err) {
        setError(errorMessage(err, "Se copió la credencial pero no se pudo quitar de Privada"));
      }
      return;
    }

    // Entering "Privada": create the private row first, then take it out of
    // the shared resources so it stops being readable by others.
    if (toPrivate) {
      const next = buckets();
      const from = [...next[source.droppableId]];
      const [moved] = from.splice(source.index, 1);
      next[source.droppableId] = from;
      try {
        const row = await addPrivateCredential(project.id, {
          label: moved.label,
          username: moved.username,
          password: moved.password,
          sort_order: privates.length,
        });
        if (!(await persist(rebuild(groups, next), "No se pudo mover la credencial"))) {
          await deletePrivateCredential(row.id);
          return;
        }
        const list = [...privates];
        list.splice(destination.index, 0, row);
        await reorderPrivates(list);
      } catch (err) {
        setError(errorMessage(err, "No se pudo mover la credencial"));
      }
      return;
    }

    const next = buckets();
    const from = [...next[source.droppableId]];
    const [moved] = from.splice(source.index, 1);
    next[source.droppableId] = from;
    const to =
      source.droppableId === destination.droppableId
        ? from
        : [...next[destination.droppableId]];
    to.splice(destination.index, 0, moved);
    next[destination.droppableId] = to;
    await persist(rebuild(groups, next), "No se pudo mover la credencial");
  };

  const toggleCollapsed = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(collapsedKey, JSON.stringify([...next]));
      } catch {
        // Private mode / blocked storage: it just won't be remembered
      }
      return next;
    });
  };

  // ---------- Render ----------

  const copyButton = (key: string, value: string, label: string) => (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(key);
          setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
        } catch {
          setError("No se pudo copiar al portapapeles");
        }
      }}
      className={`p-1 rounded shrink-0 transition-colors ${
        copied === key ? "text-emerald-400" : "text-muted hover:text-primary hover:bg-surface-hover"
      }`}
      title={copied === key ? "Copiado" : `Copiar ${label}`}
      aria-label={`Copiar ${label}`}
    >
      {copied === key ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );

  const collapseButton = (id: string) => {
    const isCollapsed = collapsed.has(id);
    return (
      <button
        onClick={() => toggleCollapsed(id)}
        className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-foreground shrink-0"
        title={isCollapsed ? "Expandir" : "Minimizar"}
        aria-expanded={!isCollapsed}
      >
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
        />
      </button>
    );
  };

  const renderCredential = (resource: ProjectResource, index: number) => {
    const editing = editId === resource.id;
    return (
      <Draggable
        key={resource.id}
        draggableId={resource.id}
        index={index}
        isDragDisabled={editing}
      >
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`rounded-lg border p-3 ${
              editing
                ? "bg-background border-primary space-y-2"
                : `bg-background border-border ${
                    snapshot.isDragging ? "shadow-lg shadow-black/40 border-primary/60" : ""
                  }`
            }`}
          >
            {editing ? (
              <>
                <input
                  autoFocus
                  type="text"
                  placeholder="Nombre (opcional)"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className={`w-full ${INPUT} bg-surface`}
                />
                <input
                  type="text"
                  placeholder="Usuario / email"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className={`w-full ${INPUT} bg-surface`}
                />
                <input
                  type="text"
                  placeholder="Contraseña"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") setEditId(null);
                  }}
                  className={`w-full ${INPUT} bg-surface font-mono`}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditId(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-hover hover:bg-border text-xs font-medium transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancelar
                  </button>
                  <button
                    onClick={saveEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary hover:bg-primary-hover text-white text-xs font-medium transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Guardar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="p-1.5 rounded shrink-0 bg-amber-500/10">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                  </span>
                  <p className="text-sm font-medium truncate flex-1">
                    {resource.label || <span className="text-muted">Sin nombre</span>}
                  </p>
                  <button
                    onClick={() => startEdit(resource)}
                    className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary shrink-0"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setToDelete(resource)}
                    className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400 shrink-0"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-sm space-y-1 pl-1 sm:pl-9">
                  {resource.username && (
                    <p className="flex items-center gap-2">
                      <span className="text-muted shrink-0">Usuario: </span>
                      <span className="break-all">{resource.username}</span>
                      {copyButton(`${resource.id}:user`, resource.username, "usuario")}
                    </p>
                  )}
                  {resource.password && (
                    <p className="flex items-center gap-2">
                      <span className="text-muted shrink-0">Contraseña: </span>
                      <span className="font-mono break-all">
                        {visible.has(resource.id)
                          ? resource.password
                          : "•".repeat(resource.password.length)}
                      </span>
                      <button
                        onClick={() => toggleIn(setVisible, resource.id)}
                        className="text-muted hover:text-primary shrink-0"
                        title={visible.has(resource.id) ? "Ocultar" : "Mostrar"}
                      >
                        {visible.has(resource.id) ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {copyButton(`${resource.id}:pass`, resource.password, "contraseña")}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Draggable>
    );
  };

  // The drop zone of one bucket. Kept tall enough when empty so a
  // credential can still be dropped into a new category.
  const renderBucket = (id: string, items: ProjectResource[]) => (
    <Droppable droppableId={id} type="CREDENTIAL">
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`space-y-2 min-h-[52px] rounded-lg transition-colors ${
            snapshot.isDraggingOver ? "bg-primary/5" : ""
          }`}
        >
          {items.map(renderCredential)}
          {items.length === 0 && !snapshot.isDraggingOver && (
            <p className="flex items-center justify-center h-[52px] rounded-lg border border-dashed border-border text-xs text-muted">
              Arrastra credenciales aquí
            </p>
          )}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );

  const renderGroupHeader = (
    group: ProjectResource,
    count: number,
    dragHandle: DraggableProvidedDragHandleProps | null | undefined
  ) => {
    return (
      <div className={`relative flex items-center gap-2 ${collapsed.has(group.id) ? "" : "mb-3"}`}>
        <span
          {...dragHandle}
          className="p-1 -ml-1 rounded text-muted hover:text-foreground cursor-grab"
          title="Arrastrar categoría"
        >
          <GripVertical className="w-4 h-4" />
        </span>
        <button
          onClick={() => setColorMenuId(colorMenuId === group.id ? null : group.id)}
          className="w-3 h-3 rounded-full shrink-0 ring-2 ring-transparent hover:ring-border"
          style={{ backgroundColor: group.value || BOARD_COLORS[0] }}
          title="Cambiar color"
        />
        {renameId === group.id ? (
          <input
            autoFocus
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onBlur={() => commitRename(group)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename(group);
              if (e.key === "Escape") setRenameId(null);
            }}
            className={`flex-1 min-w-0 ${INPUT} py-1`}
          />
        ) : (
          <button
            onClick={() => toggleCollapsed(group.id)}
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
          >
            <span className="font-semibold text-sm uppercase tracking-wide truncate">
              {group.label}
            </span>
            <span className="text-xs text-muted shrink-0">{count}</span>
          </button>
        )}
        <button
          onClick={() => {
            setRenameId(group.id);
            setRenameDraft(group.label);
          }}
          className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary shrink-0"
          title="Renombrar"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setGroupToDelete(group)}
          className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400 shrink-0"
          title="Eliminar categoría"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        {collapseButton(group.id)}

        {colorMenuId === group.id && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setColorMenuId(null)} />
            <div className="absolute left-6 top-7 z-20 flex gap-1.5 p-2 rounded-lg bg-surface border border-border shadow-lg">
              {BOARD_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    setColorMenuId(null);
                    updateGroup(group.id, { value: color });
                  }}
                  className={`w-5 h-5 rounded-full ${
                    group.value === color ? "ring-2 ring-foreground" : ""
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={color}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const current = buckets();

  return (
    <div className="space-y-4">
      <section className="bg-surface border border-border rounded-xl p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold">Nueva credencial</h2>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <input
            type="text"
            placeholder="Nombre (opcional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={INPUT}
          />
          <input
            type="text"
            placeholder="Usuario / email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={INPUT}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className={INPUT}
          />
          <select
            value={groupIds.has(category) || category === PRIVATE ? category : NONE}
            onChange={(e) => setCategory(e.target.value)}
            className={INPUT}
          >
            <option value={NONE}>Sin categoría</option>
            <option value={PRIVATE}>Privada (solo tú)</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Agregar
        </button>
      </section>

      <DragDropContext onDragEnd={onDragEnd}>
        <section className="bg-surface border border-border border-l-4 border-l-amber-400 rounded-xl p-4 sm:p-5">
          <div className={`flex items-center gap-2 ${collapsed.has(PRIVATE) ? "" : "mb-3"}`}>
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-semibold text-sm uppercase tracking-wide">Privada</span>
            <span className="text-xs text-muted">{privates.length}</span>
            <span className="ml-auto text-xs text-muted">Solo tú la ves</span>
            {collapseButton(PRIVATE)}
          </div>
          {!collapsed.has(PRIVATE) && renderBucket(PRIVATE, privateResources)}
        </section>

        {/* Sin categoría: only shown while something is in it, or when
            there are no categories yet. */}
        {(current[NONE].length > 0 || groups.length === 0) && (
          <section className="bg-surface border border-border rounded-xl p-4 sm:p-5">
            <div className={`flex items-center gap-2 ${collapsed.has(NONE) ? "" : "mb-3"}`}>
              <span className="w-3 h-3 rounded-full bg-border shrink-0" />
              <span className="font-semibold text-sm uppercase tracking-wide text-muted">
                Sin categoría
              </span>
              <span className="text-xs text-muted">{current[NONE].length}</span>
              <span className="ml-auto" />
              {collapseButton(NONE)}
            </div>
            {collapsed.has(NONE) ? null : credentials.length === 0 && groups.length === 0 ? (
              <p className="text-sm text-muted">Todavía no hay credenciales.</p>
            ) : (
              renderBucket(NONE, current[NONE])
            )}
          </section>
        )}

        <Droppable droppableId="categories" type="CATEGORY">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
              {groups.map((group, index) => (
                <Draggable key={group.id} draggableId={group.id} index={index}>
                  {(dragProvided, snapshot) => (
                    <section
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={`bg-surface border rounded-xl p-4 sm:p-5 border-l-4 ${
                        snapshot.isDragging ? "border-primary/60 shadow-lg shadow-black/40" : "border-border"
                      }`}
                      style={{
                        ...dragProvided.draggableProps.style,
                        borderLeftColor: group.value || BOARD_COLORS[0],
                      }}
                    >
                      {renderGroupHeader(
                        group,
                        current[group.id].length,
                        dragProvided.dragHandleProps
                      )}
                      {!collapsed.has(group.id) && renderBucket(group.id, current[group.id])}
                    </section>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {newGroupOpen ? (
        <div className="flex items-center gap-2 bg-surface border border-primary rounded-xl p-3">
          <input
            autoFocus
            placeholder="Nombre de la categoría (ej. SUPABASE)"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addGroup();
              if (e.key === "Escape") {
                setNewGroupOpen(false);
                setNewGroupName("");
              }
            }}
            className={`flex-1 min-w-0 ${INPUT}`}
          />
          <button
            onClick={addGroup}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
          >
            <Check className="w-4 h-4" />
            Crear
          </button>
          <button
            onClick={() => {
              setNewGroupOpen(false);
              setNewGroupName("");
            }}
            className="p-2 rounded-lg text-muted hover:bg-surface-hover"
            aria-label="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setNewGroupOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border text-sm text-muted hover:text-foreground hover:border-primary/60 transition-colors"
        >
          <FolderPlus className="w-4 h-4" />
          Nueva categoría
        </button>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Eliminar credencial"
          message={`¿Eliminar "${toDelete.label || toDelete.username || "esta credencial"}"?`}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}

      {groupToDelete && (
        <ConfirmDialog
          title="Eliminar categoría"
          message={`Se elimina "${groupToDelete.label}". Sus credenciales no se borran: pasan a "Sin categoría".`}
          confirmLabel="Eliminar"
          onConfirm={confirmDeleteGroup}
          onCancel={() => setGroupToDelete(null)}
        />
      )}
    </div>
  );
}
