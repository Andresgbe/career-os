import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import type { BillRow } from "../types";
import { getBills, addBill, updateBill, deleteBill } from "../api";

export default function BillsTab() {
  const [bills, setBills] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New bill
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [adding, setAdding] = useState(false);

  // Edit bill
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  useEffect(() => {
    getBills()
      .then(setBills)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const totalAmount = bills.reduce((acc, b) => acc + b.amount, 0);
  const totalUnpaid = bills
    .filter((b) => !b.paid)
    .reduce((acc, b) => acc + b.amount, 0);

  const handleAdd = async () => {
    if (!newName.trim() || !newAmount) {
      setError("Enter a name and amount.");
      return;
    }
    const amountNum = parseFloat(newAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      setError("Amount must be a positive number.");
      return;
    }
    let rateNum: number | null = null;
    if (newRate.trim() !== "") {
      rateNum = parseFloat(newRate);
      if (isNaN(rateNum) || rateNum < 0) {
        setError("Rate must be a positive number.");
        return;
      }
    }

    setAdding(true);
    setError("");
    try {
      const row = await addBill({
        name: newName.trim(),
        description: newDescription.trim(),
        amount: amountNum,
        interest_rate: rateNum,
        due_date: newDueDate || null,
      });
      setBills([...bills, row]);
      setNewName("");
      setNewDescription("");
      setNewAmount("");
      setNewRate("");
      setNewDueDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error adding bill");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (bill: BillRow) => {
    setEditId(bill.id);
    setEditName(bill.name);
    setEditDescription(bill.description);
    setEditAmount(bill.amount.toString());
    setEditRate(bill.interest_rate !== null ? bill.interest_rate.toString() : "");
    setEditDueDate(bill.due_date || "");
    setError("");
  };

  const saveEdit = async () => {
    if (!editId || !editName.trim() || !editAmount) return;

    const amountNum = parseFloat(editAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      setError("Amount must be a positive number.");
      return;
    }
    let rateNum: number | null = null;
    if (editRate.trim() !== "") {
      rateNum = parseFloat(editRate);
      if (isNaN(rateNum) || rateNum < 0) {
        setError("Rate must be a positive number.");
        return;
      }
    }

    setError("");
    try {
      const updated = await updateBill(editId, {
        name: editName.trim(),
        description: editDescription.trim(),
        amount: amountNum,
        interest_rate: rateNum,
        due_date: editDueDate || null,
      });
      setBills(bills.map((b) => (b.id === editId ? updated : b)));
      setEditId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating bill");
    }
  };

  const togglePaid = async (bill: BillRow) => {
    setError("");
    try {
      const updated = await updateBill(bill.id, { paid: !bill.paid });
      setBills(bills.map((b) => (b.id === bill.id ? updated : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating bill");
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    try {
      await deleteBill(id);
      setBills(bills.filter((b) => b.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting bill");
    }
  };

  if (loading) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-4 text-sm">
        <div className="bg-surface border border-border rounded-lg px-4 py-2">
          <span className="text-muted">Total: </span>
          <span className="font-semibold">{totalAmount.toFixed(2)}</span>
        </div>
        <div className="bg-surface border border-border rounded-lg px-4 py-2">
          <span className="text-muted">Unpaid: </span>
          <span className="font-semibold text-red-400">
            {totalUnpaid.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted uppercase bg-surface-hover">
            <tr>
              <th className="px-4 py-3 rounded-tl-lg">Name</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Rate (%)</th>
              <th className="px-4 py-3">Due date</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3 rounded-tr-lg text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {bills.map((bill) => {
              const isEditing = editId === bill.id;
              return (
                <tr key={bill.id} className="hover:bg-surface-hover/50">
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 w-full"
                      />
                    ) : (
                      <span className="font-medium">{bill.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 w-full"
                      />
                    ) : (
                      <span className="text-muted">
                        {bill.description || "-"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 w-24"
                      />
                    ) : (
                      bill.amount.toFixed(2)
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editRate}
                        onChange={(e) => setEditRate(e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 w-20"
                      />
                    ) : bill.interest_rate !== null ? (
                      `${bill.interest_rate}%`
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 w-36"
                      />
                    ) : (
                      bill.due_date || <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={bill.paid}
                      onChange={() => togglePaid(bill)}
                      className="accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={saveEdit}
                          className="p-1.5 rounded text-emerald-400 hover:bg-surface transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="p-1.5 rounded text-muted hover:bg-surface transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startEdit(bill)}
                          className="p-1.5 rounded text-muted hover:text-primary hover:bg-surface transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(bill.id)}
                          className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-surface transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* Add new row */}
            <tr className="bg-surface-hover/30">
              <td className="px-4 py-2">
                <input
                  type="text"
                  placeholder="e.g. Car loan"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-background border border-border rounded px-2 py-1 w-full text-sm"
                />
              </td>
              <td className="px-4 py-2">
                <input
                  type="text"
                  placeholder="Description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="bg-background border border-border rounded px-2 py-1 w-full text-sm"
                />
              </td>
              <td className="px-4 py-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="bg-background border border-border rounded px-2 py-1 w-24 text-sm"
                />
              </td>
              <td className="px-4 py-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Rate"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="bg-background border border-border rounded px-2 py-1 w-20 text-sm"
                />
              </td>
              <td className="px-4 py-2">
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="bg-background border border-border rounded px-2 py-1 w-36 text-sm"
                />
              </td>
              <td className="px-4 py-2"></td>
              <td className="px-4 py-2 text-right">
                <button
                  onClick={handleAdd}
                  disabled={adding}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {bills.length === 0 && (
        <p className="text-sm text-muted text-center py-4">
          No bills yet. Add one above.
        </p>
      )}
    </div>
  );
}
