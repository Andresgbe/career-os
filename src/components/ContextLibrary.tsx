import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Plus,
  FolderOpen,
  Folder,
  FileText,
  Trash2,
  Pencil,
  X,
  Check,
  Copy,
  Columns2,
  Eye,
  PenLine,
  Sparkles,
  Loader2,
} from "lucide-react";
import { marked } from "marked";
import ConfirmDialog from "./ConfirmDialog";
import { errorMessage } from "../lib/errors";
import {
  getFolders,
  addFolder,
  updateFolder,
  deleteFolder,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
} from "../lib/contextDocs";
import type { ContextFolderRow, ContextDocRow } from "../lib/contextDocs";

const COLORS = ["#8b5cf6", "#ec4899", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#f97316"];
const UNFILED = "unfiled";

// UI copy in both languages. Content passes "en"; "es" stays available for
// any untranslated screen that reuses the library.
const STRINGS = {
  es: {
    locale: "es",
    starterLabel: "Crear carpetas sugeridas",
    emptyText: "Todavía no hay documentos de contexto.",
    emptyFolder: "Carpeta vacía",
    newFolderEnter: "Nombre de la carpeta, Enter para crear",
    folders: "carpetas",
    documents: "documentos",
    contextWords: "palabras de contexto",
    copied: "Copiado",
    copyAll: "Copiar todo",
    copyAllTitle: "Copia todos los documentos como un solo markdown",
    folder: "Carpeta",
    suggested: "Carpetas sugeridas",
    adds: "Agrega",
    inFolder: "en",
    dismiss: "Cerrar",
    changeColor: "Cambiar color",
    rename: "Renombrar",
    deleteFolder: "Eliminar carpeta",
    docCount: (n: number) => `${n} ${n === 1 ? "documento" : "documentos"}`,
    folderName: "Nombre de la carpeta",
    document: "Documento",
    emptyFolderCta: "{t.emptyFolderCta}",
    untitled: "Sin título",
    empty: "Vacío",
    unfiled: "Sin carpeta",
    pickDoc: "Elige un documento",
    pickDocHint: "o crea uno nuevo en esta carpeta. Se escribe en markdown y se guarda solo.",
    docTitle: "Título del documento",
    moveTitle: "Mover a otra carpeta",
    saving: "Guardando…",
    unsaved: "Sin guardar",
    saved: "Guardado",
    modeEdit: "Editar",
    modeSplit: "Dividido",
    modePreview: "Vista",
    copyDoc: "Copiar documento",
    deleteDoc: "Eliminar documento",
    placeholder: "# Título\n\n## Sección\n- Punto clave\n\nEscribe en markdown.",
    counts: (w: string, c: string) => `${w} palabras · ${c} caracteres`,
    footerHint: "Markdown · Ctrl+S guarda al instante",
    emptyDoc: "_Documento vacío._",
    newDoc: "Nuevo documento",
    del: "Eliminar",
    deleteFolderMsg: (n: string) => `¿Eliminar "${n}"? Sus documentos pasan a "Sin carpeta".`,
    deleteDocMsg: (n: string) => `¿Eliminar "${n}"? No se puede deshacer.`,
    ago: {
      now: "ahora",
      min: (n: number) => `hace ${n} min`,
      hour: (n: number) => `hace ${n} h`,
      yesterday: "ayer",
      days: (n: number) => `hace ${n} días`,
    },
  },
  en: {
    locale: "en",
    starterLabel: "Create suggested folders",
    emptyText: "No context docs yet.",
    emptyFolder: "Empty folder",
    newFolderEnter: "Folder name, Enter to create",
    folders: "folders",
    documents: "docs",
    contextWords: "words of context",
    copied: "Copied",
    copyAll: "Copy all",
    copyAllTitle: "Copy every doc as a single markdown file",
    folder: "Folder",
    suggested: "Suggested folders",
    adds: "Adds",
    inFolder: "in",
    dismiss: "Dismiss",
    changeColor: "Change color",
    rename: "Rename",
    deleteFolder: "Delete folder",
    docCount: (n: number) => `${n} ${n === 1 ? "doc" : "docs"}`,
    folderName: "Folder name",
    document: "Doc",
    emptyFolderCta: "Empty folder. Create the first doc.",
    untitled: "Untitled",
    empty: "Empty",
    unfiled: "No folder",
    pickDoc: "Pick a doc",
    pickDocHint: "or create a new one in this folder. It's written in markdown and saves itself.",
    docTitle: "Doc title",
    moveTitle: "Move to another folder",
    saving: "Saving…",
    unsaved: "Unsaved",
    saved: "Saved",
    modeEdit: "Edit",
    modeSplit: "Split",
    modePreview: "Preview",
    copyDoc: "Copy doc",
    deleteDoc: "Delete doc",
    placeholder: "# Title\n\n## Section\n- Key point\n\nWrite in markdown.",
    counts: (w: string, c: string) => `${w} words · ${c} characters`,
    footerHint: "Markdown · Ctrl+S saves right away",
    emptyDoc: "_Empty doc._",
    newDoc: "New doc",
    del: "Delete",
    deleteFolderMsg: (n: string) => `Delete "${n}"? Its docs move to "No folder".`,
    deleteDocMsg: (n: string) => `Delete "${n}"? This can't be undone.`,
    ago: {
      now: "just now",
      min: (n: number) => `${n} min ago`,
      hour: (n: number) => `${n} h ago`,
      yesterday: "yesterday",
      days: (n: number) => `${n} days ago`,
    },
  },
};

type Lang = keyof typeof STRINGS;
type Copy = (typeof STRINGS)[Lang];

// Markdown rendered read-only with the app's dark tokens.
export const MARKDOWN_CLASS =
  "[&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h1]:mb-4 [&_h1]:mt-1 " +
  "[&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-2.5 [&_h2]:mt-6 [&_h2]:pb-1.5 [&_h2]:border-b [&_h2]:border-border " +
  "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 " +
  "[&_p]:mb-3 [&_p]:leading-relaxed [&_p]:text-foreground/85 " +
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 " +
  "[&_li]:mb-1 [&_li]:text-foreground/85 [&_li]:marker:text-primary [&_a]:text-primary-hover [&_a]:underline " +
  "[&_code]:bg-surface-hover [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs " +
  "[&_pre]:bg-background [&_pre]:border [&_pre]:border-border [&_pre]:rounded-xl [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:mb-3 " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_blockquote]:italic " +
  "[&_table]:w-full [&_table]:mb-3 [&_th]:text-left [&_th]:border-b [&_th]:border-border [&_th]:py-1.5 " +
  "[&_td]:border-b [&_td]:border-border/50 [&_td]:py-1.5 [&_hr]:border-border [&_hr]:my-5 " +
  "[&_strong]:font-semibold [&_strong]:text-foreground [&_img]:rounded-xl [&_img]:my-3";

