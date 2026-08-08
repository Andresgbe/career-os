import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import PasswordCard from "./components/PasswordCard";
import PasswordModal from "./components/PasswordModal";
import { getPasswordEntries } from "./api";
import type { PasswordEntryRow } from "./types";

export default function PasswordsPage() {
  const [entries, setEntries] = useState<PasswordEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<PasswordEntryRow | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getPasswordEntries()
      .then(setEntries)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.site_name.toLowerCase().includes(q) ||
        e.url.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q)
    );
  }, [entries, search]);

  const startAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const startEdit = (entry: PasswordEntryRow) => {
    setEditing(entry);
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleSaved = (saved: PasswordEntryRow) => {
    setEntries((prev) => {
      const exists = prev.some((e) => e.id === saved.id);
      return exists
        ? prev.map((e) => (e.id === saved.id ? saved : e))
        : [...prev, saved];
    });
    setShowModal(false);
  };

  const handleDeleted = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Passwords</h1>
          <p className="text-sm text-muted">
            Logins for lower-stakes sites you sign up for — not your
            important accounts.
          </p>
        </div>
        <button
          onClick={startAdd}
          className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add login
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl">
          {error}
        </div>
      )}

      {entries.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search by site, URL, or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:border-primary outline-none"
          />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted">No logins saved yet.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted">No logins match your search.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filtered.map((entry) => (
            <PasswordCard
              key={entry.id}
              entry={entry}
              onClick={() => startEdit(entry)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <PasswordModal
          entry={editing}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
