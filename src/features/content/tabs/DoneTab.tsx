import { useEffect, useState } from "react";
import {
  getContentIdeas,
  getCategories,
  updateContentIdea,
  toggleIdeaStatus,
  deleteContentIdea,
} from "../api";
import type { ContentIdeaRow, CategoryRow } from "../types";
import IdeaCard from "../components/IdeaCard";
import IdeaModal from "../components/IdeaModal";

function isDone(idea: ContentIdeaRow) {
  return idea.script_done && idea.recorded && idea.edited;
}

export default function DoneTab() {
  const [ideas, setIdeas] = useState<ContentIdeaRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openIdeaId, setOpenIdeaId] = useState<string | null>(null);

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
  const openIdea = doneIdeas.find((i) => i.id === openIdeaId) || null;

  const handleSaveIdea = async (
    id: string,
    fields: {
      title: string;
      description: string;
      script: string;
      category_id: string | null;
    }
  ) => {
    try {
      const updated = await updateContentIdea(id, fields);
      setIdeas((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating idea");
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

      {loading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : doneIdeas.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <p className="text-muted text-sm">
            No finished content yet. Ideas move here once Guion, Grabado and
            Editado are all checked.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {doneIdeas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              category={categories.find((c) => c.id === idea.category_id)}
              onClick={() => setOpenIdeaId(idea.id)}
              onDelete={() => handleDelete(idea.id)}
              onToggleStatus={(field, value) =>
                handleToggleStatus(idea.id, field, value)
              }
            />
          ))}
        </div>
      )}

      {openIdea && (
        <IdeaModal
          idea={openIdea}
          categories={categories}
          onClose={() => setOpenIdeaId(null)}
          onSave={handleSaveIdea}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
