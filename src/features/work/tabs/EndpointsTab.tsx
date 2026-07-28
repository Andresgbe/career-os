import { useEffect, useState } from "react";
import { Plus, X, Pencil, Trash2, Save, Search, Link2 } from "lucide-react";
import {
  getEndpoints,
  saveEndpoint,
  deleteEndpoint,
  getWorkProjects,
  uploadWorkImage,
} from "../api";
import type {
  EndpointRow,
  EndpointHeader,
  GeneralInfoTableData,
  WorkProjectRow,
} from "../types";
import { HTTP_METHODS } from "../types";
import ConfirmDialog from "../../../components/ConfirmDialog";
import RichTextEditor, { RICH_CONTENT_CLASS } from "../../../components/RichTextEditor";
import CodeBlock from "../../../components/CodeBlock";
import TableBlock from "../../../components/TableBlock";

interface EndpointForm {
  title: string;
  method: string;
  route: string;
  base_url: string;
  headers: EndpointHeader[];
  project_ids: string[];
  details: string;
  code: string;
  table: GeneralInfoTableData | null;
}

const emptyForm: EndpointForm = {
  title: "",
  method: "GET",
  route: "",
  base_url: "",
  headers: [],
  project_ids: [],
  details: "",
  code: "",
  table: null,
};

const METHOD_COLORS: Record<string, string> = {
  GET: "text-blue-400 bg-blue-400/10",
  POST: "text-emerald-400 bg-emerald-400/10",
  PUT: "text-amber-400 bg-amber-400/10",
  PATCH: "text-purple-400 bg-purple-400/10",
  DELETE: "text-red-400 bg-red-400/10",
};

function isRichContentEmpty(html: string): boolean {
  if (!html) return true;
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  if (tmp.querySelector("img")) return false;
  return !tmp.textContent?.trim();
}

function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || "";
}

