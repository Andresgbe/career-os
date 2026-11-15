import type { ContentIdeaRow, MetricKey, PublicationRow } from "./types";
import { average, formatLabel, styleOf } from "./types";

export interface GroupStat {
  key: string;
  label: string;
  posts: number; // publications in the group
  withData: number; // of those, how many have the metric filled in
  avg: number | null;
}

// Average of a metric per format or per style, over publications that have
// the number filled in. Groups without any data are kept (avg null) so the
// UI can say "no data yet" instead of hiding them.
export function groupAverages(
  pubs: PublicationRow[],
  ideas: ContentIdeaRow[],
  by: "format" | "style",
  metric: MetricKey
): GroupStat[] {
  const ideaOf = new Map(ideas.map((i) => [i.id, i]));
  const groups = new Map<string, PublicationRow[]>();
  for (const p of pubs) {
    const idea = ideaOf.get(p.idea_id);
    if (!idea) continue;
    const key = by === "format" ? idea.format : idea.style;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.entries()]
    .map(([key, rows]) => ({
      key,
      label:
        by === "format"
          ? formatLabel(key) || "No format"
          : styleOf(key)?.label ?? "No style",
      posts: rows.length,
      withData: rows.filter((r) => typeof r[metric] === "number").length,
      avg: average(rows, metric),
    }))
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
}

export interface PieceTotal {
  idea: ContentIdeaRow;
  platforms: string[];
  views: number;
  saves: number;
}

// Totals per piece across all its platforms, best first by views
export function topPieces(pubs: PublicationRow[], ideas: ContentIdeaRow[], limit = 10): PieceTotal[] {
  const totals = new Map<string, PieceTotal>();
  for (const p of pubs) {
    const idea = ideas.find((i) => i.id === p.idea_id);
    if (!idea) continue;
    const t = totals.get(idea.id) ?? { idea, platforms: [], views: 0, saves: 0 };
    t.platforms.push(p.platform);
    t.views += p.views ?? 0;
    t.saves += p.saves ?? 0;
    totals.set(idea.id, t);
  }
  return [...totals.values()]
    .filter((t) => t.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

const fmt = (n: number | null) => (n === null ? "sin datos" : Math.round(n).toLocaleString("es"));

// Plain-text summary for the "Plan with AI" prompt
export function metricsSummary(pubs: PublicationRow[], ideas: ContentIdeaRow[]): string {
  const withViews = pubs.filter((p) => typeof p.views === "number");
  if (!withViews.length) return "";
  const lines = ["Metrics so far (averages per post, entered by hand):"];
  for (const by of ["format", "style"] as const) {
    const groups = groupAverages(pubs, ideas, by, "views").filter((g) => g.avg !== null);
    const saves = new Map(groupAverages(pubs, ideas, by, "saves").map((g) => [g.key, g.avg]));
    if (groups.length) {
      lines.push(
        `- By ${by}: ` +
          groups.map((g) => `${g.label} ${fmt(g.avg)} views / ${fmt(saves.get(g.key) ?? null)} saves (${g.withData} posts)`).join("; ")
      );
    }
  }
  const top = topPieces(pubs, ideas, 3);
  if (top.length) lines.push(`- Top pieces: ${top.map((t) => `"${t.idea.title}" (${t.views.toLocaleString("es")} views)`).join(", ")}`);
  return lines.join("\n");
}
