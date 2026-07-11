import { useEffect, useRef, useState } from "react";
import { Check, Plus, Camera, Trash2, Eye } from "lucide-react";
import {
  getOilChanges,
  seedOilChanges,
  toggleOilChange,
  addOilChange,
  deleteOilChange,
  uploadOilReceipt,
  getFileUrl,
  type OilChangeRow,
} from "../api";

export default function OilChangeTab() {
  const [items, setItems] = useState<OilChangeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKm, setNewKm] = useState("");
  const [error, setError] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Track which row's camera button was clicked
  const activeUploadId = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      let data = await getOilChanges();
      // First-time user: no milestones yet → seed the default 9
      if (data.length === 0) {
        await seedOilChanges();
        data = await getOilChanges();
      }
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (item: OilChangeRow) => {
    const newDone = !item.done;
    const newDate = newDone ? new Date().toISOString().slice(0, 10) : null;
    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, done: newDone, date: newDate } : i
      )
    );
    try {
      await toggleOilChange(item.id, newDone, newDate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error updating");
      load(); // revert on error
    }
  };

  const add = async () => {
    const km = parseInt(newKm);
    if (!km) return;
    try {
      await addOilChange(km);
      setNewKm("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error adding");
    }
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await deleteOilChange(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error deleting");
      load();
    }
  };

  const triggerUpload = (id: string) => {
    activeUploadId.current = id;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    const id = activeUploadId.current;
    if (!file || !id) return;

    setUploadingId(id);
    setError("");
    try {
      const path = await uploadOilReceipt(id, file);
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, receipt_url: path } : i))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingId(null);
      activeUploadId.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const viewReceipt = async (path: string) => {
    try {
      const url = await getFileUrl(path);
      window.open(url, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open receipt");
    }
  };

  if (loading) return <p className="text-muted">Loading...</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Hidden file input shared by all rows */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileSelected}
        className="hidden"
      />

      <div className="bg-surface border border-border rounded-xl divide-y divide-border">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-4">
            <button
              onClick={() => toggle(item)}
              className={`w-6 h-6 rounded flex items-center justify-center border transition-colors shrink-0 ${
                item.done
                  ? "bg-primary border-primary"
                  : "border-border hover:border-primary"
              }`}
            >
              {item.done && <Check className="w-4 h-4 text-white" />}
            </button>

            <span
              className={`font-medium ${
                item.done ? "text-muted line-through" : ""
              }`}
            >
              {item.km.toLocaleString()} km
            </span>

            {item.date && (
              <span className="text-xs text-muted">{item.date}</span>
            )}

            <div className="ml-auto flex items-center gap-2">
              {/* View receipt if one exists */}
              {item.receipt_url && (
                <button
                  onClick={() => viewReceipt(item.receipt_url!)}
                  className="p-1.5 rounded text-primary hover:bg-surface-hover"
                  title="View receipt"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}

              {/* Upload / replace receipt */}
              <button
                onClick={() => triggerUpload(item.id)}
                disabled={uploadingId === item.id}
                className={`p-1.5 rounded hover:bg-surface-hover disabled:opacity-50 ${
                  item.receipt_url ? "text-muted" : "text-muted"
                }`}
                title={item.receipt_url ? "Replace receipt" : "Add receipt"}
              >
                <Camera className="w-4 h-4" />
              </button>

              <button
                onClick={() => remove(item.id)}
                className="p-1.5 rounded text-muted hover:bg-surface-hover"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add new milestone */}
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Add km milestone"
          value={newKm}
          onChange={(e) => setNewKm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none w-48"
        />
        <button
          onClick={add}
          className="flex items-center gap-1 px-3 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>
    </div>
  );
}