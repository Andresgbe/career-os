import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { isDone } from "../types";
import IdeaCard from "../components/IdeaCard";
import PieceFilters from "../components/PieceFilters";
import { NO_FILTER, isFiltering, matchesFilter } from "../components/pieceFilter";
import type { PieceFilter } from "../components/pieceFilter";
import type { ContentStudio } from "../useContentStudio";

// Finished pieces (Script + Recorded + Edited) that haven't been posted yet,
// most recent first. "Mark as posted" moves one to the Published tab;
// unticking a step sends it back to the board. Do-not-publish pieces are
// left out.
export default function DoneTab({
  studio,
  onOpenIdea,
  onMarkPosted,
}: {
  studio: ContentStudio;
  onOpenIdea: (id: string) => void;
  onMarkPosted: (id: string) => void;
}) {
  const [filter, setFilter] = useState<PieceFilter>(NO_FILTER);
  const pending = studio.ideas
    .filter((i) => isDone(i) && !i.do_not_publish && !studio.publishedIds.has(i.id))
    .sort((a, b) => (b.scheduled_date ?? b.updated_at).localeCompare(a.scheduled_date ?? a.updated_at));
  const shown = pending.filter((i) => matchesFilter(i, filter));

  if (pending.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[#33333b] p-12 text-center space-y-3">
        <span className="mx-auto w-12 h-12 rounded-2xl bg-emerald-400/10 text-emerald-300 flex items-center justify-center">
          <CircleCheck className="w-6 h-6" />
        </span>
        <p className="text-lg font-semibold">Nothing waiting to be posted</p>
        <p className="text-sm text-muted max-w-md mx-auto">
          A piece lands here once Script, Recorded and Edited are all checked, and moves to Published when you mark it as
          posted.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!studio.publicationsReady && (
        <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          Run BLOQUE 25 of PENDIENTE.sql to start marking pieces as posted.
        </p>
      )}
      <PieceFilters value={filter} onChange={setFilter} count={isFiltering(filter) ? shown.length : undefined} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {shown.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            category={studio.categories.find((c) => c.id === idea.category_id)}
            onClick={() => onOpenIdea(idea.id)}
            onToggleStatus={(field, value) => studio.toggleStep(idea.id, field, value)}
            onMarkPosted={studio.publicationsReady ? () => onMarkPosted(idea.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
