import { errorMessage } from "../../lib/errors";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Folder,
  FileText,
  Trash2,
  Save,
  Eye,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { marked } from "marked";
import ConfirmDialog from "../../components/ConfirmDialog";
import {
  getFolders,
  addFolder,
  updateFolder,
  deleteFolder,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
} from "./api";
import type { KnowledgeFolderRow, KnowledgeDocRow } from "./types";
import {
  STARTER_FOLDERS,
  PROFILE_DOC_TITLE,
  PROFILE_TEMPLATE,
  docSnippet,
} from "./types";

const DEFAULT_COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#ec4899",
  "#3b82f6",
  "#f97316",
];

const UNFILED = "unfiled";

// Markdown rendered read-only. Styling lives here rather than in a global
// stylesheet so the preview matches the app's dark tokens.
const MD_CLASS =
  "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-4 " +
  "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 " +
  "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-3 " +
  "[&_p]:mb-3 [&_p]:leading-relaxed " +
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 " +
  "[&_li]:mb-1 [&_a]:text-primary [&_a]:underline " +
  "[&_code]:bg-surface-hover [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs " +
  "[&_pre]:bg-background [&_pre]:border [&_pre]:border-border [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:mb-3 " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_blockquote]:text-muted " +
  "[&_table]:w-full [&_table]:mb-3 [&_th]:text-left [&_th]:border-b [&_th]:border-border [&_th]:py-1 " +
  "[&_td]:border-b [&_td]:border-border/50 [&_td]:py-1 [&_hr]:border-border [&_hr]:my-4 " +
  "[&_strong]:font-semibold";

