import { errorMessage } from "../../../lib/errors";
import { useRef, useState } from "react";
import {
  X,
  Pencil,
  Save,
  Upload,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Trash2,
  FileText,
} from "lucide-react";
import RichTextEditor, {
  RICH_CONTENT_CLASS,
} from "../../../components/RichTextEditor";
import { updateSubject, uploadGradesImage, deleteGradesImage } from "../api";
import type { SubjectRow } from "../types";

interface EvalPlanModalProps {
  subject: SubjectRow;
  startInEdit?: boolean;
  onClose: () => void;
  onSaved: (subject: SubjectRow) => void;
}

// Previewer + editor for a subject's "plan de evaluación": free-form rich
// text, plus photos/scans of the plan handed out in class. Images open
// full screen in a lightbox so a photographed plan is actually readable.
export default function EvalPlanModal({
  subject,
  startInEdit = false,
  onClose,
  onSaved,
}: EvalPlanModalProps) {
  const [editing, setEditing] = useState(startInEdit);
  const [text, setText] = useState(subject.eval_plan_text);
  const [images, setImages] = useState<string[]>(subject.eval_plan_images);
  const [removed, setRemoved] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const plainText = text.replace(/<[^>]*>/g, "").trim();
  const isEmpty = plainText.length === 0 && images.length === 0;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        urls.push(await uploadGradesImage(file));
      }
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      setError(errorMessage(err, "Error subiendo la imagen"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (url: string) => {
    setImages((prev) => prev.filter((u) => u !== url));
    setRemoved((prev) => [...prev, url]);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await updateSubject(subject.id, {
        eval_plan_text: text,
        eval_plan_images: images,
      });
      // Drop the storage objects only once the row no longer points at them
      await Promise.all(
        removed.map((url) => deleteGradesImage(url).catch(() => {}))
      );
      setRemoved([]);
      onSaved(updated);
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err, "Error guardando el plan"));
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setText(subject.eval_plan_text);
    setImages(subject.eval_plan_images);
    setRemoved([]);
    setEditing(false);
    setError("");
  };

  const showPrev = () =>
    setLightbox((i) => (i === null ? null : (i - 1 + images.length) % images.length));
  const showNext = () =>
    setLightbox((i) => (i === null ? null : (i + 1) % images.length));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: subject.color }}
            />
            <h3 className="font-semibold truncate">
              Plan de evaluación
              <span className="text-muted font-normal"> · {subject.name}</span>
            </h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-muted hover:text-primary hover:bg-surface-hover transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Editar
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded text-muted hover:bg-surface-hover"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && <p className="text-sm text-red-400">{error}</p>}

          {editing ? (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted">Plan escrito</label>
                <RichTextEditor
                  value={text}
                  onChange={setText}
                  uploadImage={uploadGradesImage}
                  placeholder="Escribe el plan de evaluación: cortes, porcentajes, fechas..."
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-muted">
                  Imágenes del plan (foto o scan)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFiles(e.target.files)}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 rounded bg-surface-hover hover:bg-border text-foreground text-sm font-medium transition-colors disabled:opacity-50 w-fit"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploading ? "Subiendo..." : "Subir imagen"}
                </button>

                {images.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-1">
                    {images.map((url, i) => (
                      <div key={url} className="relative group">
                        <button
                          onClick={() => setLightbox(i)}
                          className="block w-full aspect-video rounded-lg overflow-hidden border border-border bg-background"
                        >
                          <img
                            src={url}
                            alt={`Plan ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                        <button
                          onClick={() => removeImage(url)}
                          className="absolute top-1.5 right-1.5 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                          title="Quitar imagen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : isEmpty ? (
            <div className="text-center py-10">
              <FileText className="w-8 h-8 text-muted mx-auto mb-3" />
              <p className="text-sm text-muted">
                Esta materia todavía no tiene plan de evaluación.
              </p>
              <button
                onClick={() => setEditing(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors mx-auto"
              >
                <Pencil className="w-4 h-4" />
                Agregar plan
              </button>
            </div>
          ) : (
            <>
              {plainText.length > 0 && (
                <div
                  className={`text-sm leading-relaxed ${RICH_CONTENT_CLASS}`}
                  dangerouslySetInnerHTML={{ __html: text }}
                />
              )}

              {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map((url, i) => (
                    <button
                      key={url}
                      onClick={() => setLightbox(i)}
                      className="aspect-video rounded-lg overflow-hidden border border-border bg-background hover:border-primary transition-colors"
                      title="Ver en grande"
                    >
                      <img
                        src={url}
                        alt={`Plan ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer (edit mode only) */}
        {editing && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
            <button
              onClick={cancelEdit}
              className="px-4 py-2 rounded bg-surface-hover hover:bg-border text-foreground text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || uploading}
              className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        )}
      </div>

      {/* Full-screen image previewer */}
      {lightbox !== null && images[lightbox] && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={(e) => {
            e.stopPropagation();
            setLightbox(null);
          }}
        >
          <img
            src={images[lightbox]}
            alt={`Plan ${lightbox + 1}`}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showPrev();
                }}
                className="absolute left-3 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                aria-label="Anterior"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showNext();
                }}
                className="absolute right-3 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                aria-label="Siguiente"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <span className="absolute bottom-4 text-xs text-white/70">
                {lightbox + 1} / {images.length}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
