import { useEffect, useRef, useState } from "react";
import { Upload, FileText, Trash2, Eye, Download } from "lucide-react";
import {
  getAttachments,
  uploadAttachment,
  getFileUrl,
  deleteAttachment,
  type AttachmentRow,
} from "../api";

const NAME_LIMIT = 30; // characters before "show more"

export default function AttachmentsSection() {
  const [files, setFiles] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    getAttachments()
      .then(setFiles)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      await uploadAttachment(file, file.name);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
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

  const handleDelete = async (id: string, path: string) => {
    try {
      await deleteAttachment(id, path);
      setFiles(files.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const displayName = (name: string, id: string) => {
    const isLong = name.length > NAME_LIMIT;
    if (!isLong || expanded[id]) return name;
    return name.slice(0, NAME_LIMIT) + "...";
  };

  return (
    <section className="bg-surface border border-border rounded-xl p-5">
      <h2 className="font-semibold mb-4">Documents & Manual</h2>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted mb-4">Loading...</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted mb-4">No files uploaded yet.</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {files.map((f) => {
            const isLong = f.file_name.length > NAME_LIMIT;
            return (
              <li
                key={f.id}
                className="flex items-center gap-3 bg-background border border-border rounded-lg p-3"
              >
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => openFile(f.file_path)}
                    className="text-sm text-left hover:text-primary transition-colors break-all"
                  >
                    {displayName(f.file_name, f.id)}
                  </button>
                  {isLong && (
                    <button
                      onClick={() =>
                        setExpanded({ ...expanded, [f.id]: !expanded[f.id] })
                      }
                      className="ml-2 text-xs text-primary hover:underline"
                    >
                      {expanded[f.id] ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => openFile(f.file_path)}
                  className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary shrink-0"
                  title="Preview"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => downloadFile(f.file_path, f.file_name)}
                  className="p-1.5 rounded text-muted hover:bg-surface-hover shrink-0"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(f.id, f.file_path)}
                  className="p-1.5 rounded text-muted hover:bg-surface-hover shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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
        {uploading ? "Uploading..." : "Upload file"}
      </button>
    </section>
  );
}