export default function KnowledgePage() {
  const [folders, setFolders] = useState<KnowledgeFolderRow[]>([]);
  const [docs, setDocs] = useState<KnowledgeDocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedFolder, setSelectedFolder] = useState<string>(UNFILED);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingFolder, setDeletingFolder] =
    useState<KnowledgeFolderRow | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<KnowledgeDocRow | null>(null);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getFolders(), getDocs()])
      .then(([f, d]) => {
        setFolders(f);
        setDocs(d);
        if (f.length > 0) setSelectedFolder(f[0].id);
      })
      .catch(report)
      .finally(() => setLoading(false));
  }, []);

  function report(err: unknown) {
    setError(errorMessage(err, "Algo salió mal"));
  }

  const selectedDoc = docs.find((d) => d.id === selectedDocId) ?? null;
  const dirty =
    !!selectedDoc &&
    (draftTitle !== selectedDoc.title || draftContent !== selectedDoc.content);

  const folderDocs = useMemo(
    () =>
      docs.filter((d) =>
        selectedFolder === UNFILED ? !d.folder_id : d.folder_id === selectedFolder
      ),
    [docs, selectedFolder]
  );

  const previewHtml = useMemo(
    () => marked.parse(draftContent || "_Documento vacío._", { async: false }),
    [draftContent]
  );

  function openDoc(doc: KnowledgeDocRow) {
    setSelectedDocId(doc.id);
    setDraftTitle(doc.title);
    setDraftContent(doc.content);
    setMode("edit");
  }

  async function createStarterFolders() {
    try {
      const created: KnowledgeFolderRow[] = [];
      for (const [i, f] of STARTER_FOLDERS.entries()) {
        created.push(await addFolder(f.name, f.color, i));
      }
      // Seed the profile doc so the module starts with something to fill in,
      // and so Claude always has a known document to read.
      const profile = await addDoc(
        created[0].id,
        PROFILE_DOC_TITLE,
        PROFILE_TEMPLATE,
        0
      );
      setFolders(created);
      setDocs([profile]);
      setSelectedFolder(created[0].id);
      openDoc(profile);
    } catch (err) {
      report(err);
    }
  }

  async function submitFolder() {
    const name = newFolderName.trim();
    setAddingFolder(false);
    setNewFolderName("");
    if (!name) return;
    try {
      const sortOrder = folders.length
        ? Math.max(...folders.map((f) => f.sort_order)) + 1
        : 0;
      const color = DEFAULT_COLORS[folders.length % DEFAULT_COLORS.length];
      const row = await addFolder(name, color, sortOrder);
      setFolders((prev) => [...prev, row]);
      setSelectedFolder(row.id);
    } catch (err) {
      report(err);
    }
  }

  async function saveRename() {
    const id = renamingFolder;
    const name = renameValue.trim();
    setRenamingFolder(null);
    if (!id || !name) return;
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
    updateFolder(id, { name }).catch(report);
  }

  async function confirmDeleteFolder() {
    const folder = deletingFolder;
    setDeletingFolder(null);
    if (!folder) return;
    setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    setDocs((prev) =>
      prev.map((d) => (d.folder_id === folder.id ? { ...d, folder_id: null } : d))
    );
    if (selectedFolder === folder.id) setSelectedFolder(UNFILED);
    try {
      await deleteFolder(folder.id);
    } catch (err) {
      report(err);
    }
  }

  async function createDoc() {
    try {
      const folderId = selectedFolder === UNFILED ? null : selectedFolder;
      const row = await addDoc(folderId, "Nuevo documento", "", folderDocs.length);
      setDocs((prev) => [...prev, row]);
      openDoc(row);
    } catch (err) {
      report(err);
    }
  }

  async function saveDoc() {
    if (!selectedDoc) return;
    setSaving(true);
    try {
      const updated = await updateDoc(selectedDoc.id, {
        title: draftTitle.trim() || "Sin título",
        content: draftContent,
      });
      setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setDraftTitle(updated.title);
    } catch (err) {
      report(err);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteDoc() {
    const doc = deletingDoc;
    setDeletingDoc(null);
    if (!doc) return;
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    if (selectedDocId === doc.id) setSelectedDocId(null);
    try {
      await deleteDoc(doc.id);
    } catch (err) {
      report(err);
    }
  }

  if (loading) return <p className="text-sm text-muted">Cargando...</p>;

  const columns = [
    ...folders
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((f) => ({ id: f.id, name: f.name, color: f.color, real: true })),
    { id: UNFILED, name: "Sin carpeta", color: null as string | null, real: false },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Knowledge</h1>
        <p className="text-sm text-muted">
          Documentos markdown con tu contexto. Claude los lee por MCP para saber
          quién eres sin que se lo expliques cada vez.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {folders.length === 0 && docs.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <Folder className="w-8 h-8 text-muted mx-auto mb-3" />
          <p className="text-sm text-muted mb-4">
            Todavía no hay carpetas. Empieza con un set básico y después lo
            ajustas.
          </p>
          <button
            onClick={createStarterFolders}
            className="px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
          >
            Crear carpetas sugeridas
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[200px_240px_1fr] gap-4">
          {/* Folders */}
          <aside className="bg-surface border border-border rounded-xl p-3 h-fit">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                Carpetas
              </span>
              <button
                onClick={() => setAddingFolder(true)}
                className="p-1 rounded text-muted hover:text-primary hover:bg-surface-hover transition-colors"
                title="Nueva carpeta"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-0.5">
              {columns.map((col) => {
                const count = docs.filter((d) =>
                  col.id === UNFILED ? !d.folder_id : d.folder_id === col.id
                ).length;
                const active = selectedFolder === col.id;

                if (renamingFolder === col.id) {
                  return (
                    <input
                      key={col.id}
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={saveRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename();
                        if (e.key === "Escape") setRenamingFolder(null);
                      }}
                      className="bg-background border border-primary rounded px-2 py-1 text-sm outline-none"
                    />
                  );
                }

                return (
                  <div key={col.id} className="group flex items-center gap-1">
                    <button
                      onClick={() => {
                        setSelectedFolder(col.id);
                        setSelectedDocId(null);
                      }}
                      className={`flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                        active
                          ? "bg-surface-hover text-foreground"
                          : "text-muted hover:bg-surface-hover"
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: col.color ?? "var(--color-border)" }}
                      />
                      <span className="truncate flex-1 text-left">{col.name}</span>
                      <span className="text-[10px] text-muted shrink-0">{count}</span>
                    </button>
                    {col.real && (
                      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setRenamingFolder(col.id);
                            setRenameValue(col.name);
                          }}
                          className="p-1 rounded text-muted hover:text-primary"
                          title="Renombrar"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() =>
                            setDeletingFolder(
                              folders.find((f) => f.id === col.id) ?? null
                            )
                          }
                          className="p-1 rounded text-muted hover:text-red-400"
                          title="Eliminar"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {addingFolder && (
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onBlur={submitFolder}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitFolder();
                    if (e.key === "Escape") setAddingFolder(false);
                  }}
                  placeholder="Nombre"
                  className="bg-background border border-primary rounded px-2 py-1 text-sm outline-none mt-1"
                />
              )}
            </div>
          </aside>

          {/* Docs in the selected folder */}
          <aside className="bg-surface border border-border rounded-xl p-3 h-fit">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                Documentos
              </span>
              <button
                onClick={createDoc}
                className="p-1 rounded text-muted hover:text-primary hover:bg-surface-hover transition-colors"
                title="Nuevo documento"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {folderDocs.length === 0 ? (
              <p className="text-xs text-muted px-2 py-3">
                Sin documentos en esta carpeta.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {folderDocs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => openDoc(doc)}
                    className={`text-left px-2 py-1.5 rounded transition-colors ${
                      selectedDocId === doc.id
                        ? "bg-surface-hover"
                        : "hover:bg-surface-hover"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-muted shrink-0" />
                      <span className="text-sm truncate">{doc.title}</span>
                    </span>
                    {doc.content && (
                      <span className="block text-[11px] text-muted truncate pl-5.5 mt-0.5">
                        {docSnippet(doc.content, 40)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </aside>

          {/* Editor */}
          <section className="bg-surface border border-border rounded-xl flex flex-col min-h-[420px]">
            {!selectedDoc ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <FileText className="w-8 h-8 text-muted mb-3" />
                <p className="text-sm text-muted">
                  Elige un documento o crea uno nuevo.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-wrap">
                  <input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent font-semibold outline-none"
                    placeholder="Título del documento"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                    >
                      {mode === "edit" ? (
                        <>
                          <Eye className="w-3.5 h-3.5" /> Vista
                        </>
                      ) : (
                        <>
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </>
                      )}
                    </button>
                    <button
                      onClick={saveDoc}
                      disabled={!dirty || saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary hover:bg-primary-hover text-white text-xs font-medium transition-colors disabled:opacity-40"
                    >
                      {saving ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      {saving ? "Guardando" : dirty ? "Guardar" : "Guardado"}
                    </button>
                    <button
                      onClick={() => setDeletingDoc(selectedDoc)}
                      className="p-1.5 rounded text-muted hover:text-red-400 hover:bg-surface-hover transition-colors"
                      title="Eliminar documento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {mode === "edit" ? (
                  <textarea
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    placeholder={"# Sobre mí\n\n- Peso: 72 kg\n- Altura: 1.75 m\n\nEscribe en markdown."}
                    className="flex-1 bg-background m-4 rounded-lg border border-border px-3 py-2 text-sm font-mono leading-relaxed outline-none focus:border-primary resize-y min-h-[320px]"
                  />
                ) : (
                  <div
                    className={`flex-1 overflow-y-auto px-5 py-4 text-sm ${MD_CLASS}`}
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                )}
              </>
            )}
          </section>
        </div>
      )}

      {deletingFolder && (
        <ConfirmDialog
          title="Eliminar carpeta"
          message={`Eliminar "${deletingFolder.name}"? Sus documentos pasan a "Sin carpeta".`}
          onConfirm={confirmDeleteFolder}
          onCancel={() => setDeletingFolder(null)}
        />
      )}

      {deletingDoc && (
        <ConfirmDialog
          title="Eliminar documento"
          message={`Eliminar "${deletingDoc.title}"? No se puede deshacer.`}
          onConfirm={confirmDeleteDoc}
          onCancel={() => setDeletingDoc(null)}
        />
      )}
    </div>
  );
}
