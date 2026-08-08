import { useState } from "react";
import { X, Save, Trash2, Eye, EyeOff, Copy, Check } from "lucide-react";
import { savePasswordEntry, deletePasswordEntry } from "../api";
import type { PasswordEntryRow } from "../types";
import ConfirmDialog from "../../../components/ConfirmDialog";

interface PasswordForm {
  site_name: string;
  url: string;
  username: string;
  password: string;
  notes: string;
}

const emptyForm: PasswordForm = {
  site_name: "",
  url: "",
  username: "",
  password: "",
  notes: "",
};

function toForm(entry: PasswordEntryRow): PasswordForm {
  return {
    site_name: entry.site_name,
    url: entry.url,
    username: entry.username,
    password: entry.password,
    notes: entry.notes,
  };
}

interface PasswordModalProps {
  entry: PasswordEntryRow | null; // null = adding a new entry
  onClose: () => void;
  onSaved: (entry: PasswordEntryRow) => void;
  onDeleted: (id: string) => void;
}

export default function PasswordModal({
  entry,
  onClose,
  onSaved,
  onDeleted,
}: PasswordModalProps) {
  const [form, setForm] = useState<PasswordForm>(
    entry ? toForm(entry) : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!form.password) return;
    try {
      await navigator.clipboard.writeText(form.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard access denied; nothing else to do
    }
  };

  const handleSave = async () => {
    if (!form.site_name.trim()) {
      setError("Site name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await savePasswordEntry(
        {
          site_name: form.site_name.trim(),
          url: form.url.trim(),
          username: form.username.trim(),
          password: form.password,
          notes: form.notes.trim(),
        },
        entry?.id ?? null
      );
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving entry");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entry) return;
    try {
      await deletePasswordEntry(entry.id);
      onDeleted(entry.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setConfirmingDelete(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">
            {entry ? "Edit login" : "Add login"}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-muted hover:bg-surface-hover"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Site name *</label>
            <input
              type="text"
              autoFocus
              placeholder="e.g. Some forum I signed up for"
              value={form.site_name}
              onChange={(e) => setForm({ ...form, site_name: e.target.value })}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">URL</label>
            <input
              type="text"
              placeholder="e.g. example.com"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Username / email</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Password</label>
            <div className="flex items-center gap-2">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
              />
              <button
                onClick={() => setShowPassword((s) => !s)}
                type="button"
                className="p-2 rounded text-muted hover:bg-surface-hover hover:text-foreground shrink-0"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={handleCopy}
                type="button"
                className="p-2 rounded text-muted hover:bg-surface-hover hover:text-foreground shrink-0"
                title="Copy password"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Notes</label>
            <textarea
              rows={3}
              placeholder="Security question answers, recovery email, etc."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-5">
          {entry ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-2 px-4 py-2 rounded text-red-400 hover:bg-surface-hover text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
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
              {saving ? "Saving..." : entry ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete login?"
          message={`"${entry?.site_name}" will be permanently deleted.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
