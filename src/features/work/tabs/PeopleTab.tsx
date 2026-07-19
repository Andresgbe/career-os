import { useEffect, useState } from "react";
import { Plus, X, Pencil, Trash2, Save, UserRound, Route } from "lucide-react";
import { getPeople, savePerson, deletePerson } from "../api";
import type { PersonRow } from "../types";
import ConfirmDialog from "../components/ConfirmDialog";

interface PersonForm {
  name: string;
  role: string;
  routes: string[];
  notes: string;
}

const emptyForm: PersonForm = { name: "", role: "", routes: [], notes: "" };

export default function PeopleTab() {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<PersonForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<PersonRow | null>(null);

  useEffect(() => {
    getPeople()
      .then(setPeople)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const startAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (person: PersonRow) => {
    setForm({
      name: person.name,
      role: person.role,
      routes: [...person.routes],
      notes: person.notes,
    });
    setEditingId(person.id);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const setRoute = (index: number, value: string) => {
    const routes = [...form.routes];
    routes[index] = value;
    setForm({ ...form, routes });
  };

  const addRoute = () => setForm({ ...form, routes: [...form.routes, ""] });

  const removeRoute = (index: number) =>
    setForm({ ...form, routes: form.routes.filter((_, i) => i !== index) });

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await savePerson(
        {
          name: form.name.trim(),
          role: form.role.trim(),
          routes: form.routes.map((r) => r.trim()).filter(Boolean),
          notes: form.notes.trim(),
        },
        editingId
      );
      setPeople((prev) => {
        const next = editingId
          ? prev.map((p) => (p.id === editingId ? saved : p))
          : [...prev, saved];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      cancelForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving person");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deletePerson(toDelete.id);
      setPeople((prev) => prev.filter((p) => p.id !== toDelete.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setToDelete(null);
    }
  };

  if (loading) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Team members</h2>
        {!showForm && (
          <button
            onClick={startAdd}
            className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add person
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {showForm && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Role (optional)</label>
              <input
                type="text"
                placeholder="e.g. Backend, QA"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted">
              Routes / endpoints (optional)
            </label>
            {form.routes.map((route, index) => (
              <div key={index} className="flex items-center gap-2">
                <Route className="w-4 h-4 text-muted shrink-0" />
                <input
                  type="text"
                  placeholder="/api/users/:id"
                  value={route}
                  onChange={(e) => setRoute(index, e.target.value)}
                  className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm font-mono focus:border-primary outline-none"
                />
                <button
                  onClick={() => removeRoute(index)}
                  className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400 shrink-0"
                  title="Remove route"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={addRoute}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline w-fit"
            >
              <Plus className="w-3.5 h-3.5" />
              Add route
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={cancelForm}
              className="px-4 py-2 rounded bg-surface-hover hover:bg-border text-foreground text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : editingId ? "Update" : "Save"}
            </button>
          </div>
        </div>
      )}

      {people.length === 0 && !showForm ? (
        <p className="text-sm text-muted">No team members yet.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {people.map((person) => (
            <li
              key={person.id}
              className="bg-surface border border-border rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <UserRound className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-medium text-sm truncate">
                    {person.name}
                  </span>
                  {person.role && (
                    <span className="text-xs text-muted px-2 py-0.5 bg-surface-hover rounded-full shrink-0">
                      {person.role}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(person)}
                    className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setToDelete(person)}
                    className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {person.notes && (
                <p className="text-sm text-muted mb-2 whitespace-pre-wrap">
                  {person.notes}
                </p>
              )}

              {person.routes.length > 0 && (
                <ul className="space-y-1">
                  {person.routes.map((route, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-2 text-xs font-mono text-muted bg-background border border-border rounded px-2 py-1"
                    >
                      <Route className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{route}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete person?"
          message={`"${toDelete.name}" will be permanently deleted.`}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