export interface StarterFolder {
  name: string;
  color: string;
  docs: { title: string; content: string }[];
}

interface ContextLibraryProps {
  // A module id (e.g. "content") = that module's own context docs
  section: string;
  // Folders + template docs offered when the library is empty
  starter?: StarterFolder[];
  starterLabel?: string;
  emptyText?: string;
  // Explains, under the toolbar, how the AI uses these docs
  aiHint?: ReactNode;
  // UI language of the library's own copy
  lang?: Lang;
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function snippet(content: string, max = 80): string {
  const text = content.replace(/^#+\s*/gm, "").replace(/[*_`>#-]/g, "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function ago(iso: string, t: Copy): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t.ago.now;
  if (mins < 60) return t.ago.min(mins);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t.ago.hour(hours);
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? t.ago.yesterday : t.ago.days(days);
  return new Date(iso).toLocaleDateString(t.locale, { day: "numeric", month: "short" });
}

type Mode = "edit" | "split" | "preview";
type SaveState = "saved" | "dirty" | "saving";

// A library of markdown context docs grouped in folders, backed by
// knowledge_folders / knowledge_docs and scoped by `section`. The AI reads
// the same rows over the NEXUS MCP server, so whatever is written here is
// context it gets without being told again.
export default function ContextLibrary({
  section,
  starter,
  starterLabel,
  emptyText,
  aiHint,
  lang = "en",
}: ContextLibraryProps) {
  const t = STRINGS[lang];
  const [folders, setFolders] = useState<ContextFolderRow[]>([]);
  const [docs, setDocs] = useState<ContextDocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedFolder, setSelectedFolder] = useState<string>(UNFILED);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [mode, setMode] = useState<Mode>("split");
  const [saveState, setSaveState] = useState<SaveState>("saved");

  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingFolder, setDeletingFolder] = useState<ContextFolderRow | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<ContextDocRow | null>(null);
  const [copied, setCopied] = useState<"all" | "doc" | null>(null);

