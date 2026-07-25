import { useState } from "react";
import { Plus, Trash2, Link2, ExternalLink } from "lucide-react";
import { updateProjectResources } from "../api";
import type { ProjectRow } from "../types";

interface LinksTabProps {
  project: ProjectRow;
  onProjectChange: (project: ProjectRow) => void;
}

export default function LinksTab({ project, onProjectChange }: LinksTabProps) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const links = project.resources.filter((r) => r.type === "link");

  const handleAdd = async () => {
    if (!url.trim()) {
      setError("Enter a URL.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const resources = [
        ...project.resources,
        {
          id: crypto.randomUUID(),
          type: "link" as const,
          label: label.trim(),
          value: url.trim(),
          username: "",
          password: "",
          file_path: "",
        },
      ];
      const updated = await updateProjectResources(project.id, resources);
      onProjectChange(updated);
      setLabel("");
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error adding link");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = project;
    const resources = project.resources.filter((r) => r.id !== id);
    onProjectChange({ ...project, resources });
    try {
      await updateProjectResources(project.id, resources);
    } catch (err) {
      onProjectChange(prev);
      setError(err instanceof Error ? err.message : "Error deleting link");
    }
  };

  return (
    <div className="space-y-4">
      <section className="bg-surface border border-border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Add link</h2>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2">
          <input
            type="text"
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
          />
          <input
            type="url"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5">
        {links.length === 0 ? (
          <p className="text-sm text-muted">No links yet.</p>
        ) : (
          <div className="space-y-2">
            {links.map((resource) => (
              <div
                key={resource.id}
                className="flex items-center gap-2 bg-background border border-border rounded-lg p-3"
              >
                <span className="p-1.5 rounded shrink-0 bg-blue-400/10">
                  <Link2 className="w-4 h-4 text-blue-400" />
                </span>
                <a
                  href={resource.value}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 group"
                >
                  {resource.label && (
                    <p className="text-sm font-medium truncate group-hover:text-primary">
                      {resource.label}
                    </p>
                  )}
                  <p className="text-xs text-primary truncate">{resource.value}</p>
                </a>
                <a
                  href={resource.value}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary shrink-0"
                  title="Open"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => handleDelete(resource.id)}
                  className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400 shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
