import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../lib/errors";
import {
  getCategories,
  getContentIdeas,
  getContentWeeks,
  addContentIdea,
  updateContentIdea,
  deleteContentIdea,
  reorderContentIdeas,
  rescheduleContentIdeas,
  addCategory,
  updateCategory,
  deleteCategory,
  upsertContentWeek,
  getPublications,
  addPublications,
  getPostMetrics,
  upsertPostMetric,
  getAccountDaily,
  upsertAccountDay,
  getActiveTimes,
  getPeriodTotals,
  upsertPeriodTotal,
  getContentLeads,
  createContentLead,
  deletePublication,
} from "./api";
import type {
  CategoryRow,
  ContentIdeaRow,
  ContentWeekRow,
  IdeaFields,
  PublicationRow,
  PostMetricRow,
  AccountDailyRow,
  ActiveTimeRow,
  ContentLead,
  PeriodTotalRow,
  StepKey,
  WeekStatus,
} from "./types";
import { POST_METRICS, todayISO } from "./types";

export const CATEGORY_COLORS = [
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#3b82f6",
  "#f97316",
];

// One store for the whole Content page: the hero stats, the planner, the
// board and the published grid all read and write the same ideas, so a piece
// ticked as "Editado" in the planner is instantly right everywhere else.
export function useContentStudio() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [ideas, setIdeas] = useState<ContentIdeaRow[]>([]);
  const [weeks, setWeeks] = useState<ContentWeekRow[]>([]);
  const [publications, setPublications] = useState<PublicationRow[]>([]);
  // false until content_publications exists (BLOQUE 25 of PENDIENTE.sql)
  const [publicationsReady, setPublicationsReady] = useState(true);
  // Analytics (BLOQUE 27) and content leads (BLOQUE 26). Each flag goes false
  // when its tables don't exist yet, and the Stats tab says what to run.
  const [postMetrics, setPostMetrics] = useState<PostMetricRow[]>([]);
  const [accountDaily, setAccountDaily] = useState<AccountDailyRow[]>([]);
  const [activeTimes, setActiveTimes] = useState<ActiveTimeRow[]>([]);
  const [leads, setLeads] = useState<ContentLead[]>([]);
  // false until content_period_totals exists (BLOQUE 28)
  const [periodTotals, setPeriodTotals] = useState<PeriodTotalRow[]>([]);
  const [periodTotalsReady, setPeriodTotalsReady] = useState(true);
  const [statsReady, setStatsReady] = useState(true);
  const [leadsReady, setLeadsReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const report = useCallback((err: unknown) => {
    setError(errorMessage(err));
  }, []);

  useEffect(() => {
    Promise.all([
      getCategories(),
      getContentIdeas(),
      // Weekly plans are optional: the board still works if the table
      // hasn't been created yet, the error just tells you to run the SQL.
      getContentWeeks().catch((err) => {
        report(err);
        return [] as ContentWeekRow[];
      }),
      // Missing table = feature not set up yet; the Published / Stats tabs
      // say so instead of a red banner on every page load
      getPublications().catch(() => {
        setPublicationsReady(false);
        return [] as PublicationRow[];
      }),
      Promise.all([getPostMetrics(), getAccountDaily(), getActiveTimes()]).catch(() => {
        setStatsReady(false);
        return [[], [], []] as [PostMetricRow[], AccountDailyRow[], ActiveTimeRow[]];
      }),
      getContentLeads().catch(() => {
        setLeadsReady(false);
        return [] as ContentLead[];
      }),
      getPeriodTotals().catch(() => {
        setPeriodTotalsReady(false);
        return [] as PeriodTotalRow[];
      }),
    ])
      .then(([cats, allIdeas, allWeeks, pubs, [pm, ad, at], ls, pt]) => {
        setPeriodTotals(pt);
        setPublications(pubs);
        setPostMetrics(pm);
        setAccountDaily(ad);
        setActiveTimes(at);
        setLeads(ls);
        setCategories(cats);
        setIdeas(allIdeas);
        setWeeks(allWeeks);
      })
      .catch(report)
      .finally(() => setLoading(false));
  }, [report]);

  // ---------- ideas ----------

  async function createIdea(fields: Partial<IdeaFields> & { title: string }) {
    const categoryId = fields.category_id ?? null;
    const sortOrder = ideas.filter((i) => i.category_id === categoryId).length;
    const scheduleOrder = fields.scheduled_date
      ? ideas.filter((i) => i.scheduled_date === fields.scheduled_date).length
      : 0;
    try {
      const row = await addContentIdea({
        ...fields,
        category_id: categoryId,
        sort_order: sortOrder,
        schedule_order: scheduleOrder,
      });
      setIdeas((prev) => [...prev, row]);
      return row;
    } catch (err) {
      report(err);
      return null;
    }
  }

  async function saveIdea(id: string, fields: Partial<IdeaFields>) {
    // Optimistic, then replaced by what the database returns
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...fields } : i)));
    try {
      const updated = await updateContentIdea(id, fields);
      setIdeas((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch (err) {
      report(err);
    }
  }

  function toggleStep(id: string, field: StepKey, value: boolean) {
    return saveIdea(id, { [field]: value });
  }

  async function removeIdea(id: string) {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    try {
      await deleteContentIdea(id);
    } catch (err) {
      report(err);
    }
  }

  // Board drag-and-drop: new category + position for every touched card
  function applyBoardOrder(
    updates: { id: string; category_id: string | null; sort_order: number }[]
  ) {
    const byId = new Map(updates.map((u) => [u.id, u]));
    setIdeas((prev) =>
      prev.map((i) => {
        const u = byId.get(i.id);
        return u ? { ...i, category_id: u.category_id, sort_order: u.sort_order } : i;
      })
    );
    reorderContentIdeas(updates).catch(report);
  }

  // Planner drag-and-drop: new day + position for every touched piece
  function applySchedule(
    updates: { id: string; scheduled_date: string | null; schedule_order: number }[]
  ) {
    const byId = new Map(updates.map((u) => [u.id, u]));
    setIdeas((prev) =>
      prev.map((i) => {
        const u = byId.get(i.id);
        return u
          ? { ...i, scheduled_date: u.scheduled_date, schedule_order: u.schedule_order }
          : i;
      })
    );
    rescheduleContentIdeas(updates).catch(report);
  }

  // ---------- categories ----------

  async function createCategory(name: string, color?: string) {
    const sortOrder = categories.length
      ? Math.max(...categories.map((c) => c.sort_order)) + 1
      : 0;
    const pick = color ?? CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length];
    try {
      const row = await addCategory(name, pick, sortOrder);
      setCategories((prev) => [...prev, row]);
    } catch (err) {
      report(err);
    }
  }

  function editCategory(
    id: string,
    fields: Partial<{ name: string; color: string; collapsed: boolean; sort_order: number }>
  ) {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...fields } : c)));
    updateCategory(id, fields).catch(report);
  }

  // Its ideas fall back to "Sin categoría", appended after the ones there
  async function removeCategory(id: string) {
    const orphaned = ideas.filter((i) => i.category_id === id);
    const base = ideas.filter((i) => i.category_id === null).length;
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setIdeas((prev) =>
      prev.map((i) => {
        const idx = orphaned.findIndex((o) => o.id === i.id);
        return idx === -1 ? i : { ...i, category_id: null, sort_order: base + idx };
      })
    );
    try {
      if (orphaned.length) {
        await reorderContentIdeas(
          orphaned.map((i, idx) => ({ id: i.id, category_id: null, sort_order: base + idx }))
        );
      }
      await deleteCategory(id);
    } catch (err) {
      report(err);
    }
  }

  // ---------- weeks ----------

  async function saveWeek(
    weekKey: string,
    fields: Partial<{ title: string; goal: string; notes: string; status: WeekStatus }>
  ) {
    setWeeks((prev) => {
      const existing = prev.find((w) => w.week_key === weekKey);
      if (existing) {
        return prev.map((w) => (w.week_key === weekKey ? { ...w, ...fields } : w));
      }
      const now = new Date().toISOString();
      return [
        ...prev,
        {
          id: `pending-${weekKey}`,
          week_key: weekKey,
          title: "",
          goal: "",
          notes: "",
          status: "draft",
          created_at: now,
          updated_at: now,
          ...fields,
        },
      ];
    });
    try {
      const row = await upsertContentWeek(weekKey, fields);
      setWeeks((prev) => prev.map((w) => (w.week_key === weekKey ? row : w)));
    } catch (err) {
      report(err);
    }
  }

  // ---------- publications ----------

  async function markPosted(
    ideaId: string,
    entries: { platform: string; published_at: string; url: string }[]
  ) {
    try {
      const rows = await addPublications(ideaId, entries);
      setPublications((prev) => [...rows, ...prev]);
    } catch (err) {
      report(err);
    }
  }

  // ---------- analytics ----------

  // Today's snapshot of a publication. Fields not being edited are carried
  // over from its latest snapshot, so every snapshot is a complete picture.
  async function savePostMetric(
    publicationId: string,
    fields: Partial<Omit<PostMetricRow, "id" | "publication_id" | "captured_on" | "updated_at">>,
    capturedOn = todayISO()
  ) {
    const latest = postMetrics
      .filter((m) => m.publication_id === publicationId && m.captured_on <= capturedOn)
      .sort((a, b) => b.captured_on.localeCompare(a.captured_on))[0];
    const carried = latest
      ? Object.fromEntries(
          POST_METRICS.map((m) => [m.key, latest[m.key]]).filter(([, v]) => v !== null)
        )
      : {};
    try {
      const row = await upsertPostMetric(publicationId, capturedOn, { ...carried, ...fields });
      setPostMetrics((prev) => [
        ...prev.filter((m) => !(m.publication_id === publicationId && m.captured_on === capturedOn)),
        row,
      ]);
    } catch (err) {
      report(err);
    }
  }

  async function saveAccountDay(
    platform: string,
    day: string,
    fields: Partial<Omit<AccountDailyRow, "id" | "platform" | "day" | "updated_at">>
  ) {
    try {
      const row = await upsertAccountDay(platform, day, fields);
      setAccountDaily((prev) => [...prev.filter((r) => !(r.platform === platform && r.day === day)), row]);
      return true;
    } catch (err) {
      report(err);
      return false;
    }
  }

  async function savePeriodTotal(
    platform: string,
    fromDay: string,
    toDay: string,
    fields: Partial<Omit<PeriodTotalRow, "id" | "platform" | "from_day" | "to_day" | "updated_at">>
  ) {
    try {
      const row = await upsertPeriodTotal(platform, fromDay, toDay, fields);
      setPeriodTotals((prev) => [
        ...prev.filter((r) => !(r.platform === platform && r.from_day === fromDay && r.to_day === toDay)),
        row,
      ]);
      return true;
    } catch (err) {
      report(err);
      return false;
    }
  }

  async function addLead(fields: { name: string; source: string; source_idea_id: string | null; contact: string; note: string }) {
    try {
      const row = await createContentLead(fields);
      setLeads((prev) => [...prev, row]);
      return true;
    } catch (err) {
      report(err);
      return false;
    }
  }

  function removePublication(id: string) {
    setPublications((prev) => prev.filter((p) => p.id !== id));
    setPostMetrics((prev) => prev.filter((m) => m.publication_id !== id));
    deletePublication(id).catch(report);
  }

  const publishedIds = new Set(publications.map((p) => p.idea_id));

  return {
    categories,
    ideas,
    weeks,
    publications,
    publicationsReady,
    publishedIds,
    markPosted,
    removePublication,
    postMetrics,
    accountDaily,
    activeTimes,
    leads,
    periodTotals,
    periodTotalsReady,
    savePeriodTotal,
    statsReady,
    leadsReady,
    savePostMetric,
    saveAccountDay,
    addLead,
    loading,
    error,
    clearError: () => setError(""),
    createIdea,
    saveIdea,
    toggleStep,
    removeIdea,
    applyBoardOrder,
    applySchedule,
    createCategory,
    editCategory,
    removeCategory,
    saveWeek,
  };
}

export type ContentStudio = ReturnType<typeof useContentStudio>;
