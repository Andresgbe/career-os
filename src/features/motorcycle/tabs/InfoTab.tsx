import { useState } from "react";
import { Upload, FileText } from "lucide-react";
import { mockInfo } from "../mockData";
import type { MotorcycleInfo } from "../types";

export default function InfoTab() {
  const [info, setInfo] = useState<MotorcycleInfo>(mockInfo);

  const field = (label: string, key: keyof MotorcycleInfo, type = "text") => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted">{label}</label>
      <input
        type={type}
        value={(info[key] as string) ?? ""}
        onChange={(e) => setInfo({ ...info, [key]: e.target.value })}
        className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-4">Specifications</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {field("Make", "make")}
          {field("Model", "model")}
          {field("Year", "year", "number")}
          {field("License plate", "plate")}
          {field("VIN / Chassis", "vin")}
          {field("Color", "color")}
          {field("Purchase date", "purchaseDate", "date")}
        </div>
        <div className="flex flex-col gap-1 mt-4">
          <label className="text-xs text-muted">Notes</label>
          <textarea
            value={info.notes}
            onChange={(e) => setInfo({ ...info, notes: e.target.value })}
            rows={3}
            className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none resize-none"
          />
        </div>
      </section>

      {/* Attachments (manual, legal docs) */}
      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-4">Documents & Manual</h2>
        {info.attachments.length === 0 ? (
          <p className="text-sm text-muted mb-4">No files uploaded yet.</p>
        ) : (
          <ul className="space-y-2 mb-4">
            {info.attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 text-sm text-muted"
              >
                <FileText className="w-4 h-4" />
                {a.label} — {a.fileName}
              </li>
            ))}
          </ul>
        )}
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 rounded bg-surface-hover text-muted text-sm cursor-not-allowed"
          title="File upload will be enabled once Supabase Storage is connected"
        >
          <Upload className="w-4 h-4" />
          Upload file (available after Supabase setup)
        </button>
      </section>
    </div>
  );
}