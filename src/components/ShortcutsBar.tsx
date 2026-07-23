import { useRef, useState } from "react";
import { Plus, X, Save, Upload, Loader2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import ShortcutTile from "./ShortcutTile";

export interface ShortcutItem {
  id: string;
  name: string;
  url: string;
  icon_url: string | null;
}

// Accept "google.com" as well as "https://google.com"
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

interface ShortcutsBarProps<T extends ShortcutItem> {
  items: T[];
  addShortcut: (name: string, url: string, iconUrl: string | null) => Promise<T>;
  deleteShortcut: (id: string) => Promise<void>;
  reorderShortcuts: (order: { id: string; sort_order: number }[]) => Promise<void>;
  uploadIcon: (file: File) => Promise<string>;
  onAdded: (item: T) => void;
  onDeleted: (id: string) => void;
  onReordered: (items: T[]) => void;
  size?: "md" | "lg";
}

// Reusable "browser new-tab" style shortcuts row: tiles with real favicons,
// an "+ Add" tile that opens a modal, and per-tile delete with confirmation.
// The parent owns the actual list (fetched from its own table); this
// component just renders it and performs the add/delete calls it's given.
export default function ShortcutsBar<T extends ShortcutItem>({
  items,
  addShortcut,
  deleteShortcut,
  reorderShortcuts,
  uploadIcon,
  onAdded,
  onDeleted,
  onReordered,
  size = "md",
}: ShortcutsBarProps<T>) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<T | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeForm = () => {
    setShowForm(false);
    setName("");
    setUrl("");
    setIconUrl(null);
    setError("");
  };

  const handleIconSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIcon(true);
    setError("");
    try {
      const uploaded = await uploadIcon(file);
      setIconUrl(uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error uploading logo");
    } finally {
      setUploadingIcon(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAdd = async () => {
    if (!name.trim() || !url.trim()) {
      setError("Enter a name and a link.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await addShortcut(name.trim(), normalizeUrl(url), iconUrl);
      onAdded(saved);
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error adding shortcut");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    onDeleted(toDelete.id);
    try {
      await deleteShortcut(toDelete.id);
    } catch {
      // local state already updated optimistically; nothing else to do
    } finally {
      setToDelete(null);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    if (sourceIndex === destIndex) return;

    const reordered = Array.from(items);
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(destIndex, 0, moved);

    onReordered(reordered);
    try {
      await reorderShortcuts(
        reordered.map((item, i) => ({ id: item.id, sort_order: i }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error reordering shortcuts");
    }
  };

  const tileWrap = size === "lg" ? "w-24" : "w-20";
  const tileBox = size === "lg" ? "w-18 h-18" : "w-14 h-14";

  return (
    <div>
      {error && !showForm && (
        <p className="text-sm text-red-400 mb-3">{error}</p>
      )}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="shortcuts" direction="horizontal">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex flex-wrap gap-4"
            >
              {items.map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={snapshot.isDragging ? "opacity-80" : ""}
                    >
                      <ShortcutTile
                        name={item.name}
                        url={item.url}
                        iconUrl={item.icon_url}
                        size={size}
                        onDelete={() => setToDelete(item)}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}

              <button
                onClick={() => setShowForm(true)}
                className={`flex flex-col items-center gap-2 ${tileWrap}`}
                title="Add shortcut"
              >
                <div
                  className={`${tileBox} rounded-xl bg-surface border border-dashed border-border flex items-center justify-center hover:border-primary hover:text-primary text-muted transition-colors`}
                >
                  <Plus className="w-6 h-6" />
                </div>
                <span className="text-xs text-muted">Add</span>
              </button>
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeForm}
        >
          <div
            className="bg-surface border border-border rounded-xl p-5 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Add shortcut</h3>
              <button
                onClick={closeForm}
                className="p-1.5 rounded text-muted hover:bg-surface-hover"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Name *</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Swagger UI"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Link *</label>
                <input
                  type="text"
                  placeholder="e.g. google.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Logo (optional)</label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden shrink-0">
                    {uploadingIcon ? (
                      <Loader2 className="w-4 h-4 text-muted animate-spin" />
                    ) : iconUrl ? (
                      <img
                        src={iconUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Upload className="w-4 h-4 text-muted" />
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingIcon}
                    className="px-3 py-1.5 rounded bg-surface-hover hover:bg-border text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {iconUrl ? "Replace" : "Upload"}
                  </button>
                  {iconUrl && (
                    <button
                      onClick={() => setIconUrl(null)}
                      className="text-xs text-muted hover:text-red-400"
                    >
                      Remove
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleIconSelected}
                    className="hidden"
                  />
                </div>
                <p className="text-[11px] text-muted">
                  Leave empty to auto-detect the site's favicon.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={closeForm}
                className="px-4 py-2 rounded bg-surface-hover hover:bg-border text-foreground text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setToDelete(null)}
        >
          <div
            className="bg-surface border border-border rounded-xl p-5 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-2">Remove shortcut?</h3>
            <p className="text-sm text-muted mb-5 break-all">
              "{toDelete.name}" will be removed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setToDelete(null)}
                className="px-4 py-2 rounded bg-surface-hover hover:bg-border text-foreground text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded bg-red-500/80 hover:bg-red-500 text-white text-sm font-medium transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
