import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import InsuranceCard from "./components/InsuranceCard";
import InsuranceModal from "./components/InsuranceModal";
import { getInsurancePolicies } from "./api";
import type { InsuranceRow } from "./types";

export default function InsurancePage() {
  const [policies, setPolicies] = useState<InsuranceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<InsuranceRow | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    getInsurancePolicies()
      .then(setPolicies)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const startAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const startEdit = (policy: InsuranceRow) => {
    setEditing(policy);
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleSaved = (saved: InsuranceRow) => {
    setPolicies((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      return exists
        ? prev.map((p) => (p.id === saved.id ? saved : p))
        : [...prev, saved];
    });
    setShowModal(false);
  };

  const handleDeleted = (id: string) => {
    setPolicies((prev) => prev.filter((p) => p.id !== id));
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Insurance</h1>
          <p className="text-sm text-muted">
            Track your insurance policies, coverage, and contacts.
          </p>
        </div>
        <button
          onClick={startAdd}
          className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add policy
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : policies.length === 0 ? (
        <p className="text-sm text-muted">No insurance policies yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {policies.map((policy) => (
            <InsuranceCard
              key={policy.id}
              policy={policy}
              onClick={() => startEdit(policy)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <InsuranceModal
          policy={editing}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
