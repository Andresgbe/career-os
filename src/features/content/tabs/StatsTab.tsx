import { BarChart3 } from "lucide-react";
import type { MetricKey } from "../types";
import { average, formatLabel, platformLabel, styleOf } from "../types";
import { groupAverages, topPieces } from "../stats";
import type { GroupStat } from "../stats";
import type { ContentStudio } from "../useContentStudio";

// One measure per chart, one hue (the app's primary): no legend needed, the
// title names the measure and every bar carries its value as text.
const BAR = "var(--color-primary)";

function GroupChart({ title, groups, unit }: { title: string; groups: GroupStat[]; unit: string }) {
  const max = Math.max(1, ...groups.map((g) => g.avg ?? 0));
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {groups.length === 0 ? (
        <p className="text-xs text-muted">No posts yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {groups.map((g) => (
            <li
              key={g.key || "none"}
              className="group grid grid-cols-[96px_1fr_auto] items-center gap-3 rounded-lg -mx-1.5 px-1.5 py-1 hover:bg-white/[0.03]"
              title={`${g.label}: ${g.avg === null ? "no data yet" : `${Math.round(g.avg).toLocaleString("en")} ${unit} on average`} · ${g.withData} of ${g.posts} posts with data`}
            >
              <span className="text-xs text-muted truncate">{g.label}</span>
              <span className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                {g.avg !== null && (
                  <span
                    className="block h-full rounded-full transition-[width]"
                    style={{ width: `${Math.max(2, (g.avg / max) * 100)}%`, backgroundColor: BAR }}
                  />
                )}
              </span>
              <span className="text-xs tabular-nums text-right min-w-[88px]">
                {g.avg === null ? (
                  <span className="text-muted">no data</span>
                ) : (
                  <>
                    <span className="font-semibold text-foreground">{Math.round(g.avg).toLocaleString("en")}</span>
                    <span className="text-muted"> · {g.withData}</span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function StatsTab({
  studio,
  onOpenIdea,
}: {
  studio: ContentStudio;
  onOpenIdea: (id: string) => void;
}) {
  const { publications: pubs, ideas } = studio;

  if (!studio.publicationsReady) {
    return (
      <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
        Run BLOQUE 25 of PENDIENTE.sql to see stats.
      </p>
    );
  }

  const withViews = pubs.filter((p) => typeof p.views === "number").length;
  if (pubs.length === 0 || withViews === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[#33333b] p-12 text-center space-y-3">
        <span className="mx-auto w-12 h-12 rounded-2xl bg-primary/15 text-primary-hover flex items-center justify-center">
          <BarChart3 className="w-6 h-6" />
        </span>
        <p className="text-lg font-semibold">No numbers yet</p>
        <p className="text-sm text-muted max-w-md mx-auto">
          {pubs.length === 0
            ? "Mark pieces as posted, then fill in their views and saves in the Published tab."
            : "Fill in views and saves in the Published tab and the comparison shows up here."}
        </p>
      </div>
    );
  }

  const fmt = (n: number | null) => (n === null ? "—" : Math.round(n).toLocaleString("en"));
  const tiles: { label: string; value: string; hint: string }[] = [
    { label: "Posts tracked", value: pubs.length.toLocaleString("en"), hint: `${new Set(pubs.map((p) => p.idea_id)).size} pieces` },
    { label: "Avg views / post", value: fmt(average(pubs, "views")), hint: `${withViews} posts with data` },
    { label: "Avg saves / post", value: fmt(average(pubs, "saves")), hint: `${pubs.filter((p) => p.saves !== null).length} posts with data` },
    { label: "Avg likes / post", value: fmt(average(pubs, "likes")), hint: `${pubs.filter((p) => p.likes !== null).length} posts with data` },
  ];
  const chart = (by: "format" | "style", metric: MetricKey) => groupAverages(pubs, ideas, by, metric);
  const top = topPieces(pubs, ideas, 10);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-border bg-surface px-4 py-4">
            <p className="text-[12.5px] text-muted">{t.label}</p>
            <p className="text-[28px] font-extrabold tabular-nums leading-none tracking-tight mt-2">{t.value}</p>
            <p className="text-xs text-muted mt-1.5">{t.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <GroupChart title="Average views per post · by format" groups={chart("format", "views")} unit="views" />
        <GroupChart title="Average views per post · by style" groups={chart("style", "views")} unit="views" />
        <GroupChart title="Average saves per post · by format" groups={chart("format", "saves")} unit="saves" />
        <GroupChart title="Average saves per post · by style" groups={chart("style", "saves")} unit="saves" />
      </div>
      <p className="text-[11px] text-muted -mt-2">
        The small number after each value is how many posts it's based on. Empty metric cells are left out, not counted
        as zero.
      </p>

      <section className="rounded-2xl border border-border bg-surface overflow-hidden">
        <h3 className="px-4 pt-4 pb-3 text-sm font-semibold">Top {top.length} pieces by views (all platforms)</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-y border-border bg-background/40 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">
                <th className="px-4 py-2.5 w-10">#</th>
                <th className="px-3 py-2.5">Piece</th>
                <th className="px-3 py-2.5">Format · style</th>
                <th className="px-3 py-2.5">Platforms</th>
                <th className="px-3 py-2.5 text-right">Views</th>
                <th className="px-4 py-2.5 text-right">Saves</th>
              </tr>
            </thead>
            <tbody>
              {top.map((t, i) => (
                <tr key={t.idea.id} className="border-b border-border/60 last:border-b-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 text-muted tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2.5 max-w-[320px]">
                    <button onClick={() => onOpenIdea(t.idea.id)} className="block truncate text-left font-medium hover:text-primary-hover">
                      {t.idea.title}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-muted whitespace-nowrap">
                    {[formatLabel(t.idea.format), styleOf(t.idea.style)?.label].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-muted whitespace-nowrap">{[...new Set(t.platforms)].map(platformLabel).join(", ")}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{t.views.toLocaleString("en")}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{t.saves.toLocaleString("en")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