export default function EndpointsTab() {
  const [endpoints, setEndpoints] = useState<EndpointRow[]>([]);
  const [projects, setProjects] = useState<WorkProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<EndpointForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<EndpointRow | null>(null);

  useEffect(() => {
    Promise.all([getEndpoints(), getWorkProjects()])
      .then(([eps, projs]) => {
        setEndpoints(eps);
        setProjects(projs);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const startAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (entry: EndpointRow) => {
    setForm({
      title: entry.title,
      method: entry.method,
      route: entry.route,
      base_url: entry.base_url,
      headers: entry.headers.map((h) => ({ ...h })),
      project_ids: [...entry.project_ids],
      details: entry.details,
      code: entry.code,
      table: entry.table_data,
    });
    setEditingId(entry.id);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const setHeader = (index: number, fields: Partial<EndpointHeader>) => {
    const headers = [...form.headers];
    headers[index] = { ...headers[index], ...fields };
    setForm({ ...form, headers });
  };

  const addHeader = () =>
    setForm({ ...form, headers: [...form.headers, { key: "", value: "" }] });

  const removeHeader = (index: number) =>
    setForm({ ...form, headers: form.headers.filter((_, i) => i !== index) });

  const toggleProject = (id: string) =>
    setForm((prev) => ({
      ...prev,
      project_ids: prev.project_ids.includes(id)
        ? prev.project_ids.filter((p) => p !== id)
        : [...prev.project_ids, id],
    }));

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await saveEndpoint(
        {
          title: form.title.trim(),
          method: form.method.trim(),
          route: form.route.trim(),
          base_url: form.base_url.trim(),
          headers: form.headers
            .map((h) => ({ key: h.key.trim(), value: h.value.trim() }))
            .filter((h) => h.key || h.value),
          project_ids: form.project_ids,
          details: form.details,
          code: form.code,
          table_data: form.table,
        },
        editingId
      );
      setEndpoints((prev) =>
        editingId
          ? prev.map((e) => (e.id === editingId ? saved : e))
          : [...prev, saved]
      );
      cancelForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving endpoint");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteEndpoint(toDelete.id);
      setEndpoints((prev) => prev.filter((e) => e.id !== toDelete.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setToDelete(null);
    }
  };

  const projectName = (id: string) =>
    projects.find((p) => p.id === id)?.name ?? "";

  const filtered = endpoints.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      e.title,
      e.method,
      e.route,
      e.base_url,
      stripHtml(e.details),
      ...e.headers.flatMap((h) => [h.key, h.value]),
      ...e.project_ids.map(projectName),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  if (loading) return <p className="text-sm text-muted">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Endpoints</h2>
        {!showForm && (
          <button
            onClick={startAdd}
            className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add endpoint
          </button>
        )}
      </div>

      {!showForm && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search by title, route, header, project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface border border-border rounded px-3 py-2 pl-9 text-sm focus:border-primary outline-none"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {showForm && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Title *</label>
            <input
              type="text"
              placeholder="e.g. Send OTP bank"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              className="bg-background border border-border rounded px-2 py-2 text-sm focus:border-primary outline-none shrink-0"
            >
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="/collection_management_client_payment/send-otp-bank"
              value={form.route}
              onChange={(e) => setForm({ ...form, route: e.target.value })}
              className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm font-mono focus:border-primary outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Base URL / full link (optional)</label>
            <input
              type="text"
              placeholder="http://10.200.121.104:8442/swagger/#/..."
              value={form.base_url}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              className="bg-background border border-border rounded px-3 py-2 text-sm font-mono focus:border-primary outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted">Headers (optional)</label>
            {form.headers.map((header, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Header (e.g. Authorization)"
                  value={header.key}
                  onChange={(e) => setHeader(index, { key: e.target.value })}
                  className="w-44 bg-background border border-border rounded px-3 py-2 text-sm font-mono focus:border-primary outline-none shrink-0"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={header.value}
                  onChange={(e) => setHeader(index, { value: e.target.value })}
                  className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm font-mono focus:border-primary outline-none"
                />
                <button
                  onClick={() => removeHeader(index)}
                  className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400 shrink-0"
                  title="Remove header"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={addHeader}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline w-fit"
            >
              <Plus className="w-3.5 h-3.5" />
              Add header
            </button>
          </div>

          {projects.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-muted">Associated projects</label>
              <div className="flex flex-wrap gap-2">
                {projects.map((project) => {
                  const selected = form.project_ids.includes(project.id);
                  return (
                    <button
                      key={project.id}
                      onClick={() => toggleProject(project.id)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                        selected
                          ? "bg-primary/20 border-primary text-primary"
                          : "border-border text-muted hover:text-foreground hover:bg-surface-hover"
                      }`}
                    >
                      {project.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Details</label>
            <RichTextEditor
              value={form.details}
              onChange={(html) => setForm({ ...form, details: html })}
              uploadImage={uploadWorkImage}
              placeholder="Auth notes, request/response shape, quirks, images..."
            />
          </div>

          <CodeBlock
            value={form.code}
            onChange={(code) => setForm({ ...form, code })}
            placeholder="Paste a request/response body example..."
          />

          <TableBlock
            value={form.table}
            onChange={(table) => setForm({ ...form, table })}
          />

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

      {filtered.length === 0 && !showForm ? (
        <p className="text-sm text-muted">
          {endpoints.length === 0
            ? "No endpoints yet."
            : "No endpoints match your search."}
        </p>
      ) : (
        !showForm && (
          <ul className="space-y-3">
            {filtered.map((entry) => (
              <li
                key={entry.id}
                className="bg-surface border border-border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{entry.title}</span>
                      {entry.project_ids.map((id) => (
                        <span
                          key={id}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-hover text-muted"
                        >
                          {projectName(id)}
                        </span>
                      ))}
                    </div>
                    {(entry.method || entry.route) && (
                      <div className="flex items-center gap-2 mt-1.5">
                        {entry.method && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                              METHOD_COLORS[entry.method] ?? "text-muted bg-surface-hover"
                            }`}
                          >
                            {entry.method}
                          </span>
                        )}
                        {entry.route && (
                          <span className="text-xs font-mono text-muted truncate">
                            {entry.route}
                          </span>
                        )}
                      </div>
                    )}
                    {entry.base_url && (
                      <a
                        href={entry.base_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline mt-1 break-all"
                      >
                        <Link2 className="w-3 h-3 shrink-0" />
                        {entry.base_url}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(entry)}
                      className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary"
                      title="Edit"
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

                {entry.headers.length > 0 && (
                  <ul className="space-y-1">
                    {entry.headers.map((header, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-2 text-xs font-mono text-muted bg-background border border-border rounded px-2 py-1"
                      >
                        <span className="text-foreground">{header.key}:</span>
                        <span className="truncate">{header.value}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {!isRichContentEmpty(entry.details) && (
                  <div
                    className={`text-sm text-muted bg-background border border-border rounded px-3 py-2 ${RICH_CONTENT_CLASS}`}
                    dangerouslySetInnerHTML={{ __html: entry.details }}
                  />
                )}

                <CodeBlock value={entry.code} />
                <TableBlock value={entry.table_data} />
              </li>
            ))}
          </ul>
        )
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete endpoint?"
          message={`"${toDelete.title}" will be permanently deleted.`}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
