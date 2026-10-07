import { errorMessage } from "../../../lib/errors";
import { useState } from "react";
import { Plus, Trash2, KeyRound, Eye, EyeOff, Pencil, Check, X } from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import { updateProjectResources } from "../api";
import type { ProjectRow, ProjectResource } from "../types";

interface CredentialsTabProps {
  project: ProjectRow;
  onProjectChange: (project: ProjectRow) => void;
}

export default function CredentialsTab({ project, onProjectChange }: CredentialsTabProps) {
  const [label, setLabel] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState<Set<string>>(new Set());

  // Per-item editing: one credential at a time, not the whole project
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [toDelete, setToDelete] = useState<ProjectResource | null>(null);

  const credentials = project.resources.filter((r) => r.type === "credential");

  const toggleVisible = (id: string) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
      setError(err instanceof Error ? err.message : failMsg);
      return false;
    }
  };

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
      "Error updating credential"
    );
  };

  const confirmDelete = async () => {
    const resource = toDelete;
    setToDelete(null);
    if (!resource) return;
    await persist(
      project.resources.filter((r) => r.id !== resource.id),
      "Error deleting credential"
    );
  };

  const handleAdd = async () => {
    if (!username.trim() && !password.trim()) {
      setError("Enter a username or password.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const resources = [
        ...project.resources,
        {
          id: crypto.randomUUID(),
          type: "credential" as const,
          label: label.trim(),
          value: "",
          username: username.trim(),
          password: password.trim(),
          file_path: "",
        },
      ];
      const updated = await updateProjectResources(project.id, resources);
      onProjectChange(updated);
      setLabel("");
      setUsername("");
      setPassword("");
    } catch (err) {
      setError(errorMessage(err, "Error adding credential"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="bg-surface border border-border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Add credential</h2>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
          />
          <input
            type="text"
            placeholder="Username / email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5">
        {credentials.length === 0 ? (
          <p className="text-sm text-muted">No credentials yet.</p>
        ) : (
          <div className="space-y-2">
            {credentials.map((resource) =>
              editId === resource.id ? (
                <div
                  key={resource.id}
                  className="bg-background border border-primary rounded-lg p-3 space-y-2"
                >
                  <input
                    autoFocus
                    type="text"
                    placeholder="Label (optional)"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="w-full bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Username"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") setEditId(null);
                    }}
                    className="w-full bg-surface border border-border rounded px-3 py-2 text-sm font-mono focus:border-primary outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditId(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-hover hover:bg-border text-xs font-medium transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary hover:bg-primary-hover text-white text-xs font-medium transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save
                    </button>
                  </div>
                </div>
              ) : (
              <div
                key={resource.id}
                className="bg-background border border-border rounded-lg p-3"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="p-1.5 rounded shrink-0 bg-amber-500/10">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                  </span>
                  {resource.label && (
                    <p className="text-sm font-medium truncate flex-1">{resource.label}</p>
                  )}
                  <button
                    onClick={() => startEdit(resource)}
                    className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary shrink-0"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setToDelete(resource)}
                    className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400 shrink-0"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-sm space-y-1 pl-9">
                  {resource.username && (
                    <p>
                      <span className="text-muted">User: </span>
                      {resource.username}
                    </p>
                  )}
                  {resource.password && (
                    <p className="flex items-center gap-2">
                      <span className="text-muted">Password: </span>
                      <span className="font-mono">
                        {visible.has(resource.id)
                          ? resource.password
                          : "•".repeat(resource.password.length)}
                      </span>
                      <button
                        onClick={() => toggleVisible(resource.id)}
                        className="text-muted hover:text-primary"
                      >
                        {visible.has(resource.id) ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </p>
                  )}
                </div>
              </div>
              )
            )}
          </div>
        )}
      </section>

      {toDelete && (
        <ConfirmDialog
          title="Delete credential"
          message={`Delete "${toDelete.label || toDelete.username || "this credential"}"?`}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
