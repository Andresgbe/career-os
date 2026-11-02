import { useEffect, useRef, useState } from "react";
import { Check, FileText, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import { errorMessage } from "../../../lib/errors";
import {
  addDossierPayment,
  deleteDossierFile,
  deleteDossierPayment,
  getDossierFileUrl,
  getDossierPayments,
  updateDossierPayment,
  uploadDossierFile,
  type DossierPaymentFields,
} from "../api";
import type { DossierFile, DossierPaymentRow, DossierSectionRow } from "../types";

interface DossierPaymentsProps {
  section: DossierSectionRow;
  canManage: boolean;
  onUpdate: (
    fields: Partial<Pick<DossierSectionRow, "total_amount" | "total_currency">>
  ) => Promise<boolean>;
}

const CURRENCIES = ["USD", "EUR", "USDT", "VEF"];
const OTHER = "__other__";

interface CurrencyFieldProps {
  value: string;
  onChange: (value: string) => void;
  className: string;
}

// The usual currencies, or "Otro" to type whatever applies.
function CurrencyField({ value, onChange, className }: CurrencyFieldProps) {
  const [custom, setCustom] = useState(!CURRENCIES.includes(value));
  return (
    <div className="space-y-2">
      <select
        aria-label="Moneda o tasa"
        value={custom ? OTHER : value}
        onChange={(e) => {
          const next = e.target.value;
          setCustom(next === OTHER);
          onChange(next === OTHER ? "" : next);
        }}
        className={className}
      >
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={OTHER}>Otro</option>
      </select>
      {custom && (
        <input
          autoFocus
          type="text"
          aria-label="Escribe la moneda o tasa"
          placeholder="Escribe la moneda o tasa"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      )}
    </div>
  );
}

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
function totals(payments: DossierPaymentRow[]): string {
  const sums = new Map<string, number>();
  for (const p of payments) sums.set(p.currency, (sums.get(p.currency) ?? 0) + p.amount);
  return [...sums].map(([currency, sum]) => formatMoney(sum, currency)).join(" · ");
}

function sameCurrency(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function removeFiles(files: DossierFile[]) {
  // The record is already gone; an orphaned file in Storage breaks nothing
  files.forEach((f) => deleteDossierFile(f.path).catch(() => {}));
}

// A "Pagos" block: the total agreed, the payments the admin keeps up to date
// with their receipts, and what's still pending.
export default function DossierPayments({ section, canManage, onUpdate }: DossierPaymentsProps) {
  const sectionId = section.id;
  const [payments, setPayments] = useState<DossierPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // null: closed. "new": adding. A row: editing that one.
  const [modal, setModal] = useState<DossierPaymentRow | "new" | null>(null);
  const [toDelete, setToDelete] = useState<DossierPaymentRow | null>(null);
  const [editingTotal, setEditingTotal] = useState(false);
  const [draftTotal, setDraftTotal] = useState("");
  const [draftCurrency, setDraftCurrency] = useState("USD");

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

  const startEditingTotal = () => {
    setDraftTotal(section.total_amount === null ? "" : String(section.total_amount));
    setDraftCurrency(section.total_currency);
    setError("");
    setEditingTotal(true);
  };

  // Left blank, the block goes back to having no total
  const saveTotal = async () => {
    const value = Number(draftTotal.replace(",", "."));
    if (draftTotal.trim() && (!Number.isFinite(value) || value < 0)) {
      setError("Escribe un monto válido.");
      return;
    }
    if (draftTotal.trim() && !draftCurrency.trim()) {
      setError("Escribe la moneda o tasa.");
      return;
    }
    setError("");
    setEditingTotal(false);
    await onUpdate({
      total_amount: draftTotal.trim() ? value : null,
      total_currency: draftCurrency.trim() || "USD",
    });
  };

  const save = async (fields: DossierPaymentFields) => {
    if (modal === "new") {
      const row = await addDossierPayment(sectionId, fields);
      setPayments((prev) => [...prev, row]);
    } else if (modal) {
      await updateDossierPayment(modal.id, fields);
      const { id, files: before } = modal;
      setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...fields } : p)));
      removeFiles(before.filter((f) => !fields.files.some((kept) => kept.id === f.id)));
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
      removeFiles(payment.files);
    } catch (err) {
      setPayments(prev);
      setError(errorMessage(err, "No se pudo eliminar el pago"));
    }
  };

  const download = async (file: DossierFile) => {
    setError("");
    try {
      // The URL answers as an attachment, so this downloads without leaving the page
      window.location.assign(await getDossierFileUrl(file));
    } catch (err) {
      setError(errorMessage(err, "No se pudo descargar el archivo"));
    }
  };

  if (loading) return <p className="text-sm text-muted">Cargando...</p>;

  const sorted = [...payments].sort(byDate);
  const total = section.total_amount;
  const currency = section.total_currency;
  // Only payments in the total's currency can be subtracted from it
  const inCurrency = payments.filter((p) => sameCurrency(p.currency, currency));
  const others = payments.filter((p) => !sameCurrency(p.currency, currency));
  const paid = inCurrency.reduce((sum, p) => sum + p.amount, 0);
  const pending = total === null ? 0 : Math.round((total - paid) * 100) / 100;

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {editingTotal ? (
        <div className="flex items-start gap-2 flex-wrap px-3.5 py-3 rounded-lg bg-background border border-primary">
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            placeholder="Monto total"
            value={draftTotal}
            onChange={(e) => setDraftTotal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTotal();
              if (e.key === "Escape") setEditingTotal(false);
            }}
            className="flex-1 min-w-[120px] bg-surface border border-border rounded-lg px-3 py-1.5 text-sm focus:border-primary outline-none"
          />
          <CurrencyField
            value={draftCurrency}
            onChange={setDraftCurrency}
            className="w-full min-w-[120px] bg-surface border border-border rounded-lg px-3 py-1.5 text-sm focus:border-primary outline-none"
          />
          <button
            onClick={saveTotal}
            className="p-1.5 rounded text-emerald-400 hover:bg-surface-hover"
            aria-label="Guardar monto total"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => setEditingTotal(false)}
            className="p-1.5 rounded text-muted hover:bg-surface-hover"
            aria-label="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : total !== null ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="px-3.5 py-3 rounded-lg bg-background border border-border">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted">Monto total</p>
              {canManage && (
                <button
                  onClick={startEditingTotal}
                  className="p-0.5 rounded text-muted hover:text-primary"
                  title="Cambiar monto total"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-sm font-semibold mt-1">{formatMoney(total, currency)}</p>
          </div>
          <div className="px-3.5 py-3 rounded-lg bg-background border border-border">
            <p className="text-xs text-muted">Pagado</p>
            <p className="text-sm font-semibold text-emerald-300 mt-1">
              {formatMoney(paid, currency)}
            </p>
          </div>
          <div className="px-3.5 py-3 rounded-lg bg-background border border-border">
            <p className="text-xs text-muted">{pending < 0 ? "Pagado de más" : "Pendiente"}</p>
            <p
              className={`text-sm font-semibold mt-1 ${
                pending > 0 ? "text-amber-300" : "text-emerald-300"
              }`}
            >
              {formatMoney(Math.abs(pending), currency)}
            </p>
          </div>
        </div>
      ) : (
        <>
          {payments.length > 0 && (
            <div className="px-3.5 py-3 rounded-lg bg-background border border-border">
              <p className="text-xs text-muted">Pagado</p>
              <p className="text-sm font-semibold text-emerald-300 mt-1">{totals(payments)}</p>
            </div>
          )}
          {canManage && (
            <button
              onClick={startEditingTotal}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-dashed border-border text-sm text-muted hover:text-foreground hover:border-primary/60 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Poner monto total
            </button>
          )}
        </>
      )}

      {total !== null && others.length > 0 && (
        <p className="text-xs text-muted">
          No restados del pendiente por estar en otra moneda: {totals(others)}
        </p>
      )}

      {payments.length === 0 && <p className="text-sm text-muted">Todavía no hay pagos.</p>}

      {sorted.length > 0 && (
        <ul className="space-y-2">
          {sorted.map((payment) => (
            <li key={payment.id} className="bg-background border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
                <div className="flex-1 min-w-[160px]">
                  <p className="text-sm font-medium break-words">
                    {payment.concept || "Sin concepto"}
                  </p>
                  {payment.date && (
                    <p className="text-xs text-muted mt-0.5">{formatDate(payment.date)}</p>
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
              </div>
              {payment.files.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {payment.files.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => download(file)}
                      className="flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-full bg-surface-hover hover:bg-border text-xs transition-colors"
                      title={`Descargar ${file.name}`}
                    >
                      <FileText className="w-3.5 h-3.5 text-primary-hover shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
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
          projectId={section.project_id}
          sectionId={sectionId}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Eliminar pago"
          message={`¿Eliminar "${toDelete.concept || "este pago"}" y sus comprobantes?`}
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
  projectId: string;
  sectionId: string;
  onClose: () => void;
  onSave: (fields: DossierPaymentFields) => Promise<void>;
}

const FIELD =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none";

function PaymentModal({ payment, projectId, sectionId, onClose, onSave }: PaymentModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [concept, setConcept] = useState(payment?.concept ?? "");
  const [amount, setAmount] = useState(payment ? String(payment.amount) : "");
  const [currency, setCurrency] = useState(payment?.currency ?? "USD");
  const [date, setDate] = useState(payment?.date ?? "");
  const [note, setNote] = useState(payment?.note ?? "");
  // Already stored, and picked but not uploaded yet (they go up on save)
  const [stored, setStored] = useState<DossierFile[]>(payment?.files ?? []);
  const [picked, setPicked] = useState<File[]>([]);
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
    if (!currency.trim()) {
      setError("Escribe la moneda o tasa.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const uploaded: DossierFile[] = [];
      for (const file of picked) {
        uploaded.push(await uploadDossierFile(projectId, sectionId, file));
      }
      const files = [...stored, ...uploaded];
      // So retrying after an error doesn't upload them a second time
      setStored(files);
      setPicked([]);
      await onSave({
        concept: concept.trim(),
        amount: value,
        currency: currency.trim(),
        date: date || null,
        note: note.trim(),
        files,
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
            <div className="space-y-1">
              <span className="text-xs text-muted">Moneda o tasa</span>
              <CurrencyField value={currency} onChange={setCurrency} className={FIELD} />
            </div>
          </div>
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
            <span className="text-xs text-muted">Nota (opcional)</span>
            <textarea
              rows={3}
              placeholder="Referencia, método de pago..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${FIELD} resize-y`}
            />
          </label>

          <div className="space-y-2">
            <span className="text-xs text-muted">Archivos o comprobantes</span>
            {(stored.length > 0 || picked.length > 0) && (
              <ul className="space-y-1.5">
                {stored.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border text-sm"
                  >
                    <FileText className="w-4 h-4 text-primary-hover shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{file.name}</span>
                    <button
                      onClick={() => setStored((list) => list.filter((f) => f.id !== file.id))}
                      className="p-0.5 rounded text-muted hover:text-red-400 shrink-0"
                      aria-label={`Quitar ${file.name}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
                {picked.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border text-sm"
                  >
                    <FileText className="w-4 h-4 text-muted shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{file.name}</span>
                    <button
                      onClick={() => setPicked((list) => list.filter((_, i) => i !== index))}
                      className="p-0.5 rounded text-muted hover:text-red-400 shrink-0"
                      aria-label={`Quitar ${file.name}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-dashed border-border text-sm text-muted hover:text-foreground hover:border-primary/60 transition-colors"
            >
              <Paperclip className="w-4 h-4" />
              Adjuntar archivo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const chosen = Array.from(e.target.files ?? []);
                setPicked((list) => [...list, ...chosen]);
                e.target.value = "";
              }}
            />
          </div>
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