  const report = (err: unknown) => setError(errorMessage(err));

  useEffect(() => {
    Promise.all([getFolders(section), getDocs(section)])
      .then(([f, d]) => {
        setFolders(f);
        setDocs(d);
        const first = f.slice().sort((a, b) => a.sort_order - b.sort_order)[0];
        if (first) setSelectedFolder(first.id);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [section]);

  const selectedDoc = docs.find((d) => d.id === selectedDocId) ?? null;

  // ---------- autosave ----------
  // The draft is saved 900 ms after you stop typing, and immediately when
  // you switch documents, so nothing written here is ever lost.
  const pending = useRef<{ id: string; title: string; content: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function flush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    setSaveState("saving");
    try {
      const updated = await updateDoc(p.id, { title: p.title.trim() || t.untitled, content: p.content });
      setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      if (!pending.current) setSaveState("saved");
    } catch (err) {
      report(err);
      setSaveState("dirty");
    }
  }

  function edit(title: string, content: string) {
    setDraftTitle(title);
    setDraftContent(content);
    if (!selectedDoc) return;
    pending.current = { id: selectedDoc.id, title, content };
    setSaveState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 900);
  }

  // Save what's pending when leaving the page
  useEffect(() => () => void flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function openDoc(doc: ContextDocRow) {
    void flush();
    setSelectedDocId(doc.id);
    setDraftTitle(doc.title);
    setDraftContent(doc.content);
    setSaveState("saved");
  }

  function selectFolder(id: string) {
    void flush();
    setSelectedFolder(id);
    setSelectedDocId(null);
  }

  // ---------- folders ----------

  // Suggested folders/templates not created yet (matched by name), so they
  // can still be added after the library already has content of its own —
  // into the existing folder when one with that name is already there.
  const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const missingStarter = (starter ?? [])
    .map((s) => {
      const folder = folders.find((f) => sameName(f.name, s.name)) ?? null;
      const docsMissing = s.docs.filter(
        (d) => !folder || !docs.some((x) => x.folder_id === folder.id && sameName(x.title, d.title))
      );
      return { ...s, folder, docs: docsMissing };
    })
    .filter((s) => !s.folder || s.docs.length > 0);

  async function createStarter() {
    if (!missingStarter.length) return;
    try {
      let nextOrder = folders.length ? Math.max(...folders.map((f) => f.sort_order)) + 1 : 0;
      const createdFolders: ContextFolderRow[] = [];
      const createdDocs: ContextDocRow[] = [];
      let firstTouched: string | null = null;
      for (const s of missingStarter) {
        let folder = s.folder;
        if (!folder) {
          folder = await addFolder(s.name, s.color, nextOrder++, section);
          createdFolders.push(folder);
        }
        firstTouched ??= folder.id;
        const already = docs.filter((d) => d.folder_id === folder.id).length;
        for (const [j, d] of s.docs.entries()) {
          createdDocs.push(await addDoc(folder.id, d.title, d.content, already + j, section));
        }
      }
      setFolders((prev) => [...prev, ...createdFolders]);
      setDocs((prev) => [...prev, ...createdDocs]);
      if (firstTouched) {
        setSelectedFolder(firstTouched);
        const firstDoc = createdDocs.find((d) => d.folder_id === firstTouched);
        if (firstDoc) openDoc(firstDoc);
      }
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
      const sortOrder = folders.length ? Math.max(...folders.map((f) => f.sort_order)) + 1 : 0;
      const row = await addFolder(name, COLORS[folders.length % COLORS.length], sortOrder, section);
      setFolders((prev) => [...prev, row]);
      selectFolder(row.id);
    } catch (err) {
      report(err);
    }
  }

  function saveRename() {
    const id = renamingFolder;
    const name = renameValue.trim();
    setRenamingFolder(null);
    if (!id || !name) return;
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
    updateFolder(id, { name }).catch(report);
  }

  function recolor(folder: ContextFolderRow) {
    const color = COLORS[(COLORS.indexOf(folder.color) + 1) % COLORS.length];
    setFolders((prev) => prev.map((f) => (f.id === folder.id ? { ...f, color } : f)));
    updateFolder(folder.id, { color }).catch(report);
  }

  async function confirmDeleteFolder() {
    const folder = deletingFolder;
    setDeletingFolder(null);
    if (!folder) return;
    setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    setDocs((prev) => prev.map((d) => (d.folder_id === folder.id ? { ...d, folder_id: null } : d)));
    if (selectedFolder === folder.id) setSelectedFolder(UNFILED);
    try {
      await deleteFolder(folder.id);
    } catch (err) {
      report(err);
    }
  }

  // ---------- docs ----------

  const folderDocs = useMemo(
    () =>
      docs
        .filter((d) => (selectedFolder === UNFILED ? !d.folder_id : d.folder_id === selectedFolder))
        .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
    [docs, selectedFolder]
  );

  async function createDoc() {
    try {
      const folderId = selectedFolder === UNFILED ? null : selectedFolder;
      const row = await addDoc(folderId, t.newDoc, "", folderDocs.length, section);
      setDocs((prev) => [...prev, row]);
      openDoc(row);
      setMode("edit");
    } catch (err) {
      report(err);
    }
  }

  function moveDoc(folderId: string | null) {
    if (!selectedDoc) return;
    setDocs((prev) => prev.map((d) => (d.id === selectedDoc.id ? { ...d, folder_id: folderId } : d)));
    setSelectedFolder(folderId ?? UNFILED);
    updateDoc(selectedDoc.id, { folder_id: folderId }).catch(report);
  }

  async function confirmDeleteDoc() {
    const doc = deletingDoc;
    setDeletingDoc(null);
    if (!doc) return;
    if (pending.current?.id === doc.id) pending.current = null;
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    if (selectedDocId === doc.id) setSelectedDocId(null);
    try {
      await deleteDoc(doc.id);
    } catch (err) {
      report(err);
    }
  }

  // ---------- copy ----------

  const sortedFolders = folders.slice().sort((a, b) => a.sort_order - b.sort_order);
  const folderName = (id: string | null) => folders.find((f) => f.id === id)?.name ?? t.unfiled;

  async function copy(kind: "all" | "doc") {
    let text: string;
    if (kind === "doc") {
      text = `# ${draftTitle}\n\n${draftContent}`;
    } else {
      const groups = [...sortedFolders.map((f) => f.id), null];
      text = groups
        .map((fid) => {
          const list = docs.filter((d) => (d.folder_id ?? null) === fid);
          if (!list.length) return "";
          return `# ${folderName(fid)}\n\n` + list.map((d) => `## ${d.title}\n\n${d.content.trim()}`).join("\n\n");
        })
        .filter(Boolean)
        .join("\n\n---\n\n");
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  const previewHtml = useMemo(
    () => marked.parse(draftContent || t.emptyDoc, { async: false }) as string,
    [draftContent, t.emptyDoc]
  );

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-border bg-surface animate-pulse" />
        ))}
      </div>
    );
  }

