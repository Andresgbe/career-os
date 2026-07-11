import { useEffect, useState } from "react";
import { Upload, Save, Check, Pencil } from "lucide-react";
import { getMotorcycleInfo, saveMotorcycleInfo } from "../api";
import type { MotorcycleInfo } from "../types";
import AttachmentsSection from "../components/AttachmentsSection";

const emptyInfo: MotorcycleInfo = {
  id: "",
  make: "",
  model: "",
  year: null,
  plate: "",
  vin: "",
  engineSerial: "",       // ← nuevo
  invoiceNumber: "",      // ← nuevo
  color: "",
  purchaseDate: null,
  notes: "",
  attachments: [],
};

export default function InfoTab() {
  const [info, setInfo] = useState<MotorcycleInfo>(emptyInfo);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Load existing data on mount
  useEffect(() => {
    getMotorcycleInfo()
      .then((row) => {
        if (row) {
          setRecordId(row.id);
            setInfo({
                id: row.id,
                make: row.make,
                model: row.model,
                year: row.year,
                plate: row.plate,
                vin: row.vin,
                engineSerial: row.engine_serial,     // ← nuevo
                invoiceNumber: row.invoice_number,   // ← nuevo
                color: row.color,
                purchaseDate: row.purchase_date,
                notes: row.notes,
                attachments: [],
          });
        } else {
          // No record yet → start in edit mode so the user can fill it in
          setIsEditing(true);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const id = await saveMotorcycleInfo(
        {
          make: info.make,
          model: info.model,
          year: info.year,
          plate: info.plate,
          vin: info.vin,
          engineSerial: info.engineSerial,       // ← nuevo
          invoiceNumber: info.invoiceNumber,     // ← nuevo
          color: info.color,
          purchaseDate: info.purchaseDate,
          notes: info.notes,
        },
        recordId
      );
      setRecordId(id);
      setSaved(true);
      setIsEditing(false); // lock fields again
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error saving");
    } finally {
      setSaving(false);
    }
  };

  const field = (
    label: string,
    key: keyof MotorcycleInfo,
    type = "text"
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted">{label}</label>
      <input
        type={type}
        disabled={!isEditing}
        value={(info[key] as string) ?? ""}
        onChange={(e) =>
          setInfo({
            ...info,
            [key]:
              type === "number" ? Number(e.target.value) || null : e.target.value,
          })
        }
        className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none disabled:opacity-60 disabled:cursor-not-allowed"
      />
    </div>
  );

  if (loading) {
    return <p className="text-muted">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <section className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Specifications</h2>

          {isEditing ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save"}
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 rounded bg-surface-hover hover:bg-border text-foreground text-sm font-medium transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {field("Make", "make")}
          {field("Model", "model")}
          {field("Year", "year", "number")}
          {field("License plate", "plate")}
          {field("VIN / Chassis", "vin")}
          {field("Engine serial", "engineSerial")}      {/* ← nuevo */}
          {field("Invoice number", "invoiceNumber")}    {/* ← nuevo */}
          {field("Color", "color")}
          {field("Purchase date", "purchaseDate", "date")}
        </div>
        <div className="flex flex-col gap-1 mt-4">
          <label className="text-xs text-muted">Notes</label>
          <textarea
            disabled={!isEditing}
            value={info.notes}
            onChange={(e) => setInfo({ ...info, notes: e.target.value })}
            rows={3}
            className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none resize-none disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>
      </section>
      <AttachmentsSection />
    </div>
  );
}