import { useEffect, useState } from "react";
import {
  getContentIdeas,
  getCategories,
  updateContentIdea,
  toggleIdeaStatus,
  deleteContentIdea,
} from "../api";
import type { ContentIdeaRow, CategoryRow, Platform } from "../types";
import ContentCard from "../components/ContentCard";

function isDone(idea: ContentIdeaRow) {
  return idea.script_done && idea.recorded && idea.edited;
}

export default function DoneTab() {
  const [ideas, setIdeas] = useState<ContentIdeaRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getContentIdeas(), getCategories()])
      .then(([ideas, cats]) => {
        setIdeas(ideas);
        setCategories(cats);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const doneIdeas = ideas.filter(isDone);

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

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : doneIdeas.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-8 text-center">
            <p className="text-muted text-sm">
              No finished content yet. Ideas move here once Guion, Grabado
              and Editado are all checked.
            </p>
          </div>
        ) : (
          doneIdeas.map((idea) => (
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
