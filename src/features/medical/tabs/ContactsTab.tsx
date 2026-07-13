import { useEffect, useState } from "react";
import {
  Plus,
  X,
  Phone,
  MapPin,
  Pencil,
  Trash2,
  Save,
  UserRound,
} from "lucide-react";
import { getContacts, saveContact, deleteContact } from "../api";
import type { ContactRow } from "../types";
import ConfirmDialog from "../components/ConfirmDialog";

interface ContactForm {
  name: string;
  description: string;
  phones: string[];
  location: string;
}

const emptyForm: ContactForm = {
  name: "",
  description: "",
  phones: [],
  location: "",
};

export default function ContactsTab() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<ContactRow | null>(null);

  useEffect(() => {
    getContacts()
      .then(setContacts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const startAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (contact: ContactRow) => {
    setForm({
      name: contact.name,
      description: contact.description,
      phones: [...contact.phones],
      location: contact.location,
    });
    setEditingId(contact.id);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const setPhone = (index: number, value: string) => {
    const phones = [...form.phones];
    phones[index] = value;
    setForm({ ...form, phones });
  };

  const addPhone = () => setForm({ ...form, phones: [...form.phones, ""] });

  const removePhone = (index: number) =>
    setForm({ ...form, phones: form.phones.filter((_, i) => i !== index) });

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await saveContact(
        {
          name: form.name.trim(),
          description: form.description.trim(),
          // Drop empty phone inputs before saving
          phones: form.phones.map((p) => p.trim()).filter(Boolean),
          location: form.location.trim(),
        },
        editingId
      );
      setContacts((prev) => {
        const next = editingId
          ? prev.map((c) => (c.id === editingId ? saved : c))
          : [...prev, saved];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      cancelForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving contact");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteContact(toDelete.id);
      setContacts((prev) => prev.filter((c) => c.id !== toDelete.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Contacts</h2>
          {!showForm && (
            <button
              onClick={startAdd}
              className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add contact
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        {/* Add / Edit form */}
        {showForm && (
          <div className="bg-background border border-border rounded-lg p-4 mb-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Name *</label>
                <input
                  type="text"
                  placeholder="Person or clinic name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">
                  Location (optional)
                </label>
                <input
                  type="text"
                  placeholder="Address or reference"
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Description</label>
              <textarea
                rows={2}
                placeholder="e.g. Cardiologist, attends on weekends..."
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none resize-none"
              />
            </div>

            {/* Phones: zero or more */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-muted">Phones (optional)</label>
              {form.phones.map((phone, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted shrink-0" />
                  <input
                    type="tel"
                    placeholder="+58 412 1234567"
                    value={phone}
                    onChange={(e) => setPhone(index, e.target.value)}
                    className="flex-1 bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                  />
                  <button
                    onClick={() => removePhone(index)}
                    className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400 shrink-0"
                    title="Remove phone"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addPhone}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline w-fit"
              >
                <Plus className="w-3.5 h-3.5" />
                Add phone
              </button>
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

        {/* Contact cards */}
        {loading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : contacts.length === 0 && !showForm ? (
          <p className="text-sm text-muted">No contacts yet.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {contacts.map((contact) => (
              <li
                key={contact.id}
                className="bg-background border border-border rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserRound className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-medium text-sm break-all">
                      {contact.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(contact)}
                      className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setToDelete(contact)}
                      className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {contact.description && (
                  <p className="text-sm text-muted mb-2 whitespace-pre-wrap">
                    {contact.description}
                  </p>
                )}

                {contact.phones.length > 0 && (
                  <ul className="space-y-1 mb-2">
                    {contact.phones.map((phone, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Phone className="w-3.5 h-3.5 text-muted shrink-0" />
                        <a
                          href={`tel:${phone.replace(/\s+/g, "")}`}
                          className="hover:text-primary transition-colors"
                        >
                          {phone}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                {contact.location && (
                  <p className="flex items-center gap-2 text-xs text-muted">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {contact.location}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {toDelete && (
        <ConfirmDialog
          title="Delete contact?"
          message={`"${toDelete.name}" will be permanently deleted.`}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}