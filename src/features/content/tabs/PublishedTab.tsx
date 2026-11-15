import { useState } from "react";
import { ExternalLink, Send, Trash2 } from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import type { PostMetricKey, PublicationRow } from "../types";
import { POST_METRICS, formatLabel, platformLabel, styleOf, todayISO } from "../types";
import { latestSnapshot } from "../stats";
import FormatIcon from "../components/FormatIcon";
import type { ContentStudio } from "../useContentStudio";

// A number cell that saves on blur. Empty = no data (null), never zero.
function MetricInput({ value, onSave, decimals }: { value: number | null; onSave: (v: number | null) => void; decimals?: boolean }) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  return (
    <input
      inputMode={decimals ? "decimal" : "numeric"}
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(decimals ? /[^\d.]/g : /[^\d]/g, ""))}
      onBlur={() => {
        const next = draft === "" ? null : Number(draft);
        if (next !== value) onSave(next);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      placeholder="—"
      className="w-[72px] h-8 px-2 rounded-lg bg-background/60 border border-transparent hover:border-border focus:border-primary text-right text-sm tabular-nums outline-none placeholder:text-muted/50"
    />
  );
}

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });

// Every publication (piece × platform), newest first, with its latest
// numbers. Editing a cell saves today's snapshot in content_post_metrics
// (the other numbers are carried over), so Stats can see how each post grows.
export default function PublishedTab({
  studio,
  onOpenIdea,
}: {
  studio: ContentStudio;
  onOpenIdea: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState<PublicationRow | null>(null);

  if (!studio.publicationsReady) {
    return (
      <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
        Run BLOQUE 25 of PENDIENTE.sql to start tracking where pieces were posted.
      </p>
    );
  }

  const rows = studio.publications.slice().sort((a, b) => b.published_at.localeCompare(a.published_at));
  const ideaOf = (id: string) => studio.ideas.find((i) => i.id === id);

  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[#33333b] p-12 text-center space-y-3">
        <span className="mx-auto w-12 h-12 rounded-2xl bg-primary/15 text-primary-hover flex items-center justify-center">
          <Send className="w-6 h-6" />
        </span>
        <p className="text-lg font-semibold">Nothing posted yet</p>
        <p className="text-sm text-muted max-w-md mx-auto">
          Use "Mark as posted" in the Finished tab (or in a piece's details) and it shows up here, ready for its numbers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!studio.statsReady && (
        <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          Run BLOQUE 27 of PENDIENTE.sql to save each post's numbers.
        </p>
      )}
      <div className="rounded-3xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead>
              <tr className="border-b border-border bg-background/40 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">
                <th className="px-4 py-3 sticky left-0 bg-[#141418]">Piece</th>
                <th className="px-3 py-3">Platform</th>
                <th className="px-3 py-3">Posted</th>
                {POST_METRICS.map((m) => (
                  <th key={m.key} className="px-2 py-3 text-right whitespace-nowrap">
                    {m.label}
                  </th>
                ))}
                <th className="px-3 py-3">As of</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((pub) => {
                const idea = ideaOf(pub.idea_id);
                const style = idea ? styleOf(idea.style) : null;
                const snap = latestSnapshot(studio, pub.id);
                return (
                  <tr key={pub.id} className="border-b border-border/60 last:border-b-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 max-w-[260px] sticky left-0 bg-surface">
                      <button
                        onClick={() => idea && onOpenIdea(idea.id)}
                        className="block text-left font-semibold truncate max-w-full hover:text-primary-hover"
                        title={idea?.title}
                      >
                        {idea?.title ?? "(deleted piece)"}
                      </button>
                      {idea && (
                        <span className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted">
                          <FormatIcon format={idea.format} className="w-3 h-3" />
                          {formatLabel(idea.format) || "No format"}
                          {style && (
                            <>
                              <span>·</span>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.color }} />
                              {style.label}
                            </>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {pub.url ? (
                        <a href={pub.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:text-primary-hover">
                          {platformLabel(pub.platform)}
                          <ExternalLink className="w-3 h-3 text-muted" />
                        </a>
                      ) : (
                        <span className="font-medium">{platformLabel(pub.platform)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted tabular-nums">{dateLabel(pub.published_at)}</td>
                    {POST_METRICS.map((m) => (
                      <td key={m.key} className="px-1 py-1.5 text-right">
                        <MetricInput
                          key={`${pub.id}-${m.key}-${snap?.[m.key as PostMetricKey] ?? "x"}-${snap?.captured_on ?? ""}`}
                          value={snap ? snap[m.key as PostMetricKey] : null}
                          decimals={m.key === "avg_watch_seconds" || m.key === "full_watch_pct"}
                          onSave={(v) => studio.savePostMetric(pub.id, { [m.key]: v })}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted tabular-nums">
                      {snap ? (snap.captured_on === todayISO() ? "Today" : dateLabel(`${snap.captured_on}T12:00:00`)) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => setDeleting(pub)}
                        className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-white/5"
                        title="Remove this publication"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2.5 border-t border-border text-[11px] text-muted">
          Numbers are entered by hand (or by Claude from a screenshot). Editing a cell saves today's snapshot; empty means
          no data, not zero.
        </p>
      </div>

      {deleting && (
        <ConfirmDialog
          title="Remove publication"
          confirmLabel="Remove"
          message={`Remove the ${platformLabel(deleting.platform)} post of "${ideaOf(deleting.idea_id)?.title ?? "this piece"}" and all its snapshots? If it was its only post, the piece goes back to Finished.`}
          onConfirm={() => {
            studio.removePublication(deleting.id);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
