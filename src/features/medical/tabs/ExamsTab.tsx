import { useEffect, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Eye,
  Download,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  getExams,
  uploadExam,
  updateExam,
  swapExamOrder,
  deleteExam,
  getFileUrl,
} from "../api";
import type { ExamRow } from "../types";
import ConfirmDialog from "../components/ConfirmDialog";

const NAME_LIMIT = 30; // characters before "show more"

export default function ExamsTab() {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [toDelete, setToDelete] = useState<ExamRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getExams()
      .then(setExams)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const nextOrder =
        exams.length > 0
          ? Math.max(...exams.map((x) => x.sort_order)) + 1
          : 1;
      const row = await uploadExam(file, nextOrder);
      setExams((prev) => [...prev, row]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Optimistic local update (description typed / date picked)
  const changeField = (id: string, fields: Partial<ExamRow>) => {
    setExams((prev) =>
      prev.map((x) => (x.id === id ? { ...x, ...fields } : x))
    );
  };

  // Persist a field to the DB
  const persistField = async (
    id: string,
    fields: { description?: string; exam_date?: string | null }
  ) => {
    try {
      await updateExam(id, fields);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving");
    }
  };

  // Move a row up (-1) or down (+1) by swapping sort_order with its neighbor
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= exams.length) return;

    const a = exams[index];
    const b = exams[target];

    // Optimistic UI: swap positions (and their orders) locally first
    const next = [...exams];
    next[index] = { ...b, sort_order: a.sort_order };
    next[target] = { ...a, sort_order: b.sort_order };
    setExams(next);

    try {
      await swapExamOrder(a, b);
    } catch (err) {
      setExams(exams); // revert on failure
      setError(err instanceof Error ? err.message : "Error reordering");
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

  const downloadFile = async (path: string, name: string) => {
    try {
      const url = await getFileUrl(path);
      // Fetch the file and force a download
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

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteExam(toDelete.id, toDelete.file_path);
      setExams((prev) => prev.filter((x) => x.id !== toDelete.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setToDelete(null);
    }
  };

  const displayName = (name: string, id: string) => {
    const isLong = name.length > NAME_LIMIT;
    if (!isLong || expanded[id]) return name;
    return name.slice(0, NAME_LIMIT) + "...";
  };

  return (
    <section className="bg-surface border border-border rounded-xl p-5">
      <h2 className="font-semibold mb-4">Medical Exams</h2>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted mb-4">Loading...</p>
      ) : exams.length === 0 ? (
        <p className="text-sm text-muted mb-4">No exams uploaded yet.</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {exams.map((exam, index) => {
            const isLong = exam.file_name.length > NAME_LIMIT;
            return (
              <li
                key={exam.id}
                className="bg-background border border-border rounded-lg p-3 space-y-3"
              >
                {/* Top row: reorder + file name + actions */}
                <div className="flex items-center gap-3">
                  <div className="flex flex-col shrink-0">
                    <button
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className="p-0.5 rounded text-muted hover:bg-surface-hover hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => move(index, 1)}
                      disabled={index === exams.length - 1}
                      className="p-0.5 rounded text-muted hover:bg-surface-hover hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  <FileText className="w-5 h-5 text-primary shrink-0" />

                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => openFile(exam.file_path)}
                      className="text-sm text-left hover:text-primary transition-colors break-all"
                    >
                      {displayName(exam.file_name, exam.id)}
                    </button>
                    {isLong && (
                      <button
                        onClick={() =>
                          setExpanded({
                            ...expanded,
                            [exam.id]: !expanded[exam.id],
                          })
                        }
                        className="ml-2 text-xs text-primary hover:underline"
                      >
                        {expanded[exam.id] ? "Show less" : "Show more"}
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => openFile(exam.file_path)}
                    className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary shrink-0"
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => downloadFile(exam.file_path, exam.file_name)}
                    className="p-1.5 rounded text-muted hover:bg-surface-hover shrink-0"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setToDelete(exam)}
                    className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400 shrink-0"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Bottom row: description + exam date */}
                <div className="flex flex-col sm:flex-row gap-3 pl-9">
                  <input
                    type="text"
                    placeholder="Description (e.g. Blood test - annual checkup)"
                    value={exam.description}
                    onChange={(e) =>
                      changeField(exam.id, { description: e.target.value })
                    }
                    onBlur={() =>
                      persistField(exam.id, { description: exam.description })
                    }
                    className="flex-1 bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                  />
                  <input
                    type="date"
                    value={exam.exam_date ?? ""}
                    onChange={(e) => {
                      const value = e.target.value || null;
                      changeField(exam.id, { exam_date: value });
                      persistField(exam.id, { exam_date: value });
                    }}
                    className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none sm:w-44"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelected}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        <Upload className="w-4 h-4" />
        {uploading ? "Uploading..." : "Upload exam"}
      </button>

      {toDelete && (
        <ConfirmDialog
          title="Delete exam?"
          message={`"${toDelete.file_name}" will be permanently deleted.`}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </section>
  );
}