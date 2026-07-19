import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import {
  getAuditLog,
  addAuditEntry,
  updateAuditEntry,
  deleteAuditEntry,
  type AuditLogRow,
} from "../api";

const CATEGORIES: { value: AuditLogRow["category"]; label: string }[] = [
  { value: "maintenance", label: "Maintenance" },
  { value: "workshop", label: "Workshop" },
  { value: "upgrade", label: "Upgrade" },
  { value: "other", label: "Other" },
];

const categoryColor: Record<AuditLogRow["category"], string> = {
  maintenance: "bg-blue-500/20 text-blue-400",
  workshop: "bg-amber-500/20 text-amber-400",
  upgrade: "bg-primary/20 text-primary",
  other: "bg-surface-hover text-muted",
};

export default function AuditTab() {
  const [entries, setEntries] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState<AuditLogRow["category"]>("maintenance");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [km, setKm] = useState("");

  // Edit entry
  const [editId, setEditId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editCategory, setEditCategory] = useState<AuditLogRow["category"]>("maintenance");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editKm, setEditKm] = useState("");

  useEffect(() => {
    getAuditLog()
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : "Error loading"))
      .finally(() => setLoading(false));
  }, []);

  const add = async () => {
    if (!description.trim() || !date) return;
    try {
      const row = await addAuditEntry({
        entry_date: date,
        category,
        description: description.trim(),
        location: location.trim(),
        km: km.trim() === "" ? null : Number(km),
      });
      setEntries((prev) =>
        [...prev, row].sort((a, b) => b.entry_date.localeCompare(a.entry_date))
      );
      setDate("");
      setDescription("");
      setLocation("");
      setKm("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error adding entry");
    }
  };

  const startEdit = (entry: AuditLogRow) => {
    setEditId(entry.id);
    setEditDate(entry.entry_date);
    setEditCategory(entry.category);
    setEditDescription(entry.description);
    setEditLocation(entry.location);
    setEditKm(entry.km !== null ? String(entry.km) : "");
    setError("");
  };

  const cancelEdit = () => setEditId(null);

  const saveEdit = async () => {
    if (!editId || !editDescription.trim() || !editDate) return;
    try {
      const updated = await updateAuditEntry(editId, {
        entry_date: editDate,
        category: editCategory,
        description: editDescription.trim(),
        location: editLocation.trim(),
        km: editKm.trim() === "" ? null : Number(editKm),
      });
      setEntries((prev) =>
        prev
          .map((e) => (e.id === editId ? updated : e))
          .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
      );
      setEditId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error updating entry");
    }
  };

  const remove = async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      await deleteAuditEntry(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error deleting entry");
    }
  };

  if (loading) return <p className="text-muted">Loading...</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Add form */}
      <div className="bg-surface border border-border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
        />
        <select
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as AuditLogRow["category"])
          }
          className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none lg:col-span-2"
        />
        <input
          type="number"
          placeholder="Km"
          value={km}
          onChange={(e) => setKm(e.target.value)}
          className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
        />
        <div className="flex gap-2">
          <input
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none flex-1"
          />
          <button
            onClick={add}
            className="flex items-center px-3 py-2 rounded bg-primary hover:bg-primary-hover text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-surface border border-border rounded-xl divide-y divide-border">
        {entries.map((entry) => {
          const isEditing = editId === entry.id;

          if (isEditing) {
            return (
              <div
                key={entry.id}
                className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 bg-surface-hover/30"
              >
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                />
                <select
                  value={editCategory}
                  onChange={(e) =>
                    setEditCategory(e.target.value as AuditLogRow["category"])
                  }
                  className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none lg:col-span-2"
                />
                <input
                  type="number"
                  placeholder="Km"
                  value={editKm}
                  onChange={(e) => setEditKm(e.target.value)}
                  className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                />
                <div className="flex gap-2">
                  <input
                    placeholder="Location"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none flex-1"
                  />
                  <button
                    onClick={saveEdit}
                    className="p-2 rounded text-emerald-400 hover:bg-surface transition-colors"
                    title="Save"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-2 rounded text-muted hover:bg-surface transition-colors"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={entry.id} className="flex items-start gap-3 p-4">
              <span className="text-xs text-muted w-24 shrink-0 pt-0.5">
                {entry.entry_date}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${categoryColor[entry.category]}`}
              >
                {CATEGORIES.find((c) => c.value === entry.category)?.label}
              </span>
              <div className="flex-1">
                <p className="text-sm">{entry.description}</p>
                {(entry.location || entry.km !== null) && (
                  <p className="text-xs text-muted">
                    {entry.location}
                    {entry.location && entry.km !== null && " · "}
                    {entry.km !== null && `${entry.km.toLocaleString()} km`}
                  </p>
                )}
              </div>
              <button
                onClick={() => startEdit(entry)}
                className="p-1.5 rounded text-muted hover:text-primary hover:bg-surface-hover"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => remove(entry.id)}
                className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-surface-hover"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}

        {entries.length === 0 && (
          <p className="text-sm text-muted p-4">No entries yet.</p>
        )}
      </div>
    </div>
  );
}
