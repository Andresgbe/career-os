import { CircleCheck } from "lucide-react";
import { isDone } from "../types";
import IdeaCard from "../components/IdeaCard";
import type { ContentStudio } from "../useContentStudio";

// Every finished piece (Guion + Grabado + Editado), most recent first.
// Unticking a step sends it back to the board.
export default function DoneTab({
  studio,
  onOpenIdea,
}: {
  studio: ContentStudio;
  onOpenIdea: (id: string) => void;
}) {
  const doneIdeas = studio.ideas
    .filter(isDone)
    .sort((a, b) =>
      (b.scheduled_date ?? b.updated_at).localeCompare(a.scheduled_date ?? a.updated_at)
    );

  if (doneIdeas.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[#33333b] p-12 text-center space-y-3">
        <span className="mx-auto w-12 h-12 rounded-2xl bg-emerald-400/10 text-emerald-300 flex items-center justify-center">
          <CircleCheck className="w-6 h-6" />
        </span>
        <p className="text-lg font-semibold">Todavía no hay piezas terminadas</p>
        <p className="text-sm text-muted max-w-md mx-auto">
          Una idea llega aquí cuando marcas Guion, Grabado y Editado.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
      {doneIdeas.map((idea) => (
        <IdeaCard
          key={idea.id}
          idea={idea}
          category={studio.categories.find((c) => c.id === idea.category_id)}
          onClick={() => onOpenIdea(idea.id)}
          onToggleStatus={(field, value) => studio.toggleStep(idea.id, field, value)}
        />
      ))}
    </div>
  );
}
