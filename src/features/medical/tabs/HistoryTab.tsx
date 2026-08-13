import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Paperclip,
  FileText,
  Trash2,
  Eye,
  Download,
  CalendarDays,
  MapPin,
  UserRound,
  Stethoscope,
  FlaskConical,
  Tag,
  ImagePlus,
  X,
  Pencil,
  Save,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  getHistory,
  addHistoryEntry,
  updateHistoryEntry,
  uploadHistoryFile,
  deleteHistoryFile,
  deleteHistoryEntry,
  getFileUrl,
} from "../api";
import {
  HISTORY_ENTRY_TYPES,
  type HistoryRow,
  type HistoryFileRow,
  type HistoryEntryType,
} from "../types";
import ConfirmDialog from "../../../components/ConfirmDialog";

const SPANISH_MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

// Turns "2026-12-03" into "3 de diciembre del 2026" (parsed manually so it
// isn't shifted a day by timezone conversion like `new Date(str)` would be)
const formatDateLong = (dateStr: string) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return "";
  return `${day} de ${SPANISH_MONTHS[month - 1]} del ${year}`;
};

// Today's date in yyyy-mm-dd (local time) for the date input default
const today = () => {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

const emptyForm = {
  entry_date: today(),
  entry_type: "consultation" as HistoryEntryType,
  place: "",
  professional: "",
  notes: "",
};

// Small visual identity per entry type: icon + label used on each card
const TYPE_META: Record<
  HistoryEntryType,
  { label: string; icon: typeof Stethoscope }
> = {
  consultation: { label: "Medical consultation", icon: Stethoscope },
  lab_exam: { label: "Lab exam", icon: FlaskConical },
  other: { label: "Other", icon: Tag },
};

export default function HistoryTab() {
  const [entries, setEntries] = useState<HistoryRow[]>([]);
  const [files, setFiles] = useState<HistoryFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [adding, setAdding] = useState(false);
  const [showNewEntryForm, setShowNewEntryForm] = useState(false);
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(
    new Set()
  );
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<HistoryRow | null>(null);

  // In-app image preview (skips the download step for image attachments)
  const [previewFile, setPreviewFile] = useState<HistoryFileRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState(false);

  // Inline editing of an existing entry
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [savingEdit, setSavingEdit] = useState(false);

  // Multi-file picker used by the "New Entry" form (images, PDFs, any format)
  const newEntryFileInputRef = useRef<HTMLInputElement>(null);

  // Single hidden file input shared across existing entries (same trick as oil receipts)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingEntryId = useRef<string | null>(null);

  useEffect(() => {
    getHistory()
      .then(({ entries, files }) => {
        setEntries(entries);
        setFiles(files);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleNewEntryFilesSelected = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    setPendingFiles((prev) => [...prev, ...selected]);
    e.target.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAdd = async () => {
    if (!form.place.trim() && !form.notes.trim()) {
      setError("Add at least a place or a note.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const row = await addHistoryEntry({
        entry_date: form.entry_date,
        entry_type: form.entry_type,
        place: form.place.trim(),
        professional: form.professional.trim(),
        notes: form.notes.trim(),
      });
      // Newest first: prepend
      setEntries((prev) => [row, ...prev]);

      // Upload any images/files attached before saving
      if (pendingFiles.length > 0) {
        const uploaded = await Promise.all(
          pendingFiles.map((file) => uploadHistoryFile(row.id, file))
        );
        setFiles((prev) => [...prev, ...uploaded]);
      }

      setForm(emptyForm);
      setPendingFiles([]);
      setShowNewEntryForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving entry");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (entry: HistoryRow) => {
    setEditingId(entry.id);
    setEditForm({
      entry_date: entry.entry_date,
      entry_type: entry.entry_type,
      place: entry.place,
      professional: entry.professional,
      notes: entry.notes,
    });
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editForm.place.trim() && !editForm.notes.trim()) {
      setError("Add at least a place or a note.");
      return;
    }
    setSavingEdit(true);
    setError("");
    try {
      const updated = await updateHistoryEntry(editingId, {
        entry_date: editForm.entry_date,
        entry_type: editForm.entry_type,
        place: editForm.place.trim(),
        professional: editForm.professional.trim(),
        notes: editForm.notes.trim(),
      });
      setEntries((prev) =>
        prev.map((x) => (x.id === editingId ? updated : x))
      );
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving entry");
    } finally {
      setSavingEdit(false);
    }
  };

  const pickFileFor = (entryId: string) => {
    pendingEntryId.current = entryId;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selected = Array.from(e.target.files ?? []);
    const entryId = pendingEntryId.current;
    if (selected.length === 0 || !entryId) return;
    setUploadingFor(entryId);
    setError("");
    try {
      const uploaded = await Promise.all(
        selected.map((file) => uploadHistoryFile(entryId, file))
      );
      setFiles((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingFor(null);
      pendingEntryId.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openFile = async (path: string) => {
    try {
      const url = await getFileUrl(path);
      window.open(url, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open file");
    }
  };

  const isImageFile = (name: string) => /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(name);

  const previewImage = async (f: HistoryFileRow) => {
    try {
      const url = await getFileUrl(f.file_path);
      setPreviewError(false);
      setPreviewUrl(url);
      setPreviewFile(f);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open file");
    }
  };

  const downloadFile = async (path: string, name: string) => {
    try {
      const url = await getFileUrl(path);
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download file");
    }
  };

  const handleDeleteFile = async (id: string, path: string) => {
    try {
      await deleteHistoryFile(id, path);
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const confirmDeleteEntry = async () => {
    if (!toDelete) return;
    const entryFiles = files.filter((f) => f.history_id === toDelete.id);
    try {
      await deleteHistoryEntry(
        toDelete.id,
        entryFiles.map((f) => f.file_path)
      );
      setEntries((prev) => prev.filter((x) => x.id !== toDelete.id));
      setFiles((prev) => prev.filter((f) => f.history_id !== toDelete.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setToDelete(null);
    }
  };

  const toggleYear = (year: number) => {
    setCollapsedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const toggleMonth = (key: string) => {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Group entries by year, then by month within each year (newest first)
  const groupedEntries = useMemo(() => {
    const byYear = new Map<number, Map<number, HistoryRow[]>>();
    for (const entry of entries) {
      const [yearStr, monthStr] = entry.entry_date.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr);
      if (!byYear.has(year)) byYear.set(year, new Map());
      const byMonth = byYear.get(year)!;
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month)!.push(entry);
    }
    return Array.from(byYear.entries())
      .sort(([a], [b]) => b - a)
      .map(([year, byMonth]) => ({
        year,
        months: Array.from(byMonth.entries())
          .sort(([a], [b]) => b - a)
          .map(([month, monthEntries]) => ({
            month,
            label: SPANISH_MONTHS[month - 1],
            entries: monthEntries,
          })),
      }));
  }, [entries]);

  return (
    <div className="space-y-6">
      {/* Add new entry */}
      <section className="bg-surface border border-border rounded-xl p-5">
        <button
          onClick={() => setShowNewEntryForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
        >
          {showNewEntryForm ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          New Entry
        </button>

        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}

        {showNewEntryForm && (
          <>
        <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-4 mb-4 mt-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Date</label>
            <input
              type="date"
              value={form.entry_date}
              onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Type</label>
            <select
              value={form.entry_type}
              onChange={(e) =>
                setForm({
                  ...form,
                  entry_type: e.target.value as HistoryEntryType,
                })
              }
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
            >
              {HISTORY_ENTRY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Place / Clinic</label>
            <input
              type="text"
              placeholder="e.g. Clinica Santa Maria"
              value={form.place}
              onChange={(e) => setForm({ ...form, place: e.target.value })}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">
              Professional (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Dr. Perez"
              value={form.professional}
              onChange={(e) =>
                setForm({ ...form, professional: e.target.value })
              }
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1 mb-4">
          <label className="text-xs text-muted">Notes (optional)</label>
          <textarea
            rows={2}
            placeholder="What happened? Diagnosis, prescriptions, next steps..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none resize-none"
          />
        </div>

        {/* Files/images to attach, added before the entry is saved */}
        <div className="flex flex-col gap-2 mb-4">
          <label className="text-xs text-muted">
            Attachments (optional)
          </label>
          {pendingFiles.length > 0 && (
            <ul className="space-y-1.5">
              {pendingFiles.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 bg-background border border-border rounded px-3 py-2"
                >
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <span className="flex-1 min-w-0 text-xs break-all">
                    {file.name}
                  </span>
                  <button
                    onClick={() => removePendingFile(index)}
                    className="p-1 rounded text-muted hover:bg-surface-hover hover:text-red-400 shrink-0"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={newEntryFileInputRef}
            type="file"
            multiple
            onChange={handleNewEntryFilesSelected}
            className="hidden"
          />
          <button
            onClick={() => newEntryFileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded bg-surface-hover hover:bg-border text-foreground text-sm font-medium transition-colors w-fit"
          >
            <ImagePlus className="w-4 h-4" />
            Add images / files
          </button>
        </div>

        <button
          onClick={handleAdd}
          disabled={adding}
          className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {adding ? "Adding..." : "Add entry"}
        </button>
          </>
        )}
      </section>

      {/* Timeline */}
      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-4">History</h2>

        {loading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted">No entries yet.</p>
        ) : (
          <div className="space-y-6">
            {groupedEntries.map((yearGroup) => {
              const yearCollapsed = collapsedYears.has(yearGroup.year);
              return (
              <div key={yearGroup.year}>
                <button
                  onClick={() => toggleYear(yearGroup.year)}
                  className="flex items-center gap-2 mb-3"
                >
                  {yearCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-muted" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted" />
                  )}
                  <h3 className="text-base font-bold text-foreground">
                    {yearGroup.year}
                  </h3>
                </button>
                {!yearCollapsed && (
                <div className="space-y-4">
                  {yearGroup.months.map((monthGroup) => {
                    const monthKey = `${yearGroup.year}-${monthGroup.month}`;
                    const monthCollapsed = collapsedMonths.has(monthKey);
                    return (
                    <div key={monthGroup.month}>
                      <button
                        onClick={() => toggleMonth(monthKey)}
                        className="flex items-center gap-1.5 mb-2"
                      >
                        {monthCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 text-muted" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-muted" />
                        )}
                        <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                          {monthGroup.label}
                        </p>
                      </button>
                      {!monthCollapsed && (
                      <ul className="space-y-3">
                        {monthGroup.entries.map((entry) => {
              const entryFiles = files.filter(
                (f) => f.history_id === entry.id
              );
              const meta = TYPE_META[entry.entry_type] ?? TYPE_META.other;
              const TypeIcon = meta.icon;
              return (
                <li
                  key={entry.id}
                  className="bg-background border border-border rounded-lg p-4 space-y-3"
                >
                  {editingId === entry.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted">Date</label>
                          <input
                            type="date"
                            value={editForm.entry_date}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                entry_date: e.target.value,
                              })
                            }
                            className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted">Type</label>
                          <select
                            value={editForm.entry_type}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                entry_type: e.target.value as HistoryEntryType,
                              })
                            }
                            className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                          >
                            {HISTORY_ENTRY_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted">
                            Place / Clinic
                          </label>
                          <input
                            type="text"
                            value={editForm.place}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                place: e.target.value,
                              })
                            }
                            className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted">
                            Professional (optional)
                          </label>
                          <input
                            type="text"
                            value={editForm.professional}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                professional: e.target.value,
                              })
                            }
                            className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted">
                          Notes (optional)
                        </label>
                        <textarea
                          rows={2}
                          value={editForm.notes}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              notes: e.target.value,
                            })
                          }
                          className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none resize-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted">
                          Attachments
                        </label>
                        <button
                          onClick={() => pickFileFor(entry.id)}
                          disabled={uploadingFor === entry.id}
                          className="flex items-center gap-2 px-3 py-2 rounded bg-surface-hover hover:bg-border text-foreground text-sm font-medium transition-colors w-fit disabled:opacity-50"
                        >
                          <Paperclip className="w-4 h-4" />
                          {uploadingFor === entry.id
                            ? "Uploading..."
                            : "Add images / files"}
                        </button>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={cancelEdit}
                          className="px-4 py-2 rounded bg-surface-hover hover:bg-border text-foreground text-sm font-medium transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={savingEdit}
                          className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          {savingEdit ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <CalendarDays className="w-5 h-5 text-primary shrink-0" />
                          <span className="text-lg font-semibold text-foreground">
                            {entry.entry_date}
                          </span>
                          <span className="text-sm text-muted">
                            ({formatDateLong(entry.entry_date)})
                          </span>
                          <span className="flex items-center gap-1 text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full shrink-0">
                            <TypeIcon className="w-3 h-3" />
                            {meta.label}
                          </span>
                          {entry.place && (
                            <>
                              <MapPin className="w-4 h-4 text-muted shrink-0 ml-1" />
                              <span className="text-muted break-all">
                                {entry.place}
                              </span>
                            </>
                          )}
                          {entry.professional && (
                            <>
                              <UserRound className="w-4 h-4 text-muted shrink-0 ml-1" />
                              <span className="text-muted break-all">
                                {entry.professional}
                              </span>
                            </>
                          )}
                        </div>
                        {entry.notes && (
                          <p className="text-sm text-muted mt-2 whitespace-pre-wrap">
                            {entry.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(entry)}
                          className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary"
                          title="Edit entry"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => pickFileFor(entry.id)}
                          disabled={uploadingFor === entry.id}
                          className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary disabled:opacity-50"
                          title="Attach file"
                        >
                          <Paperclip className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setToDelete(entry)}
                          className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400"
                          title="Delete entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {uploadingFor === entry.id && (
                    <p className="text-xs text-muted">Uploading...</p>
                  )}

                  {entryFiles.length > 0 && (
                    <ul className="space-y-1.5 pt-1 border-t border-border">
                      {entryFiles.map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center gap-2 pt-1.5"
                        >
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <button
                            onClick={() =>
                              isImageFile(f.file_name)
                                ? previewImage(f)
                                : openFile(f.file_path)
                            }
                            className="flex-1 min-w-0 text-xs text-left hover:text-primary transition-colors break-all"
                          >
                            {f.file_name}
                          </button>
                          <button
                            onClick={() =>
                              isImageFile(f.file_name)
                                ? previewImage(f)
                                : openFile(f.file_path)
                            }
                            className="p-1 rounded text-muted hover:bg-surface-hover hover:text-primary shrink-0"
                            title="Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => downloadFile(f.file_path, f.file_name)}
                            className="p-1 rounded text-muted hover:bg-surface-hover shrink-0"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteFile(f.id, f.file_path)}
                            className="p-1 rounded text-muted hover:bg-surface-hover hover:text-red-400 shrink-0"
                            title="Delete file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
                        })}
                      </ul>
                      )}
                    </div>
                    );
                  })}
                </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </section>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelected}
        className="hidden"
      />

      {toDelete && (
        <ConfirmDialog
          title="Delete entry?"
          message={`The entry from ${toDelete.entry_date} and its attached files will be permanently deleted.`}
          onConfirm={confirmDeleteEntry}
          onCancel={() => setToDelete(null)}
        />
      )}

      {previewFile && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="relative max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewFile(null)}
              className="absolute -top-10 right-0 p-1.5 text-white/80 hover:text-white"
              title="Close"
            >
              <X className="w-6 h-6" />
            </button>
            {previewError ? (
              <div className="bg-surface border border-border rounded-xl p-8 flex flex-col items-center gap-3 text-center">
                <FileText className="w-10 h-10 text-muted" />
                <p className="text-sm text-muted">
                  Can't preview "{previewFile.file_name}" in the browser
                  (unsupported format).
                </p>
                <button
                  onClick={() =>
                    downloadFile(previewFile.file_path, previewFile.file_name)
                  }
                  className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            ) : (
              <img
                src={previewUrl}
                alt={previewFile.file_name}
                onError={() => setPreviewError(true)}
                className="max-w-full max-h-[85vh] mx-auto rounded-lg object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}