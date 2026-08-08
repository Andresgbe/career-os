import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Repeat } from "lucide-react";
import type { MonthlyExpenseRow } from "../types";
import {
  getMonthlyExpenses,
  addMonthlyExpense,
  updateMonthlyExpense,
  deleteMonthlyExpense,
} from "../api";
import MonthPicker from "../../../components/MonthPicker";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  if (!year || !m) return month;
  return new Date(year, m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export default function MonthlyBudgetTab() {
  const [expenses, setExpenses] = useState<MonthlyExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Which month is being viewed — hides other months' one-time entries
  const [viewMonth, setViewMonth] = useState(currentMonth());

  // New expense
  const [newCategory, setNewCategory] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newMonth, setNewMonth] = useState(currentMonth());
  const [newRecurring, setNewRecurring] = useState(false);
  const [adding, setAdding] = useState(false);

  // Edit expense
  const [editId, setEditId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editMonth, setEditMonth] = useState("");
  const [editRecurring, setEditRecurring] = useState(false);

  useEffect(() => {
    getMonthlyExpenses()
      .then(setExpenses)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const recurringTotal = expenses
    .filter((e) => e.recurring)
    .reduce((acc, e) => acc + e.amount, 0);
  const viewMonthOneTimeTotal = expenses
    .filter((e) => !e.recurring && e.month === viewMonth)
    .reduce((acc, e) => acc + e.amount, 0);
  const viewMonthTotal = recurringTotal + viewMonthOneTimeTotal;

  const visibleExpenses = expenses.filter(
    (e) => e.recurring || e.month === viewMonth
  );

  const handleViewMonthChange = (m: string) => {
    setViewMonth(m);
    setNewMonth(m);
  };

  const handleAdd = async () => {
    if (!newAmount) {
      setError("Enter an amount.");
      return;
    }
    const amountNum = parseFloat(newAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      setError("Amount must be a positive number.");
      return;
    }

    setAdding(true);
    setError("");
    try {
      const row = await addMonthlyExpense({
        month: newMonth || viewMonth,
        category: newCategory.trim(),
        description: newDescription.trim(),
        amount: amountNum,
        recurring: newRecurring,
      });
      setExpenses([row, ...expenses]);
      setNewCategory("");
      setNewDescription("");
      setNewAmount("");
      setNewMonth(viewMonth);
      setNewRecurring(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error adding expense");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (expense: MonthlyExpenseRow) => {
    setEditId(expense.id);
    setEditCategory(expense.category);
    setEditDescription(expense.description);
    setEditAmount(expense.amount.toString());
    setEditMonth(expense.month);
    setEditRecurring(expense.recurring);
    setError("");
  };

  const saveEdit = async () => {
    if (!editId || !editAmount) return;

    const amountNum = parseFloat(editAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      setError("Amount must be a positive number.");
      return;
    }

    setError("");
    try {
      const updated = await updateMonthlyExpense(editId, {
        month: editMonth || currentMonth(),
        category: editCategory.trim(),
        description: editDescription.trim(),
        amount: amountNum,
        recurring: editRecurring,
      });
      setExpenses(expenses.map((e) => (e.id === editId ? updated : e)));
      setEditId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating expense");
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    try {
      await deleteMonthlyExpense(id);
      setExpenses(expenses.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting expense");
    }
  };

  if (loading) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Viewing:</span>
          <MonthPicker
            value={viewMonth}
            onChange={handleViewMonthChange}
            className="w-40"
          />
        </label>
        <div className="bg-surface border border-border rounded-lg px-4 py-2 text-sm">
          <span className="text-muted">Estimated total: </span>
          <span className="font-semibold">{viewMonthTotal.toFixed(2)}</span>
        </div>
        <div className="bg-surface border border-border rounded-lg px-4 py-2 text-sm">
          <span className="text-muted">Recurring monthly: </span>
          <span className="font-semibold">{recurringTotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted uppercase bg-surface-hover">
            <tr>
              <th className="px-4 py-3 rounded-tl-lg">Category</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Recurring</th>
              <th className="px-4 py-3">Month</th>
              <th className="px-4 py-3 rounded-tr-lg text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {/* Add new row */}
            <tr className="bg-surface-hover/30">
              <td className="px-4 py-2">
                <input
                  type="text"
                  placeholder="e.g. Groceries"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
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
              <td className="px-4 py-2 text-center">
                <input
                  type="checkbox"
                  checked={newRecurring}
                  onChange={(e) => setNewRecurring(e.target.checked)}
                  className="accent-primary"
                />
              </td>
              <td className="px-4 py-2">
                <MonthPicker
                  value={newMonth}
                  onChange={setNewMonth}
                  disabled={newRecurring}
                  className="w-36"
                />
              </td>
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

            {visibleExpenses.map((expense) => {
              const isEditing = editId === expense.id;
              return (
                <tr key={expense.id} className="hover:bg-surface-hover/50">
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 w-full"
                      />
                    ) : (
                      <span className="font-medium">
                        {expense.category || "-"}
                      </span>
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
                        {expense.description || "-"}
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
                      expense.amount.toFixed(2)
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={editRecurring}
                        onChange={(e) => setEditRecurring(e.target.checked)}
                        className="accent-primary"
                      />
                    ) : expense.recurring ? (
                      <Repeat className="w-4 h-4 text-primary inline-block" />
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <MonthPicker
                        value={editMonth}
                        onChange={setEditMonth}
                        disabled={editRecurring}
                        className="w-36"
                      />
                    ) : expense.recurring ? (
                      <span className="text-muted">Every month</span>
                    ) : (
                      formatMonth(expense.month)
                    )}
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
                          onClick={() => startEdit(expense)}
                          className="p-1.5 rounded text-muted hover:text-primary hover:bg-surface transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
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
          </tbody>
        </table>
      </div>

      {visibleExpenses.length === 0 && (
        <p className="text-sm text-muted text-center py-4">
          No expenses for {formatMonth(viewMonth)} yet. Add one above.
        </p>
      )}
    </div>
  );
}
