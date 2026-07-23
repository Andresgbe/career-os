import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Save, Copy, Check } from "lucide-react";
import { getGeneralInfo, saveGeneralInfo, deleteGeneralInfo } from "../api";
import type { GeneralInfoRow } from "../types";
import ConfirmDialog from "../components/ConfirmDialog";
import RichTextEditor, { RICH_CONTENT_CLASS } from "../components/RichTextEditor";
import CodeBlock from "../components/CodeBlock";

interface InfoForm {
  title: string;
  content: string;
  code: string;
}

const emptyForm: InfoForm = { title: "", content: "", code: "" };

// contentEditable often leaves block-level tags behind even when "empty";
// treat those as empty too so we don't render an empty box.
function isRichContentEmpty(html: string): boolean {
  if (!html) return true;
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  if (tmp.querySelector("img")) return false;
  return !tmp.textContent?.trim();
}

// Best-effort HTML → plain text so "Copy" pastes readable text/newlines
// instead of raw HTML tags.
function htmlToPlainText(html: string): string {
  const withBreaks = html
    .replace(/<div>/gi, "\n")
    .replace(/<\/div>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li>/gi, "\n• ")
    .replace(/<\/li>/gi, "");
  const tmp = document.createElement("div");
  tmp.innerHTML = withBreaks;
  return (tmp.textContent || "").trim();
}

export default function GeneralInfoTab() {
  const [entries, setEntries] = useState<GeneralInfoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<InfoForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<GeneralInfoRow | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    getGeneralInfo()
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const startAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (entry: GeneralInfoRow) => {
    setForm({ title: entry.title, content: entry.content, code: entry.code });
    setEditingId(entry.id);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await saveGeneralInfo(
        { title: form.title.trim(), content: form.content, code: form.code },
        editingId
      );
      setEntries((prev) =>
        editingId
          ? prev.map((e) => (e.id === editingId ? saved : e))
          : [...prev, saved]
      );
      cancelForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving entry");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteGeneralInfo(toDelete.id);
      setEntries((prev) => prev.filter((e) => e.id !== toDelete.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setToDelete(null);
    }
  };

  const handleCopy = async (entry: GeneralInfoRow) => {
    try {
      await navigator.clipboard.writeText(htmlToPlainText(entry.content));
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId((id) => (id === entry.id ? null : id)), 1500);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  if (loading) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">General info</h2>
        {!showForm && (
          <button
            onClick={startAdd}
            className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add entry
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {showForm && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Title *</label>
            <input
              type="text"
              placeholder="e.g. RIF mask, Phone mask, Deploy script..."
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Content</label>
            <RichTextEditor
              value={form.content}
              onChange={(html) => setForm({ ...form, content: html })}
              placeholder="Mask pattern, notes, images... use the toolbar for bold, uppercase, color, or bullets."
            />
          </div>

          <CodeBlock
            value={form.code}
            onChange={(code) => setForm({ ...form, code })}
            placeholder="Paste a code snippet..."
          />

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

      {entries.length === 0 && !showForm ? (
        <p className="text-sm text-muted">No entries yet.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="bg-surface border border-border rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{entry.title}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleCopy(entry)}
                    className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary"
                    title="Copy content to clipboard"
                  >
                    {copiedId === entry.id ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => startEdit(entry)}
                    className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setToDelete(entry)}
                    className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {!isRichContentEmpty(entry.content) && (
                <div
                  className={`text-sm text-muted bg-background border border-border rounded px-3 py-2 ${RICH_CONTENT_CLASS}`}
                  dangerouslySetInnerHTML={{ __html: entry.content }}
                />
              )}

              <CodeBlock value={entry.code} />
            </li>
          ))}
        </ul>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete entry?"
          message={`"${toDelete.title}" will be permanently deleted.`}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
