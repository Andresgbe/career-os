import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  getContentIdeas,
  getCategories,
  addContentIdea,
  updateContentIdea,
  toggleIdeaStatus,
  deleteContentIdea,
} from "../api";
import type {
  ContentIdeaRow,
  CategoryRow,
  Platform,
} from "../types";
import { PLATFORMS } from "../types";
import ContentCard from "../components/ContentCard";

export default function IdeasTab() {
  const [ideas, setIdeas] = useState<ContentIdeaRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  // New entry form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [script, setScript] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([getContentIdeas(), getCategories()])
      .then(([ideas, cats]) => {
        setIdeas(ideas);
        setCategories(cats);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setScript("");
    setPlatforms([]);
    setCategoryIds([]);
  };

  const handleAdd = async () => {
    if (!title.trim()) {
      setError("Enter a title for the idea.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const row = await addContentIdea({
        title: title.trim(),
        description: description.trim(),
        script,
        platforms,
        category_ids: categoryIds,
      });
      setIdeas((prev) => [row, ...prev]);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving idea");
    } finally {
      setAdding(false);
    }
  };

  const handleToggleStatus = async (
    id: string,
    field: "script_done" | "recorded" | "edited",
    value: boolean
  ) => {
    try {
      const updated = await toggleIdeaStatus(id, field, value);
      setIdeas((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating status");
    }
  };

  const handleUpdate = async (
    id: string,
    fields: {
      title: string;
      description: string;
      script: string;
      platforms: Platform[];
      category_ids: string[];
    }
  ) => {
    try {
      const updated = await updateContentIdea(id, fields);
      setIdeas((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating idea");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteContentIdea(id);
      setIdeas((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting idea");
    }
  };

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const toggleCategory = (catId: string) => {
    setCategoryIds((prev) =>
      prev.includes(catId)
        ? prev.filter((x) => x !== catId)
        : [...prev, catId]
    );
  };

  return (
    <div className="space-y-6">
      {/* New entry */}
      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-4">New Entry</h2>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        <div className="grid grid-cols-1 gap-4 mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Title</label>
            <input
              type="text"
              placeholder='e.g. "Comparando IAs"'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">
              Description (optional)
            </label>
            <textarea
              rows={2}
              placeholder="Brief idea description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none resize-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Guion / Script (optional)</label>
            <textarea
              rows={5}
              placeholder="Write the script for this content..."
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none resize-y font-mono"
            />
          </div>
        </div>

        {/* Platforms */}
        <div className="flex flex-col gap-2 mb-4">
          <label className="text-xs text-muted">Platforms</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => {
              const selected = platforms.includes(p.value);
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePlatform(p.value)}
                  className={`text-xs font-medium px-3 py-1.5 rounded transition-all ${
                    selected
                      ? "ring-2 ring-offset-1 ring-offset-background"
                      : "opacity-40 hover:opacity-70"
                  }`}
                  style={{
                    backgroundColor: p.color,
                    color: p.textColor,
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            <label className="text-xs text-muted">Categories</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const selected = categoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                      selected
                        ? "ring-2 ring-offset-1 ring-offset-background"
                        : "opacity-40 hover:opacity-70"
                    }`}
                    style={{
                      backgroundColor: cat.color + "30",
                      color: cat.color,
                    }}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={handleAdd}
          disabled={adding}
          className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {adding ? "Adding..." : "Add idea"}
        </button>
      </section>

      {/* Ideas list */}
      <section className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : ideas.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-8 text-center">
            <p className="text-muted text-sm">No content ideas yet. Add your first idea above!</p>
          </div>
        ) : (
          ideas.map((idea) => (
            <ContentCard
              key={idea.id}
              idea={idea}
              categories={categories}
              onToggleStatus={handleToggleStatus}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))
        )}
      </section>
    </div>
  );
}
