import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import { todayIso } from "../../../lib/dates";
import { errorMessage } from "../../../lib/errors";
import {
  addDossierPayment,
  deleteDossierPayment,
  getDossierPayments,
  updateDossierPayment,
  type DossierPaymentFields,
} from "../api";
import type { DossierPaymentRow, DossierPaymentStatus } from "../types";

interface DossierPaymentsProps {
  sectionId: string;
  canManage: boolean;
}

const STATUS: Record<DossierPaymentStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-amber-400/15 text-amber-300" },
  paid: { label: "Pagado", className: "bg-emerald-400/15 text-emerald-300" },
  cancelled: { label: "Cancelado", className: "bg-surface-hover text-muted" },
};

const CURRENCIES = ["USD", "EUR", "USDT", "Bs"];

function formatMoney(amount: number, currency: string): string {
  const number = amount.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${number} ${currency}`.trim();
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es-VE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Soonest first; payments without a date go last
function byDate(a: DossierPaymentRow, b: DossierPaymentRow): number {
  if (a.date && b.date) return a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at);
  if (a.date) return -1;
  if (b.date) return 1;
  return a.created_at.localeCompare(b.created_at);
}

// Adds up per currency: dollars and bolívares can't go in one number
function totals(payments: DossierPaymentRow[], status: DossierPaymentStatus): string {
  const sums = new Map<string, number>();
  for (const p of payments) {
    if (p.status === status) sums.set(p.currency, (sums.get(p.currency) ?? 0) + p.amount);
  }
  if (sums.size === 0) return "—";
  return [...sums].map(([currency, sum]) => formatMoney(sum, currency)).join(" · ");
}

// A "Pagos" block: the list of payments the admin keeps up to date.
export default function DossierPayments({ sectionId, canManage }: DossierPaymentsProps) {
  const [payments, setPayments] = useState<DossierPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // null: closed. "new": adding. A row: editing that one.
  const [modal, setModal] = useState<DossierPaymentRow | "new" | null>(null);
  const [toDelete, setToDelete] = useState<DossierPaymentRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDossierPayments(sectionId)
      .then((rows) => {
        if (!cancelled) setPayments(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, "No se pudieron cargar los pagos"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sectionId]);

  const save = async (fields: DossierPaymentFields) => {
    if (modal === "new") {
      const row = await addDossierPayment(sectionId, fields);
      setPayments((prev) => [...prev, row]);
    } else if (modal) {
      await updateDossierPayment(modal.id, fields);
      const id = modal.id;
      setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...fields } : p)));
    }
    setModal(null);
  };

  const confirmDelete = async () => {
    const payment = toDelete;
    setToDelete(null);
    if (!payment) return;
    const prev = payments;
    setPayments((list) => list.filter((p) => p.id !== payment.id));
    try {
      await deleteDossierPayment(payment.id);
    } catch (err) {
      setPayments(prev);
      setError(errorMessage(err, "No se pudo eliminar el pago"));
    }
  };

  if (loading) return <p className="text-sm text-muted">Cargando...</p>;

  const today = todayIso();
  const sorted = [...payments].sort(byDate);

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {payments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="px-3.5 py-3 rounded-lg bg-background border border-border">
            <p className="text-xs text-muted">Pagado</p>
            <p className="text-sm font-semibold text-emerald-300 mt-1">{totals(payments, "paid")}</p>
          </div>
          <div className="px-3.5 py-3 rounded-lg bg-background border border-border">
            <p className="text-xs text-muted">Pendiente</p>
            <p className="text-sm font-semibold text-amber-300 mt-1">{totals(payments, "pending")}</p>
          </div>
        </div>
      )}

      {payments.length === 0 && <p className="text-sm text-muted">Todavía no hay pagos.</p>}

      {sorted.length > 0 && (
        <ul className="space-y-2">
          {sorted.map((payment) => {
            const overdue =
              payment.status === "pending" && payment.date !== null && payment.date < today;
            const status = STATUS[payment.status];
            return (
              <li
                key={payment.id}
                className="flex items-start gap-3 flex-wrap sm:flex-nowrap bg-background border border-border rounded-lg p-3"
              >
                <div className="flex-1 min-w-[160px]">
                  <p
                    className={`text-sm font-medium break-words ${
                      payment.status === "cancelled" ? "line-through text-muted" : ""
                    }`}
                  >
                    {payment.concept || "Sin concepto"}
                  </p>
                  {payment.date && (
                    <p className={`text-xs mt-0.5 ${overdue ? "text-red-400" : "text-muted"}`}>
                      {formatDate(payment.date)}
                    </p>
                  )}
                  {payment.note && (
                    <p className="text-xs text-muted mt-1 whitespace-pre-wrap break-words">
                      {payment.note}
                    </p>
                  )}
                </div>
                <p className="text-sm font-semibold whitespace-nowrap">
                  {formatMoney(payment.amount, payment.currency)}
                </p>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                    overdue ? "bg-red-500/15 text-red-400" : status.className
                  }`}
                >
                  {overdue ? "Vencido" : status.label}
                </span>
                {canManage && (
                  <div className="flex items-center shrink-0 ml-auto sm:ml-0">
                    <button
                      onClick={() => setModal(payment)}
                      className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setToDelete(payment)}
                      className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage && (
        <button
          onClick={() => setModal("new")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-border text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar pago
        </button>
      )}

      {modal && (
        <PaymentModal
          payment={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Eliminar pago"
          message={`¿Eliminar "${toDelete.concept || "este pago"}"?`}
          confirmLabel="Eliminar"
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

interface PaymentModalProps {
  payment: DossierPaymentRow | null;
  onClose: () => void;
  onSave: (fields: DossierPaymentFields) => Promise<void>;
}

const FIELD =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none";

function PaymentModal({ payment, onClose, onSave }: PaymentModalProps) {
  const [concept, setConcept] = useState(payment?.concept ?? "");
  const [amount, setAmount] = useState(payment ? String(payment.amount) : "");
  const [currency, setCurrency] = useState(payment?.currency ?? "USD");
  const [date, setDate] = useState(payment?.date ?? "");
  const [status, setStatus] = useState<DossierPaymentStatus>(payment?.status ?? "pending");
  const [note, setNote] = useState(payment?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const value = Number(amount.replace(",", "."));
    if (!concept.trim()) {
      setError("Escribe el concepto del pago.");
      return;
    }
    if (!amount.trim() || !Number.isFinite(value) || value < 0) {
      setError("Escribe un monto válido.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        concept: concept.trim(),
        amount: value,
        currency: currency.trim(),
        date: date || null,
        status,
        note: note.trim(),
      });
    } catch (err) {
      setError(errorMessage(err, "No se pudo guardar el pago"));
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-surface border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold">{payment ? "Editar pago" : "Nuevo pago"}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-muted hover:bg-surface-hover"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-red-400">{error}</p>}
          <label className="block space-y-1">
            <span className="text-xs text-muted">Concepto</span>
            <input
              autoFocus
              type="text"
              placeholder="Ej. Anticipo 50%"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className={FIELD}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs text-muted">Monto</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={FIELD}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted">Moneda</span>
              <input
                type="text"
                list="dossier-currencies"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={FIELD}
              />
              <datalist id="dossier-currencies">
                {CURRENCIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs text-muted">Fecha</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={FIELD}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted">Estado</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as DossierPaymentStatus)}
                className={FIELD}
              >
                {(Object.keys(STATUS) as DossierPaymentStatus[]).map((key) => (
                  <option key={key} value={key}>
                    {STATUS[key].label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-muted">Nota (opcional)</span>
            <textarea
              rows={3}
              placeholder="Referencia, método de pago..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${FIELD} resize-y`}
            />
          </label>
        </div>

        <footer className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-hover hover:bg-border text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
