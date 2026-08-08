import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Save, Upload, Image as ImageIcon } from "lucide-react";
import {
  getProjectDesignEntries,
  saveProjectDesignEntry,
  deleteProjectDesignEntry,
  updateProjectDesignImages,
  uploadProjectImage,
  getProjectFileUrl,
} from "../api";
import type { ProjectDesignEntryRow, ProjectDesignImage } from "../types";
import ConfirmDialog from "../../../components/ConfirmDialog";

interface DesignTabProps {
  projectId: string;
}

export default function DesignTab({ projectId }: DesignTabProps) {
  const [entries, setEntries] = useState<ProjectDesignEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<ProjectDesignEntryRow | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  // Images staged inside the add/edit form itself, so photos can be
  // attached before the entry has even been saved.
  const [formImages, setFormImages] = useState<ProjectDesignImage[]>([]);
  const [formImageUrls, setFormImageUrls] = useState<Record<string, string>>({});
  const [formUploading, setFormUploading] = useState(false);
  const formFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getProjectDesignEntries(projectId)
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    const allImages = entries.flatMap((e) => e.images);
    let cancelled = false;
    Promise.all(
      allImages.map(async (img) => {
        try {
          const url = await getProjectFileUrl(img.file_path);
          return [img.id, url] as const;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const r of results) if (r) next[r[0]] = r[1];
      setImageUrls(next);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  const startAdd = () => {
    setTitle("");
    setEditingId(null);
    setFormImages([]);
    setFormImageUrls({});
    setShowForm(true);
  };

  const startEdit = (entry: ProjectDesignEntryRow) => {
    setTitle(entry.title);
    setEditingId(entry.id);
    setFormImages(entry.images);
    setFormImageUrls({});
    entry.images.forEach((img) => {
      getProjectFileUrl(img.file_path)
        .then((url) => setFormImageUrls((prev) => ({ ...prev, [img.id]: url })))
        .catch(() => {});
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTitle("");
    setFormImages([]);
    setFormImageUrls({});
    setError("");
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      let saved = await saveProjectDesignEntry(projectId, title.trim(), editingId);
      saved = await updateProjectDesignImages(saved.id, formImages);
      setEntries((prev) =>
        editingId ? prev.map((e) => (e.id === editingId ? saved : e)) : [...prev, saved]
      );
      cancelForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving design");
    } finally {
      setSaving(false);
    }
  };

  const triggerFormUpload = () => {
    formFileInputRef.current?.click();
  };

  const handleFormFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setFormUploading(true);
    setError("");
    try {
      const uploaded: ProjectDesignImage[] = [];
      for (const file of Array.from(files)) {
        const filePath = await uploadProjectImage(file);
        const image = { id: crypto.randomUUID(), file_path: filePath, label: file.name };
        uploaded.push(image);
        const url = await getProjectFileUrl(filePath);
        setFormImageUrls((prev) => ({ ...prev, [image.id]: url }));
      }
      setFormImages((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setFormUploading(false);
      if (formFileInputRef.current) formFileInputRef.current.value = "";
    }
  };

  const handleRemoveFormImage = (imageId: string) => {
    setFormImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteProjectDesignEntry(toDelete.id);
      setEntries((prev) => prev.filter((e) => e.id !== toDelete.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setToDelete(null);
    }
  };

  const triggerUpload = (entryId: string) => {
    uploadTargetRef.current = entryId;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const entryId = uploadTargetRef.current;
    if (!files || files.length === 0 || !entryId) return;
    const entry = entries.find((en) => en.id === entryId);
    if (!entry) return;

    setUploadingFor(entryId);
    setError("");
    try {
      const uploaded: ProjectDesignImage[] = [];
      for (const file of Array.from(files)) {
        const filePath = await uploadProjectImage(file);
        uploaded.push({ id: crypto.randomUUID(), file_path: filePath, label: file.name });
      }
      const images = [...entry.images, ...uploaded];
      const updated = await updateProjectDesignImages(entryId, images);
      setEntries((prev) => prev.map((en) => (en.id === entryId ? updated : en)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingFor(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      uploadTargetRef.current = null;
    }
  };

  const handleDeleteImage = async (entry: ProjectDesignEntryRow, imageId: string) => {
    const prevEntries = entries;
    const images = entry.images.filter((img) => img.id !== imageId);
    setEntries((prev) => prev.map((en) => (en.id === entry.id ? { ...en, images } : en)));
    try {
      await updateProjectDesignImages(entry.id, images);
    } catch (err) {
      setEntries(prevEntries);
      setError(err instanceof Error ? err.message : "Error deleting image");
    }
  };

  if (loading) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelected}
        className="hidden"
      />

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Design</h2>
        {!showForm && (
          <button
            onClick={startAdd}
            className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add design
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {showForm && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
          <input
            ref={formFileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFormFileSelected}
            className="hidden"
          />

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Title *</label>
            <input
              type="text"
              placeholder="e.g. Landing page mockups, Logo concepts..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted">Photos</label>
              <button
                onClick={triggerFormUpload}
                disabled={formUploading}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                {formUploading ? "Uploading..." : "Upload photos"}
              </button>
            </div>

            {formImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {formImages.map((img) => (
                  <div key={img.id} className="group relative">
                    <div className="relative aspect-video rounded-lg overflow-hidden border border-border bg-background">
                      {formImageUrls[img.id] ? (
                        <img
                          src={formImageUrls[img.id]}
                          alt={img.label || "Design image"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted">
                          <ImageIcon className="w-6 h-6 animate-pulse" />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveFormImage(img.id)}
                      className="absolute top-1.5 right-1.5 p-1.5 rounded bg-black/60 text-white hover:bg-red-500/80 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={cancelForm}
              className="px-4 py-2 rounded bg-surface-hover hover:bg-border text-foreground text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : editingId ? "Update" : "Save"}
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 && !showForm ? (
        <p className="text-sm text-muted">No design uploads yet.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="bg-surface border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{entry.title}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => triggerUpload(entry.id)}
                    disabled={uploadingFor === entry.id}
                    className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary disabled:opacity-50"
                    title="Upload photos"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => startEdit(entry)}
                    className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary"
                    title="Edit title"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setToDelete(entry)}
                    className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {uploadingFor === entry.id && <p className="text-xs text-muted">Uploading...</p>}

              {entry.images.length === 0 ? (
                <p className="text-sm text-muted">No photos yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {entry.images.map((img) => (
                    <div key={img.id} className="group relative">
                      <a
                        href={imageUrls[img.id] ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="relative aspect-video rounded-lg overflow-hidden border border-border bg-background block"
                      >
                        {imageUrls[img.id] ? (
                          <img
                            src={imageUrls[img.id]}
                            alt={img.label || "Design image"}
                            className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted">
                            <ImageIcon className="w-6 h-6 animate-pulse" />
                          </div>
                        )}
                      </a>
                      <button
                        onClick={() => handleDeleteImage(entry, img.id)}
                        className="absolute top-1.5 right-1.5 p-1.5 rounded bg-black/60 text-white hover:bg-red-500/80 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete design?"
          message={`"${toDelete.title}" will be permanently deleted.`}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
