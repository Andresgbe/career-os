import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Brain,
  Search,
  FolderPlus,
  FilePlus,
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Pencil,
  X,
  Trash2,
  Copy,
  Check,
  Eye,
  PenLine,
  Columns2,
  Loader2,
  Plug,
  ListTree,
  Clock3,
  Hash,
  Sparkles,
} from "lucide-react";
import { marked } from "marked";
import ConfirmDialog from "../../components/ConfirmDialog";
import { MARKDOWN_CLASS } from "../../components/ContextLibrary";
import { errorMessage } from "../../lib/errors";
import {
  getFolders,
  getDocs,
  addFolder,
  updateFolder,
  deleteFolder,
  addDoc,
  updateDoc,
  deleteDoc,
} from "../../lib/contextDocs";
import type { ContextDocRow, ContextFolderRow } from "../../lib/contextDocs";
import { BRAIN_SECTION, BRAIN_STARTER } from "./brainTemplates";

const COLORS = ["#8b5cf6", "#ec4899", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#f97316"];
const UNFILED = "unfiled";

type Mode = "read" | "edit" | "split";
type SaveState = "saved" | "dirty" | "saving";

// ---------- helpers ----------

const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

// Headings (h1–h3) outside code fences, in document order — the same order
// marked renders them, so index i maps to the i-th rendered heading.
function outlineOf(md: string): { level: number; text: string }[] {
  const out: { level: number; text: string }[] = [];
  let fenced = false;
  for (const line of md.split("\n")) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const m = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (m) out.push({ level: m[1].length, text: m[2].replace(/[*_`]/g, "") });
  }
  return out;
}

function renderMarkdown(md: string): string {
  let i = 0;
  const html = marked.parse(md || "_This doc is empty._", { async: false }) as string;
  return html.replace(/<h([1-3])>/g, (_m, l) => `<h${l} id="brain-h-${i++}" class="scroll-mt-6">`);
}

function snippetAround(content: string, needle: string, radius = 48): string {
  const flat = content.replace(/\s+/g, " ");
  const at = flat.toLowerCase().indexOf(needle.toLowerCase());
  if (at === -1) return flat.slice(0, radius * 2);
  const start = Math.max(0, at - radius);
  return (start > 0 ? "…" : "") + flat.slice(start, at + needle.length + radius) + "…";
}

// ============================================
// PAGE
// ============================================

// BRAIN: the single library of markdown context every agent reads over MCP
// (tools `brain` / `brain_write` in mcp-server/index.js). Backed by
// knowledge_folders / knowledge_docs with section = "brain". It's a fixed
// admin-only page next to Admin, not a module, so it can't be moved,
// grouped or permissioned.
export default function BrainPage() {
  const [folders, setFolders] = useState<ContextFolderRow[]>([]);
  const [docs, setDocs] = useState<ContextDocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [mode, setMode] = useState<Mode>("read");
  const [saveState, setSaveState] = useState<SaveState>("saved");

  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingFolder, setDeletingFolder] = useState<ContextFolderRow | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<ContextDocRow | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const readerRef = useRef<HTMLDivElement>(null);
  const report = (err: unknown) => setError(errorMessage(err, "Something went wrong"));

  useEffect(() => {
    Promise.all([getFolders(BRAIN_SECTION), getDocs(BRAIN_SECTION)])
      .then(([f, d]) => {
        setFolders(f);
        setDocs(d);
        const firstFolder = f.slice().sort((a, b) => a.sort_order - b.sort_order)[0];
        const first =
          d.filter((x) => x.folder_id === firstFolder?.id).sort((a, b) => a.sort_order - b.sort_order)[0] ?? d[0];
        if (first) {
          setSelectedId(first.id);
          setDraftTitle(first.title);
          setDraftContent(first.content);
        }
      })
      .catch((err) => setError(errorMessage(err, "Something went wrong")))
      .finally(() => setLoading(false));
  }, []);

  const selected = docs.find((d) => d.id === selectedId) ?? null;
  const sortedFolders = folders.slice().sort((a, b) => a.sort_order - b.sort_order);
  const folderOf = (id: string | null) => folders.find((f) => f.id === id) ?? null;
  const docsIn = (fid: string | null) =>
    docs
      .filter((d) => (d.folder_id ?? null) === fid)
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));

  // ---------- autosave (900 ms after typing stops, and on switching docs) ----------
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
      const updated = await updateDoc(p.id, { title: p.title.trim() || "Untitled", content: p.content });
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
    if (!selected) return;
    pending.current = { id: selected.id, title, content };
    setSaveState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 900);
  }

  useEffect(() => () => void flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function open(doc: ContextDocRow, nextMode: Mode = mode) {
    void flush();
    setSelectedId(doc.id);
    setDraftTitle(doc.title);
    setDraftContent(doc.content);
    setSaveState("saved");
    setMode(nextMode);
    readerRef.current?.scrollTo({ top: 0 });
  }

  // ---------- folders ----------

  async function createStarter() {
    try {
      const fs: ContextFolderRow[] = [];
      const ds: ContextDocRow[] = [];
      for (const [i, f] of BRAIN_STARTER.entries()) {
        const folder = await addFolder(f.name, f.color, i, BRAIN_SECTION);
        fs.push(folder);
        for (const [j, d] of f.docs.entries()) ds.push(await addDoc(folder.id, d.title, d.content, j, BRAIN_SECTION));
      }
      setFolders(fs);
      setDocs(ds);
      if (ds[0]) open(ds[0], "read");
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
      const order = folders.length ? Math.max(...folders.map((f) => f.sort_order)) + 1 : 0;
      const row = await addFolder(name, COLORS[folders.length % COLORS.length], order, BRAIN_SECTION);
      setFolders((prev) => [...prev, row]);
    } catch (err) {
      report(err);
    }
  }

  function saveRename() {
    const id = renaming;
    const name = renameValue.trim();
    setRenaming(null);
    if (!id || !name) return;
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
    updateFolder(id, { name }).catch(report);
  }

  async function confirmDeleteFolder() {
    const folder = deletingFolder;
    setDeletingFolder(null);
    if (!folder) return;
    setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    setDocs((prev) => prev.map((d) => (d.folder_id === folder.id ? { ...d, folder_id: null } : d)));
    try {
      await deleteFolder(folder.id);
    } catch (err) {
      report(err);
    }
  }

  function toggleFolder(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---------- docs ----------

  async function createDoc(folderId: string | null) {
    try {
      const row = await addDoc(folderId, "Untitled", "", docsIn(folderId).length, BRAIN_SECTION);
      setDocs((prev) => [...prev, row]);
      if (folderId) setCollapsed((prev) => new Set([...prev].filter((x) => x !== folderId)));
      open(row, "edit");
    } catch (err) {
      report(err);
    }
  }

  function moveDoc(folderId: string | null) {
    if (!selected) return;
    setDocs((prev) => prev.map((d) => (d.id === selected.id ? { ...d, folder_id: folderId } : d)));
    updateDoc(selected.id, { folder_id: folderId }).catch(report);
  }

  async function confirmDeleteDoc() {
    const doc = deletingDoc;
    setDeletingDoc(null);
    if (!doc) return;
    if (pending.current?.id === doc.id) pending.current = null;
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    if (selectedId === doc.id) setSelectedId(null);
    try {
      await deleteDoc(doc.id);
    } catch (err) {
      report(err);
    }
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  function bundleAll(): string {
    return [...sortedFolders.map((f) => f.id), null]
      .map((fid) => {
        const list = docsIn(fid);
        if (!list.length) return "";
        const name = fid ? folderOf(fid)?.name : "Unfiled";
        return `# ${name}\n\n` + list.map((d) => `## ${d.title}\n\n${d.content.trim()}`).join("\n\n");
      })
      .filter(Boolean)
      .join("\n\n---\n\n");
  }

  // ---------- derived ----------

  const html = useMemo(() => renderMarkdown(draftContent), [draftContent]);
  const outline = useMemo(() => outlineOf(draftContent), [draftContent]);
  const totalWords = docs.reduce((n, d) => n + words(d.content), 0);
  const lastUpdated = docs.reduce<string | null>((a, d) => (!a || d.updated_at > a ? d.updated_at : a), null);
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? docs.filter((d) => d.title.toLowerCase().includes(needle) || d.content.toLowerCase().includes(needle))
    : [];

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-28 rounded-3xl border border-border bg-surface animate-pulse" />
        <div className="h-[560px] rounded-3xl border border-border bg-surface animate-pulse" />
      </div>
    );
  }

  const stats = [
    { label: "Documents", value: docs.length.toLocaleString("en") },
    { label: "Folders", value: folders.length.toLocaleString("en") },
    { label: "Words of context", value: totalWords.toLocaleString("en") },
    { label: "Last updated", value: lastUpdated ? ago(lastUpdated) : "—" },
  ];

  return (
    <div className="space-y-5">
      {/* ===== Header ===== */}
      <header className="relative rounded-3xl border border-border bg-surface overflow-hidden">
        <span className="absolute -top-36 -left-20 w-[420px] h-[420px] rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
            backgroundSize: "18px 18px",
            maskImage: "linear-gradient(90deg, black, transparent 70%)",
          }}
        />
        <div className="relative px-6 sm:px-8 py-6 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 text-white flex items-center justify-center shadow-[0_12px_30px_-12px_rgba(139,92,246,0.9)] shrink-0">
              <Brain className="w-7 h-7" />
            </span>
            <div className="min-w-0">
              <h1 className="text-3xl font-extrabold tracking-[0.08em]">BRAIN</h1>
              <p className="text-sm text-muted mt-0.5">
                The single source of context every AI agent reads through MCP.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 flex-wrap">
            <dl className="flex items-center gap-6">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">{s.label}</dt>
                  <dd className="text-lg font-bold tabular-nums mt-0.5">{s.value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copy("all", bundleAll())}
                disabled={!docs.length}
                className="flex items-center gap-2 h-10 px-3.5 rounded-xl border border-border bg-background/50 text-sm font-semibold text-muted hover:text-foreground hover:border-[#3a3a44] transition-colors disabled:opacity-40"
                title="Copy every doc as one markdown file"
              >
                {copied === "all" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied === "all" ? "Copied" : "Copy all"}
              </button>
              <button
                onClick={() => setConnectOpen(true)}
                className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors"
              >
                <Plug className="w-4 h-4" />
                Connect an agent
              </button>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-300/70 hover:text-red-200 shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {folders.length === 0 && docs.length === 0 ? (
        <EmptyBrain onStarter={createStarter} onBlank={() => setAddingFolder(true)} adding={addingFolder}>
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onBlur={submitFolder}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitFolder();
              if (e.key === "Escape") setAddingFolder(false);
            }}
            placeholder="Folder name, Enter to create"
            className="w-full h-11 px-4 rounded-xl bg-background border border-primary text-sm outline-none"
          />
        </EmptyBrain>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_230px] rounded-3xl border border-border bg-surface overflow-hidden lg:h-[calc(100vh-250px)] lg:min-h-[560px]">
          {/* ===== Sidebar: search + tree ===== */}
          <aside className="flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-border bg-background/30 max-h-[420px] lg:max-h-none">
            <div className="p-3 space-y-2 border-b border-border">
              <label className="flex items-center gap-2 h-10 px-3 rounded-xl bg-background border border-border focus-within:border-primary transition-colors">
                <Search className="w-4 h-4 text-muted shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search titles and content"
                  className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted/70"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="text-muted hover:text-foreground" aria-label="Clear search">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </label>
              <div className="flex gap-1.5">
                <button
                  onClick={() => createDoc(sortedFolders[0]?.id ?? null)}
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold text-muted hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  <FilePlus className="w-3.5 h-3.5" />
                  New doc
                </button>
                <button
                  onClick={() => setAddingFolder(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold text-muted hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  New folder
                </button>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {needle ? (
                <>
                  <p className="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
                    {matches.length} {matches.length === 1 ? "result" : "results"}
                  </p>
                  {matches.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => open(d)}
                      className={`w-full text-left rounded-lg px-2.5 py-2 transition-colors ${
                        d.id === selectedId ? "bg-primary/12" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="block text-sm font-medium truncate">{d.title}</span>
                      <span className="block text-[11px] text-muted truncate">
                        {folderOf(d.folder_id)?.name ?? "Unfiled"} · {snippetAround(d.content, needle, 30)}
                      </span>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {[...sortedFolders, ...(docsIn(null).length ? [null] : [])].map((folder) => {
                    const fid = folder?.id ?? UNFILED;
                    const list = docsIn(folder?.id ?? null);
                    const isOpen = !collapsed.has(fid);
                    const color = folder?.color ?? "#71717a";
                    return (
                      <div key={fid}>
                        {renaming === fid ? (
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={saveRename}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveRename();
                              if (e.key === "Escape") setRenaming(null);
                            }}
                            className="w-full h-8 px-2 rounded-lg bg-background border border-primary text-sm outline-none"
                          />
                        ) : (
                          <div className="group flex items-center rounded-lg hover:bg-white/[0.04]">
                            <button
                              onClick={() => toggleFolder(fid)}
                              className="flex-1 min-w-0 flex items-center gap-1.5 px-1.5 h-8 text-left"
                            >
                              {isOpen ? (
                                <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0" />
                              )}
                              <span style={{ color }}>
                                {isOpen ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                              </span>
                              <span className="text-[13px] font-semibold truncate">{folder?.name ?? "Unfiled"}</span>
                              <span className="ml-auto text-[10.5px] text-muted tabular-nums pr-1">{list.length}</span>
                            </button>
                            {folder && (
                              <div className="hidden group-hover:flex items-center pr-1">
                                <button
                                  onClick={() => createDoc(folder.id)}
                                  className="p-1 rounded text-muted hover:text-foreground"
                                  title="New doc in this folder"
                                >
                                  <FilePlus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setRenaming(folder.id);
                                    setRenameValue(folder.name);
                                  }}
                                  className="p-1 rounded text-muted hover:text-foreground"
                                  title="Rename folder"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeletingFolder(folder)}
                                  className="p-1 rounded text-muted hover:text-red-400"
                                  title="Delete folder"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {isOpen && (
                          <div className="ml-[18px] pl-2 border-l border-border space-y-0.5 py-0.5">
                            {list.length === 0 ? (
                              <p className="px-2 py-1 text-[11.5px] text-muted/70">Empty</p>
                            ) : (
                              list.map((d) => {
                                const active = d.id === selectedId;
                                return (
                                  <button
                                    key={d.id}
                                    onClick={() => open(d)}
                                    className={`w-full flex items-center gap-2 h-8 px-2 rounded-lg text-left text-[13px] transition-colors ${
                                      active
                                        ? "bg-primary/15 text-foreground font-semibold"
                                        : "text-foreground/80 hover:bg-white/[0.04]"
                                    }`}
                                  >
                                    <FileText className={`w-3.5 h-3.5 shrink-0 ${active ? "text-primary-hover" : "text-muted"}`} />
                                    <span className="truncate">{active ? draftTitle || "Untitled" : d.title}</span>
                                  </button>
                                );
                              })
                            )}
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
                      placeholder="Folder name"
                      className="w-full h-8 mt-1 px-2 rounded-lg bg-background border border-primary text-sm outline-none"
                    />
                  )}
                </>
              )}
            </nav>
          </aside>

          {/* ===== Main: reader / editor ===== */}
          <section className="flex flex-col min-h-[520px] lg:min-h-0 min-w-0">
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-10 gap-3">
                <span className="w-12 h-12 rounded-2xl bg-white/5 text-muted flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </span>
                <p className="font-semibold">Pick a document</p>
                <p className="text-sm text-muted max-w-xs">Or create one from the sidebar. Docs are markdown and save themselves.</p>
              </div>
            ) : (
              <>
                <div className="px-6 sm:px-8 pt-5 pb-4 border-b border-border space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <nav className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted min-w-0">
                      <span>Brain</span>
                      <span className="text-muted/50">/</span>
                      <select
                        value={selected.folder_id ?? UNFILED}
                        onChange={(e) => moveDoc(e.target.value === UNFILED ? null : e.target.value)}
                        title="Move to another folder"
                        className="bg-transparent uppercase outline-none hover:text-foreground cursor-pointer max-w-[220px] truncate [color-scheme:dark]"
                      >
                        {sortedFolders.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                        <option value={UNFILED}>Unfiled</option>
                      </select>
                    </nav>

                    <div className="flex items-center gap-1.5">
                      <div className="flex gap-0.5 p-1 rounded-xl bg-background/60 border border-border">
                        {([
                          { key: "read", label: "Read", icon: Eye },
                          { key: "edit", label: "Edit", icon: PenLine },
                          { key: "split", label: "Split", icon: Columns2 },
                        ] as const).map((m) => (
                          <button
                            key={m.key}
                            onClick={() => setMode(m.key)}
                            className={`flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-semibold transition-colors ${
                              mode === m.key ? "bg-surface-hover text-foreground" : "text-muted hover:text-foreground"
                            } ${m.key === "split" ? "hidden md:flex" : ""}`}
                          >
                            <m.icon className="w-3.5 h-3.5" />
                            {m.label}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => copy("doc", `# ${draftTitle}\n\n${draftContent}`)}
                        className="p-2 rounded-xl text-muted hover:text-foreground hover:bg-white/5 transition-colors"
                        title="Copy as markdown"
                      >
                        {copied === "doc" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setDeletingDoc(selected)}
                        className="p-2 rounded-xl text-muted hover:text-red-400 hover:bg-white/5 transition-colors"
                        title="Delete doc"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <input
                    value={draftTitle}
                    onChange={(e) => edit(e.target.value, draftContent)}
                    placeholder="Untitled"
                    className="w-full bg-transparent text-[28px] font-extrabold tracking-tight outline-none placeholder:text-muted/40"
                  />

                  <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      {saveState === "saving" ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" /> Saving…
                        </>
                      ) : saveState === "dirty" ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Unsaved
                        </>
                      ) : (
                        <>
                          <Clock3 className="w-3 h-3" /> Updated {ago(selected.updated_at)}
                        </>
                      )}
                    </span>
                    <span>{words(draftContent).toLocaleString("en")} words</span>
                    <span>{Math.max(1, Math.round(words(draftContent) / 220))} min read</span>
                    <button
                      onClick={() => copy("mcp", `Read the BRAIN doc "${draftTitle}" with the brain tool.`)}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 text-primary-hover font-mono text-[11px] hover:bg-primary/20 transition-colors"
                      title="Copy an instruction an agent can follow to read this doc"
                    >
                      {copied === "mcp" ? <Check className="w-3 h-3" /> : <Plug className="w-3 h-3" />}
                      brain · doc: "{draftTitle || "Untitled"}"
                    </button>
                  </div>
                </div>

                <div className={`flex-1 min-h-0 grid ${mode === "split" ? "md:grid-cols-2" : "grid-cols-1"}`}>
                  {mode !== "read" && (
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
                      placeholder={"# Title\n\n## Section\n- Key point\n\nWrite in markdown."}
                      className={`w-full h-full min-h-[420px] bg-background/40 px-6 sm:px-8 py-5 text-[13.5px] font-mono leading-relaxed outline-none resize-none placeholder:text-muted/40 ${
                        mode === "split" ? "md:border-r border-border" : ""
                      }`}
                    />
                  )}
                  {mode !== "edit" && (
                    <div
                      ref={readerRef}
                      onDoubleClick={() => mode === "read" && setMode("edit")}
                      className={`overflow-y-auto px-6 sm:px-10 py-6 ${mode === "split" ? "hidden md:block" : ""}`}
                      title={mode === "read" ? "Double-click to edit" : undefined}
                    >
                      <article
                        className={`max-w-3xl text-[14.5px] leading-relaxed ${MARKDOWN_CLASS}`}
                        dangerouslySetInnerHTML={{ __html: html }}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* ===== Outline ===== */}
          <aside className="hidden xl:flex flex-col min-h-0 border-l border-border bg-background/30">
            <p className="flex items-center gap-1.5 px-4 pt-5 pb-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
              <ListTree className="w-3.5 h-3.5" />
              On this page
            </p>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {!selected || outline.length === 0 ? (
                <p className="px-2 text-xs text-muted/70">Headings (#, ##, ###) show up here.</p>
              ) : (
                outline.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (mode === "edit") setMode("read");
                      setTimeout(
                        () => document.getElementById(`brain-h-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
                        0
                      );
                    }}
                    className="w-full flex items-start gap-1.5 text-left rounded-md py-1 pr-2 text-[12.5px] text-muted hover:text-foreground hover:bg-white/[0.04] transition-colors"
                    style={{ paddingLeft: 8 + (h.level - 1) * 12 }}
                  >
                    {h.level === 1 && <Hash className="w-3 h-3 mt-0.5 shrink-0 text-primary-hover/70" />}
                    <span className={`line-clamp-2 ${h.level === 1 ? "font-semibold text-foreground/90" : ""}`}>{h.text}</span>
                  </button>
                ))
              )}
            </div>
          </aside>
        </div>
      )}

      {connectOpen && <ConnectModal onClose={() => setConnectOpen(false)} copy={copy} copied={copied} />}

      {deletingFolder && (
        <ConfirmDialog
          title="Delete folder"
          confirmLabel="Delete"
          message={`Delete "${deletingFolder.name}"? Its docs move to "Unfiled".`}
          onConfirm={confirmDeleteFolder}
          onCancel={() => setDeletingFolder(null)}
        />
      )}
      {deletingDoc && (
        <ConfirmDialog
          title="Delete doc"
          confirmLabel="Delete"
          message={`Delete "${deletingDoc.title}"? This can't be undone, and agents will stop seeing it.`}
          onConfirm={confirmDeleteDoc}
          onCancel={() => setDeletingDoc(null)}
        />
      )}
    </div>
  );
}

// ============================================
// EMPTY STATE
// ============================================

function EmptyBrain({
  onStarter,
  onBlank,
  adding,
  children,
}: {
  onStarter: () => void;
  onBlank: () => void;
  adding: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative rounded-3xl border border-border bg-surface overflow-hidden">
      <span className="absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-primary/15 blur-3xl pointer-events-none" />
      <div className="relative px-6 py-16 text-center space-y-5 max-w-lg mx-auto">
        <span className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 text-white flex items-center justify-center">
          <Brain className="w-8 h-8" />
        </span>
        <div className="space-y-2">
          <p className="text-2xl font-extrabold tracking-tight">Your BRAIN is empty</p>
          <p className="text-sm text-muted leading-relaxed">
            Write down everything an agent needs to know once, and every MCP-connected tool reads it from here instead
            of asking you again.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2.5 flex-wrap">
          <button
            onClick={onStarter}
            className="flex items-center gap-2 h-11 px-5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Start with the suggested structure
          </button>
          <button
            onClick={onBlank}
            className="flex items-center gap-2 h-11 px-5 rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            Empty folder
          </button>
        </div>
        {adding && children}
      </div>
    </div>
  );
}

// ============================================
// CONNECT AN AGENT
// ============================================

const AGENT_PROMPT =
  "Before starting, read my BRAIN index with the `brain` tool (no arguments), then open only the docs you need " +
  "for this task with `brain` (doc, folder or search). If you learn something worth keeping, propose saving it " +
  "with `brain_write` and tell me what you changed.";

function ConnectModal({
  onClose,
  copy,
  copied,
}: {
  onClose: () => void;
  copy: (key: string, text: string) => void;
  copied: string | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tools = [
    { name: "brain", args: "", desc: "Index of every folder and doc, with word counts and last update." },
    { name: "brain", args: 'search: "precios"', desc: "Full-text search; returns matching docs with a snippet." },
    { name: "brain", args: 'doc: "AG Software Agency"', desc: "Full content of a doc (exact or partial title)." },
    { name: "brain", args: 'folder: "02 · Negocio"', desc: "Every doc in a folder, full content." },
    { name: "brain", args: "full: true", desc: "The whole BRAIN in one call (use sparingly)." },
    { name: "brain_write", args: 'title, content, folder?, append?', desc: "Create or update a doc (creates the folder if needed)." },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-8" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
              <Plug className="w-3.5 h-3.5" /> MCP
            </p>
            <h2 className="text-2xl font-extrabold tracking-tight mt-1">Connect an agent</h2>
            <p className="text-sm text-muted mt-1">
              Any client with the NEXUS MCP server registered can read BRAIN. Nothing to configure per doc.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-muted hover:bg-surface-hover hover:text-foreground" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <section className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Tools</h3>
            <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
              {tools.map((t, i) => (
                <div key={i} className="px-4 py-3 bg-background/40">
                  <code className="font-mono text-[12.5px]">
                    <span className="text-primary-hover">{t.name}</span>
                    <span className="text-muted">(</span>
                    {t.args}
                    <span className="text-muted">)</span>
                  </code>
                  <p className="text-xs text-muted mt-0.5">{t.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Instruction for any agent</h3>
              <button
                onClick={() => copy("prompt", AGENT_PROMPT)}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground"
              >
                {copied === "prompt" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === "prompt" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="rounded-2xl border border-border bg-background/40 px-4 py-3 text-[13px] leading-relaxed text-foreground/85">
              {AGENT_PROMPT}
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Register the server (once per machine)</h3>
            <div className="relative">
              <pre className="rounded-2xl border border-border bg-background px-4 py-3 text-[12px] font-mono overflow-x-auto">
                claude mcp add --scope user nexus -- node {"<path-to>"}/career-os/mcp-server/index.js
              </pre>
            </div>
            <p className="text-xs text-muted">
              The server signs in with your account (credentials in <code className="font-mono">mcp-server/.env</code>), so
              row-level security still applies.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
