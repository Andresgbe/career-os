import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { mockAudit } from "../mockData";
import type { AuditEntry, AuditCategory } from "../types";

const CATEGORIES: { value: AuditCategory; label: string }[] = [
  { value: "maintenance", label: "Maintenance" },
  { value: "workshop", label: "Workshop" },
  { value: "upgrade", label: "Upgrade" },
  { value: "other", label: "Other" },
];

const categoryColor: Record<AuditCategory, string> = {
  maintenance: "bg-blue-500/20 text-blue-400",
  workshop: "bg-amber-500/20 text-amber-400",
  upgrade: "bg-primary/20 text-primary",
  other: "bg-surface-hover text-muted",
};

export default function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>(mockAudit);
  const [date, setDate] = useState("");
  const [category, setCategory] = useState<AuditCategory>("maintenance");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  const add = () => {
    if (!description.trim() || !date) return;
    setEntries(
      [
        ...entries,
        { id: crypto.randomUUID(), date, category, description, location },
      ].sort((a, b) => b.date.localeCompare(a.date))
    );
    setDate("");
    setDescription("");
    setLocation("");
  };

  const remove = (id: string) => setEntries(entries.filter((e) => e.id !== id));

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="bg-surface border border-border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as AuditCategory)}
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
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-3 p-4">
            <span className="text-xs text-muted w-24 shrink-0 pt-0.5">
              {entry.date}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${categoryColor[entry.category]}`}
            >
              {CATEGORIES.find((c) => c.value === entry.category)?.label}
            </span>
            <div className="flex-1">
              <p className="text-sm">{entry.description}</p>
              {entry.location && (
                <p className="text-xs text-muted">{entry.location}</p>
              )}
            </div>
            <button
              onClick={() => remove(entry.id)}
              className="p-1.5 rounded text-muted hover:bg-surface-hover"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}