  const totalWords = docs.reduce((n, d) => n + wordCount(d.content), 0);
  const unfiledCount = docs.filter((d) => !d.folder_id).length;
  const folderCards = [
    ...sortedFolders.map((f) => ({ id: f.id, name: f.name, color: f.color, folder: f as ContextFolderRow | null })),
    ...(unfiledCount > 0 || selectedFolder === UNFILED
      ? [{ id: UNFILED, name: t.unfiled, color: "#71717a", folder: null as ContextFolderRow | null }]
      : []),
  ];

  const lastUpdated = (fid: string | null) => {
    const list = docs.filter((d) => (d.folder_id ?? null) === fid);
    if (!list.length) return null;
    return list.reduce((a, b) => (a.updated_at > b.updated_at ? a : b)).updated_at;
  };

  // ---------- empty state ----------

  if (folders.length === 0 && docs.length === 0) {
    return (
      <div className="relative rounded-3xl border border-border bg-surface overflow-hidden">
        <span className="absolute -top-32 left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="relative px-6 py-14 text-center space-y-5 max-w-lg mx-auto">
          <span className="mx-auto w-14 h-14 rounded-2xl bg-primary/15 text-primary-hover flex items-center justify-center">
            <FolderOpen className="w-7 h-7" />
          </span>
          <div className="space-y-2">
            <p className="text-xl font-bold">{emptyText ?? t.emptyText}</p>
            {aiHint && <div className="text-sm text-muted leading-relaxed">{aiHint}</div>}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            {starter && (
              <button
                onClick={createStarter}
                className="flex items-center gap-2 h-11 px-5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                {starterLabel ?? t.starterLabel}
              </button>
            )}
            <button
              onClick={() => setAddingFolder(true)}
              className="flex items-center gap-2 h-11 px-5 rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t.emptyFolder}
            </button>
          </div>
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
              placeholder={t.newFolderEnter}
              className="w-full h-11 px-4 rounded-xl bg-background border border-primary text-sm outline-none"
            />
          )}
        </div>
      </div>
    );
  }

  // ---------- library ----------

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-muted flex-wrap">
          <span><span className="text-foreground font-semibold tabular-nums">{folders.length}</span> {t.folders}</span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span><span className="text-foreground font-semibold tabular-nums">{docs.length}</span> {t.documents}</span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span><span className="text-foreground font-semibold tabular-nums">{totalWords.toLocaleString(t.locale)}</span> {t.contextWords}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {missingStarter.length > 0 && (
            <button
              onClick={createStarter}
              className="flex items-center gap-2 h-10 px-4 rounded-xl border border-primary/40 bg-primary/10 text-sm font-semibold text-primary-hover hover:bg-primary/15 transition-colors"
              title={`${t.adds}: ${missingStarter
                .map((s) => (s.folder ? `${s.docs.map((d) => d.title).join(", ")} (${t.inFolder} ${s.name})` : s.name))
                .join(" · ")}`}
            >
              <Sparkles className="w-4 h-4" />
              {t.suggested}
            </button>
          )}
          <button
            onClick={() => copy("all")}
            className="flex items-center gap-2 h-10 px-4 rounded-xl border border-border bg-surface text-sm font-semibold text-muted hover:text-foreground hover:border-[#3a3a44] transition-colors"
            title={t.copyAllTitle}
          >
            {copied === "all" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied === "all" ? t.copied : t.copyAll}
          </button>
          <button
            onClick={() => setAddingFolder(true)}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t.folder}
          </button>
        </div>
      </div>

      {aiHint && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-3">
          <Sparkles className="w-4 h-4 text-primary-hover shrink-0 mt-0.5" />
          <div className="text-[13px] text-foreground/80 leading-relaxed">{aiHint}</div>
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-300/70 hover:text-red-200 shrink-0">{t.dismiss}</button>
        </div>
      )}

      {/* Folder cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {folderCards.map((card) => {
          const active = selectedFolder === card.id;
          const fid = card.id === UNFILED ? null : card.id;
          const count = docs.filter((d) => (d.folder_id ?? null) === fid).length;
          const updated = lastUpdated(fid);
          const Icon = active ? FolderOpen : Folder;

          if (renamingFolder === card.id) {
            return (
              <div key={card.id} className="rounded-2xl border border-primary bg-surface p-4 flex items-center">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={saveRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename();
                    if (e.key === "Escape") setRenamingFolder(null);
                  }}
                  className="w-full bg-transparent text-sm font-semibold outline-none"
                />
              </div>
            );
          }

          return (
            <div
              key={card.id}
              onClick={() => selectFolder(card.id)}
              className={`group relative cursor-pointer rounded-2xl border p-4 flex flex-col gap-3 overflow-hidden transition-all ${
                active
                  ? "bg-surface-hover"
                  : "border-border bg-surface hover:border-[#3a3a44] hover:-translate-y-0.5"
              }`}
              style={active ? { borderColor: `${card.color}99`, boxShadow: `0 16px 40px -24px ${card.color}` } : undefined}
            >
              <span
                className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl pointer-events-none transition-opacity"
                style={{ backgroundColor: card.color, opacity: active ? 0.28 : 0.1 }}
              />
              <div className="relative flex items-start justify-between gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (card.folder) recolor(card.folder);
                  }}
                  title={card.folder ? t.changeColor : undefined}
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${card.color}22`, color: card.color }}
                >
                  <Icon className="w-5 h-5" />
                </button>
                {card.folder && (
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingFolder(card.id);
                        setRenameValue(card.name);
                      }}
                      className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-white/5"
                      title={t.rename}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingFolder(card.folder);
                      }}
                      className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-white/5"
                      title={t.deleteFolder}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="relative min-w-0">
                <p className="text-[15px] font-semibold truncate">{card.name}</p>
                <p className="text-xs text-muted mt-0.5">
                  {t.docCount(count)}
                  {updated && ` · ${ago(updated, t)}`}
                </p>
              </div>
            </div>
          );
        })}

        {addingFolder && (
          <div className="rounded-2xl border border-primary bg-surface p-4 flex items-center">
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={submitFolder}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitFolder();
                if (e.key === "Escape") setAddingFolder(false);
              }}
              placeholder={t.folderName}
              className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-muted"
            />
          </div>
        )}
      </div>

      {/* Docs + editor */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 items-start">
        <aside className="rounded-3xl border border-border bg-surface p-3 space-y-1.5 lg:sticky lg:top-[76px]">
          <div className="flex items-center justify-between px-2 pt-1 pb-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted truncate">
              {folderName(selectedFolder === UNFILED ? null : selectedFolder)}
            </span>
            <button
              onClick={createDoc}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-muted hover:text-foreground hover:bg-white/5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {t.document}
            </button>
          </div>

          {folderDocs.length === 0 ? (
            <button
              onClick={createDoc}
              className="w-full rounded-2xl border border-dashed border-[#33333b] px-4 py-8 text-sm text-muted hover:text-foreground hover:border-primary/50 transition-colors"
            >
              {t.emptyFolderCta}
            </button>
          ) : (
            folderDocs.map((doc) => {
              const active = selectedDocId === doc.id;
              return (
                <button
                  key={doc.id}
                  onClick={() => openDoc(doc)}
                  className={`w-full text-left rounded-2xl px-3 py-2.5 transition-colors ${
                    active ? "bg-primary/12 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.4)]" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        active ? "bg-primary text-white" : "bg-white/5 text-muted"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">
                        {active ? draftTitle || t.untitled : doc.title}
                      </span>
                      <span className="block text-[11px] text-muted truncate">
                        {snippet(active ? draftContent : doc.content, 46) || t.empty}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </aside>

        <section className="rounded-3xl border border-border bg-surface flex flex-col min-h-[560px] overflow-hidden">
          {!selectedDoc ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10 gap-3">
              <span className="w-12 h-12 rounded-2xl bg-white/5 text-muted flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </span>
              <p className="font-semibold">{t.pickDoc}</p>
              <p className="text-sm text-muted max-w-xs">{t.pickDocHint}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <input
                    value={draftTitle}
                    onChange={(e) => edit(e.target.value, draftContent)}
                    className="w-full bg-transparent text-xl font-bold tracking-tight outline-none placeholder:text-muted/50"
                    placeholder={t.docTitle}
                  />
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                    <select
                      value={selectedDoc.folder_id ?? UNFILED}
                      onChange={(e) => moveDoc(e.target.value === UNFILED ? null : e.target.value)}
                      className="bg-transparent outline-none hover:text-foreground cursor-pointer [color-scheme:dark]"
                      title={t.moveTitle}
                    >
                      {sortedFolders.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                      <option value={UNFILED}>{t.unfiled}</option>
                    </select>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      {saveState === "saving" ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> {t.saving}</>
                      ) : saveState === "dirty" ? (
                        <><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> {t.unsaved}</>
                      ) : (
                        <><Check className="w-3 h-3 text-emerald-400" /> {t.saved} {ago(selectedDoc.updated_at, t)}</>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5 p-1 rounded-xl bg-background/60 border border-border">
                    {([
                      { key: "edit", icon: PenLine, label: t.modeEdit },
                      { key: "split", icon: Columns2, label: t.modeSplit },
                      { key: "preview", icon: Eye, label: t.modePreview },
                    ] as const).map((m) => (
                      <button
                        key={m.key}
                        onClick={() => setMode(m.key)}
                        title={m.label}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          mode === m.key ? "bg-surface-hover text-foreground" : "text-muted hover:text-foreground"
                        } ${m.key === "split" ? "hidden md:flex" : ""}`}
                      >
                        <m.icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{m.label}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => copy("doc")}
                    className="p-2 rounded-xl text-muted hover:text-foreground hover:bg-white/5 transition-colors"
                    title={t.copyDoc}
                  >
                    {copied === "doc" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setDeletingDoc(selectedDoc)}
                    className="p-2 rounded-xl text-muted hover:text-red-400 hover:bg-white/5 transition-colors"
                    title={t.deleteDoc}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className={`flex-1 grid ${mode === "split" ? "md:grid-cols-2" : "grid-cols-1"}`}>
                {mode !== "preview" && (
                  <textarea
                    value={draftContent}
                    onChange={(e) => edit(draftTitle, e.target.value)}
                    onBlur={() => void flush()}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                        e.preventDefault();
                        void flush();
                      }
                    }}
                    placeholder={t.placeholder}
                    className={`w-full h-full min-h-[460px] bg-background/40 px-5 py-4 text-[13.5px] font-mono leading-relaxed outline-none resize-none placeholder:text-muted/40 ${
                      mode === "split" ? "md:border-r border-border" : ""
                    }`}
                  />
                )}
                {mode !== "edit" && (
                  <div
                    className={`overflow-y-auto px-6 py-5 text-sm ${mode === "split" ? "hidden md:block max-h-[640px]" : ""} ${MARKDOWN_CLASS}`}
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                )}
              </div>

              <div className="flex items-center justify-between px-5 py-2.5 border-t border-border text-[11px] text-muted">
                <span className="tabular-nums">
                  {t.counts(wordCount(draftContent).toLocaleString(t.locale), draftContent.length.toLocaleString(t.locale))}
                </span>
                <span className="hidden sm:inline">{t.footerHint}</span>
              </div>
            </>
          )}
        </section>
      </div>

      {deletingFolder && (
        <ConfirmDialog
          title={t.deleteFolder}
          confirmLabel={t.del}
          message={t.deleteFolderMsg(deletingFolder.name)}
          onConfirm={confirmDeleteFolder}
          onCancel={() => setDeletingFolder(null)}
        />
      )}
      {deletingDoc && (
        <ConfirmDialog
          title={t.deleteDoc}
          confirmLabel={t.del}
          message={t.deleteDocMsg(deletingDoc.title)}
          onConfirm={confirmDeleteDoc}
          onCancel={() => setDeletingDoc(null)}
        />
      )}
    </div>
  );
}
