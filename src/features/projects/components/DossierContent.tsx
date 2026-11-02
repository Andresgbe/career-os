import { useRef, useState } from "react";
import { Check, Download, FileText, Loader2, Paperclip, Pencil, Trash2, X } from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import RichTextEditor, { RICH_CONTENT_CLASS } from "../../../components/RichTextEditor";
import { errorMessage } from "../../../lib/errors";
import {
  deleteDossierFile,
  getDossierFileUrl,
  uploadDossierFile,
  uploadProjectEntryImage,
} from "../api";
import type { DossierFile, DossierSectionRow } from "../types";

interface DossierContentProps {
  section: DossierSectionRow;
  canManage: boolean;
  onUpdate: (fields: Partial<Pick<DossierSectionRow, "body" | "files">>) => Promise<boolean>;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isEmptyHtml(html: string): boolean {
  return !html.includes("<img") && !html.replace(/<[^>]*>|&nbsp;/g, "").trim();
}

// A "Documentos y notas" block: rich text plus attached files (contracts...).
export default function DossierContent({ section, canManage, onUpdate }: DossierContentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<DossierFile | null>(null);

  const saveBody = async () => {
    setEditing(false);
    await onUpdate({ body: draft });
  };

  const handleFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setUploading(true);
    setError("");
    const uploaded: DossierFile[] = [];
    try {
      for (const file of Array.from(list)) {
        uploaded.push(await uploadDossierFile(section, file));
      }
    } catch (err) {
      setError(errorMessage(err, "No se pudo subir el archivo"));
    }
    if (uploaded.length > 0) await onUpdate({ files: [...section.files, ...uploaded] });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
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

  const confirmDeleteFile = async () => {
    const file = toDelete;
    setToDelete(null);
    if (!file) return;
    const ok = await onUpdate({ files: section.files.filter((f) => f.id !== file.id) });
    if (ok) {
      deleteDossierFile(file.path).catch(() => {
        // the record is gone; an orphaned file in Storage breaks nothing
      });
    }
  };

  const hasBody = !isEmptyHtml(section.body);

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {editing ? (
        <div className="space-y-2">
          <RichTextEditor
            value={section.body}
            onChange={setDraft}
            uploadImage={uploadProjectEntryImage}
            placeholder="Notas, cláusulas, instrucciones..."
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-hover hover:bg-border text-xs font-medium transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Cancelar
            </button>
            <button
              onClick={saveBody}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary hover:bg-primary-hover text-white text-xs font-medium transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Guardar
            </button>
          </div>
        </div>
      ) : (
        hasBody && (
          <div
            className={`text-sm bg-background border border-border rounded-lg px-3 py-2 break-words ${RICH_CONTENT_CLASS}`}
            dangerouslySetInnerHTML={{ __html: section.body }}
          />
        )
      )}

      {section.files.length > 0 && (
        <ul className="space-y-2">
          {section.files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-2 bg-background border border-border rounded-lg p-2.5"
            >
              <span className="p-1.5 rounded shrink-0 bg-primary/10">
                <FileText className="w-4 h-4 text-primary-hover" />
              </span>
              <button
                onClick={() => download(file)}
                className="flex-1 min-w-0 text-left text-sm hover:text-primary-hover"
              >
                <span className="block truncate">{file.name}</span>
                <span className="block text-xs text-muted">{formatSize(file.size)}</span>
              </button>
              <button
                onClick={() => download(file)}
                className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary shrink-0"
                title="Descargar"
              >
                <Download className="w-4 h-4" />
              </button>
              {canManage && (
                <button
                  onClick={() => setToDelete(file)}
                  className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400 shrink-0"
                  title="Eliminar archivo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!hasBody && section.files.length === 0 && !editing && !canManage && (
        <p className="text-sm text-muted">Todavía no hay nada aquí.</p>
      )}

      {canManage && !editing && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setDraft(section.body);
              setEditing(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-border text-xs font-medium transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            {hasBody ? "Editar texto" : "Escribir texto"}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-border text-xs font-medium transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Paperclip className="w-3.5 h-3.5" />
            )}
            {uploading ? "Subiendo..." : "Adjuntar archivo"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Eliminar archivo"
          message={`¿Eliminar "${toDelete.name}"?`}
          confirmLabel="Eliminar"
          onConfirm={confirmDeleteFile}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
