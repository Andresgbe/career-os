import { errorMessage } from "../../../lib/errors";
import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Link2,
  ExternalLink,
  Pencil,
  Check,
  X,
  Lock,
  LockOpen,
} from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import {
  updateProjectResources,
  getPrivateLinks,
  addPrivateLink,
  updatePrivateLink,
  deletePrivateLink,
} from "../api";
import type { ProjectRow, ProjectResource, PrivateLinkRow } from "../types";

interface LinksTabProps {
  project: ProjectRow;
  onProjectChange: (project: ProjectRow) => void;
  // Admin/owner only: the "Privada" section, backed by project_private_links
  allowPrivate?: boolean;
}

// One row on screen, whichever store it lives in
interface LinkItem {
  id: string;
  label: string;
  url: string;
  isPrivate: boolean;
}

const INPUT =
  "bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none";

// Public links live in the project's `resources` jsonb, readable by anyone
// with access to the project. Private ones live in their own table that
// only their creator can read.
export default function LinksTab({ project, onProjectChange, allowPrivate = false }: LinksTabProps) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [makePrivate, setMakePrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [privates, setPrivates] = useState<PrivateLinkRow[]>([]);

  // Per-item editing: one link at a time, independent of the project modal
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [toDelete, setToDelete] = useState<LinkItem | null>(null);

  useEffect(() => {
    if (!allowPrivate) return;
    let cancelled = false;
    getPrivateLinks(project.id)
      .then((rows) => {
        if (!cancelled) setPrivates(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, "No se pudieron cargar los links privados"));
      });
    return () => {
      cancelled = true;
    };
  }, [project.id, allowPrivate]);

  const publicLinks: LinkItem[] = project.resources
    .filter((r) => r.type === "link")
    .map((r) => ({ id: r.id, label: r.label, url: r.value, isPrivate: false }));
  const privateLinks: LinkItem[] = privates.map((p) => ({
    id: p.id,
    label: p.label,
    url: p.url,
    isPrivate: true,
  }));

  // Writes the whole resources array back, but only ever changes one item
  const persist = async (resources: ProjectResource[], failMsg: string) => {
    const prev = project;
    onProjectChange({ ...project, resources });
    try {
      const updated = await updateProjectResources(project.id, resources);
      onProjectChange(updated);
      return true;
    } catch (err) {
      onProjectChange(prev);
      setError(errorMessage(err, failMsg));
      return false;
    }
  };

  const newResource = (linkLabel: string, linkUrl: string): ProjectResource => ({
    id: crypto.randomUUID(),
    type: "link",
    label: linkLabel,
    value: linkUrl,
    username: "",
    password: "",
    file_path: "",
  });

  const handleAdd = async () => {
    if (!url.trim()) {
      setError("Escribe una URL.");
      return;
    }
    setSaving(true);
    setError("");
    let ok = true;
    if (makePrivate && allowPrivate) {
      try {
        const row = await addPrivateLink(project.id, {
          label: label.trim(),
          url: url.trim(),
          sort_order: privates.length,
        });
        setPrivates((ps) => [...ps, row]);
      } catch (err) {
        setError(errorMessage(err, "No se pudo agregar el link"));
        ok = false;
      }
    } else {
      ok = await persist(
        [...project.resources, newResource(label.trim(), url.trim())],
        "No se pudo agregar el link"
      );
    }
    if (ok) {
      setLabel("");
      setUrl("");
    }
    setSaving(false);
  };

  const startEdit = (item: LinkItem) => {
    setEditId(item.id);
    setEditLabel(item.label);
    setEditUrl(item.url);
    setError("");
  };

  const saveEdit = async (item: LinkItem) => {
    if (!editUrl.trim()) {
      setError("Escribe una URL.");
      return;
    }
    setEditId(null);
    const fields = { label: editLabel.trim(), url: editUrl.trim() };
    if (item.isPrivate) {
      const prev = privates;
      setPrivates((ps) => ps.map((p) => (p.id === item.id ? { ...p, ...fields } : p)));
      try {
        await updatePrivateLink(item.id, fields);
      } catch (err) {
        setPrivates(prev);
        setError(errorMessage(err, "No se pudo guardar el link"));
      }
      return;
    }
    await persist(
      project.resources.map((r) =>
        r.id === item.id ? { ...r, label: fields.label, value: fields.url } : r
      ),
      "No se pudo guardar el link"
    );
  };

  const confirmDelete = async () => {
    const item = toDelete;
    setToDelete(null);
    if (!item) return;
    if (item.isPrivate) {
      const prev = privates;
      setPrivates((ps) => ps.filter((p) => p.id !== item.id));
      try {
        await deletePrivateLink(item.id);
      } catch (err) {
        setPrivates(prev);
        setError(errorMessage(err, "No se pudo eliminar el link"));
      }
      return;
    }
    await persist(
      project.resources.filter((r) => r.id !== item.id),
      "No se pudo eliminar el link"
    );
  };

  // Moves a link between the shared list and "Privada". Going private, the
  // private row is created first and only then removed from the shared list,
  // so a failure never loses the link.
  const togglePrivate = async (item: LinkItem) => {
    setError("");
    if (item.isPrivate) {
      const prev = privates;
      setPrivates((ps) => ps.filter((p) => p.id !== item.id));
      if (
        !(await persist(
          [...project.resources, newResource(item.label, item.url)],
          "No se pudo mover el link"
        ))
      ) {
        setPrivates(prev);
        return;
      }
      try {
        await deletePrivateLink(item.id);
      } catch (err) {
        setError(errorMessage(err, "Se copió el link pero no se pudo quitar de Privada"));
      }
      return;
    }
    try {
      const row = await addPrivateLink(project.id, {
        label: item.label,
        url: item.url,
        sort_order: privates.length,
      });
      if (
        !(await persist(
          project.resources.filter((r) => r.id !== item.id),
          "No se pudo mover el link"
        ))
      ) {
        await deletePrivateLink(row.id);
        return;
      }
      setPrivates((ps) => [...ps, row]);
    } catch (err) {
      setError(errorMessage(err, "No se pudo mover el link"));
    }
  };

  const renderLink = (item: LinkItem) =>
    editId === item.id ? (
      <div key={item.id} className="bg-background border border-primary rounded-lg p-3 space-y-2">
        <input
          autoFocus
          type="text"
          placeholder="Nombre (opcional)"
          value={editLabel}
          onChange={(e) => setEditLabel(e.target.value)}
          className={`w-full ${INPUT} bg-surface`}
        />
        <input
          type="url"
          placeholder="https://..."
          value={editUrl}
          onChange={(e) => setEditUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit(item);
            if (e.key === "Escape") setEditId(null);
          }}
          className={`w-full ${INPUT} bg-surface`}
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
            onClick={() => saveEdit(item)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary hover:bg-primary-hover text-white text-xs font-medium transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Guardar
          </button>
        </div>
      </div>
    ) : (
      <div
        key={item.id}
        className="flex items-center gap-1 sm:gap-2 bg-background border border-border rounded-lg p-3"
      >
        <span
          className={`p-1.5 rounded shrink-0 mr-1 ${
            item.isPrivate ? "bg-amber-400/10" : "bg-blue-400/10"
          }`}
        >
          <Link2 className={`w-4 h-4 ${item.isPrivate ? "text-amber-400" : "text-blue-400"}`} />
        </span>
        <a href={item.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 group">
          {item.label && (
            <p className="text-sm font-medium truncate group-hover:text-primary">{item.label}</p>
          )}
          <p className="text-xs text-primary truncate">{item.url}</p>
        </a>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary shrink-0"
          title="Abrir"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
        {allowPrivate && (
          <button
            onClick={() => togglePrivate(item)}
            className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-amber-400 shrink-0"
            title={item.isPrivate ? "Hacer visible para el cliente" : "Hacer privado"}
          >
            {item.isPrivate ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </button>
        )}
        <button
          onClick={() => startEdit(item)}
          className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary shrink-0"
          title="Editar"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => setToDelete(item)}
          className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400 shrink-0"
          title="Eliminar"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );

  return (
    <div className="space-y-4">
      <section className="bg-surface border border-border rounded-xl p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold">Nuevo link</h2>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div
          className={`grid grid-cols-1 gap-2 ${
            allowPrivate ? "sm:grid-cols-[1fr_2fr_auto_auto]" : "sm:grid-cols-[1fr_2fr_auto]"
          }`}
        >
          <input
            type="text"
            placeholder="Nombre (opcional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={INPUT}
          />
          <input
            type="url"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className={INPUT}
          />
          {allowPrivate && (
            <button
              onClick={() => setMakePrivate((v) => !v)}
              aria-pressed={makePrivate}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                makePrivate
                  ? "border-amber-400/60 bg-amber-400/10 text-amber-300"
                  : "border-border text-muted hover:text-foreground"
              }`}
              title="Solo tú lo ves"
            >
              {makePrivate ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
              Privado
            </button>
          )}
          <button
            onClick={handleAdd}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        </div>
      </section>

      {allowPrivate && (
        <section className="bg-surface border border-border border-l-4 border-l-amber-400 rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-semibold text-sm uppercase tracking-wide">Privada</span>
            <span className="text-xs text-muted">{privateLinks.length}</span>
            <span className="ml-auto text-xs text-muted">Solo tú la ves</span>
          </div>
          {privateLinks.length === 0 ? (
            <p className="text-sm text-muted">
              Usa el candado de un link o el botón "Privado" para guardarlo aquí.
            </p>
          ) : (
            <div className="space-y-2">{privateLinks.map(renderLink)}</div>
          )}
        </section>
      )}

      <section className="bg-surface border border-border rounded-xl p-4 sm:p-5">
        {allowPrivate && (
          <div className="flex items-center gap-2 mb-3">
            <span className="font-semibold text-sm uppercase tracking-wide">Links</span>
            <span className="text-xs text-muted">{publicLinks.length}</span>
            <span className="ml-auto text-xs text-muted">Los ve el cliente</span>
          </div>
        )}
        {publicLinks.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay links.</p>
        ) : (
          <div className="space-y-2">{publicLinks.map(renderLink)}</div>
        )}
      </section>

      {toDelete && (
        <ConfirmDialog
          title="Eliminar link"
          message={`¿Eliminar "${toDelete.label || toDelete.url}"?`}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
