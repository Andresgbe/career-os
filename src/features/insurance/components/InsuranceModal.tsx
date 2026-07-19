import { useState } from "react";
import { X, Save, Trash2, Phone, Plus, UserRound } from "lucide-react";
import { saveInsurancePolicy, deleteInsurancePolicy } from "../api";
import type { InsuranceContact, InsuranceRow, PolicyType } from "../types";
import { POLICY_TYPES } from "../types";
import ConfirmDialog from "./ConfirmDialog";

interface InsuranceForm {
  insurer_name: string;
  policy_type: PolicyType;
  policy_number: string;
  premium: string; // kept as string while editing, parsed on save
  renewal_date: string;
  contacts: InsuranceContact[];
  contact_email: string;
  notes: string;
}

const emptyContact: InsuranceContact = { name: "", phone: "", is_emergency: false };

const emptyForm: InsuranceForm = {
  insurer_name: "",
  policy_type: "auto",
  policy_number: "",
  premium: "",
  renewal_date: "",
  contacts: [],
  contact_email: "",
  notes: "",
};

function toForm(policy: InsuranceRow): InsuranceForm {
  return {
    insurer_name: policy.insurer_name,
    policy_type: policy.policy_type,
    policy_number: policy.policy_number,
    premium: policy.premium == null ? "" : String(policy.premium),
    renewal_date: policy.renewal_date ?? "",
    contacts: policy.contacts.map((c) => ({ ...c })),
    contact_email: policy.contact_email,
    notes: policy.notes,
  };
}

interface InsuranceModalProps {
  policy: InsuranceRow | null; // null = adding a new policy
  onClose: () => void;
  onSaved: (policy: InsuranceRow) => void;
  onDeleted: (id: string) => void;
}

export default function InsuranceModal({
  policy,
  onClose,
  onSaved,
  onDeleted,
}: InsuranceModalProps) {
  const [form, setForm] = useState<InsuranceForm>(
    policy ? toForm(policy) : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const setContact = (index: number, fields: Partial<InsuranceContact>) => {
    const contacts = [...form.contacts];
    contacts[index] = { ...contacts[index], ...fields };
    setForm({ ...form, contacts });
  };

  const addContact = () =>
    setForm({ ...form, contacts: [...form.contacts, { ...emptyContact }] });

  const removeContact = (index: number) =>
    setForm({
      ...form,
      contacts: form.contacts.filter((_, i) => i !== index),
    });

  const handleSave = async () => {
    if (!form.insurer_name.trim()) {
      setError("Insurer name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await saveInsurancePolicy(
        {
          insurer_name: form.insurer_name.trim(),
          policy_type: form.policy_type,
          policy_number: form.policy_number.trim(),
          premium: form.premium.trim() === "" ? null : Number(form.premium),
          renewal_date: form.renewal_date || null,
          contacts: form.contacts
            .map((c) => ({ ...c, name: c.name.trim(), phone: c.phone.trim() }))
            .filter((c) => c.name || c.phone),
          contact_email: form.contact_email.trim(),
          notes: form.notes.trim(),
        },
        policy?.id ?? null
      );
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving policy");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!policy) return;
    try {
      await deleteInsurancePolicy(policy.id);
      onDeleted(policy.id);
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
        className="bg-surface border border-border rounded-xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">
            {policy ? "Edit insurance policy" : "Add insurance policy"}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Insurer name *</label>
              <input
                type="text"
                placeholder="e.g. Mapfre"
                value={form.insurer_name}
                onChange={(e) =>
                  setForm({ ...form, insurer_name: e.target.value })
                }
                className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Type</label>
              <select
                value={form.policy_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    policy_type: e.target.value as PolicyType,
                  })
                }
                className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
              >
                {POLICY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Policy number</label>
              <input
                type="text"
                value={form.policy_number}
                onChange={(e) =>
                  setForm({ ...form, policy_number: e.target.value })
                }
                className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">
                Premium (optional)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.premium}
                onChange={(e) =>
                  setForm({ ...form, premium: e.target.value })
                }
                className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Renewal date</label>
            <input
              type="date"
              value={form.renewal_date}
              onChange={(e) =>
                setForm({ ...form, renewal_date: e.target.value })
              }
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
            />
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <p className="text-xs text-muted font-medium">Contacts</p>

            <div className="flex flex-col gap-3">
              {form.contacts.map((contact, index) => (
                <div
                  key={index}
                  className="bg-background border border-border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <UserRound className="w-4 h-4 text-muted shrink-0" />
                    <input
                      type="text"
                      placeholder="Contact name"
                      value={contact.name}
                      onChange={(e) =>
                        setContact(index, { name: e.target.value })
                      }
                      className="flex-1 bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                    />
                    <button
                      onClick={() => removeContact(index)}
                      className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400 shrink-0"
                      title="Remove contact"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted shrink-0" />
                    <input
                      type="tel"
                      placeholder="+58 412 1234567"
                      value={contact.phone}
                      onChange={(e) =>
                        setContact(index, { phone: e.target.value })
                      }
                      className="flex-1 bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted pl-6">
                    <input
                      type="checkbox"
                      checked={contact.is_emergency}
                      onChange={(e) =>
                        setContact(index, { is_emergency: e.target.checked })
                      }
                      className="accent-primary"
                    />
                    Emergency contact (shown on the card)
                  </label>
                </div>
              ))}
              <button
                onClick={addContact}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline w-fit"
              >
                <Plus className="w-3.5 h-3.5" />
                Add contact
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Email</label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) =>
                  setForm({ ...form, contact_email: e.target.value })
                }
                className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Notes</label>
            <textarea
              rows={3}
              placeholder="Coverage details, deductible, exclusions..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-5">
          {policy ? (
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
              {saving ? "Saving..." : policy ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete policy?"
          message={`"${policy?.insurer_name}" will be permanently deleted.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
