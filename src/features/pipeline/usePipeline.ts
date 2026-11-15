import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../../lib/errors";
import {
  getStages,
  addStage,
  updateStage,
  deleteStage,
  getDeals,
  addDeal,
  updateDeal,
  deleteDeal,
  getActivity,
  logActivity,
  getIdeaOptions,
} from "./api";
import type { DealFields } from "./api";
import type { ActivityRow, DealRow, DealStatus, StageRow } from "./types";

// One store for the Pipeline page. Every change that matters to the
// follow-up (stage moves, contacts, won/lost) is also written to
// pipeline_activity, the same log agents write to over MCP.
export function usePipeline() {
  const [stages, setStages] = useState<StageRow[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [ideaOptions, setIdeaOptions] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const report = useCallback((err: unknown) => setError(errorMessage(err, "Something went wrong")), []);

  useEffect(() => {
    Promise.all([getStages(), getDeals(), getActivity()])
      .then(([s, d, a]) => {
        setStages(s);
        setDeals(d);
        setActivity(a);
      })
      .catch(report)
      .finally(() => setLoading(false));
    getIdeaOptions().then(setIdeaOptions).catch(() => {});
  }, [report]);

  async function log(dealId: string, kind: string, body: string) {
    try {
      const row = await logActivity(dealId, kind, body);
      setActivity((prev) => [row, ...prev]);
    } catch (err) {
      report(err);
    }
  }

  const stageName = (id: string | null) => stages.find((s) => s.id === id)?.name ?? "—";

  // ---------- deals ----------

  async function createDeal(fields: DealFields & { name: string }) {
    const stageId = fields.stage_id ?? stages[0]?.id ?? null;
    try {
      const row = await addDeal({
        ...fields,
        stage_id: stageId,
        sort_order: deals.filter((d) => d.stage_id === stageId).length,
        last_activity_at: fields.last_activity_at ?? new Date().toISOString(),
      });
      setDeals((prev) => [...prev, row]);
      log(row.id, "created", `Created in ${stageName(stageId)}`);
      return row;
    } catch (err) {
      report(err);
      return null;
    }
  }

  async function saveDeal(id: string, fields: DealFields) {
    const before = deals.find((d) => d.id === id);
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, ...fields } : d)));
    try {
      const updated = await updateDeal(id, fields);
      setDeals((prev) => prev.map((d) => (d.id === id ? updated : d)));
      if (before && fields.stage_id !== undefined && fields.stage_id !== before.stage_id) {
        log(id, "stage", `${stageName(before.stage_id)} → ${stageName(fields.stage_id)}`);
      }
      if (before && fields.note !== undefined && fields.note !== before.note && fields.note.trim()) {
        log(id, "note", fields.note.trim());
      }
    } catch (err) {
      report(err);
    }
  }

  // Board drag: new stage + order for every touched card. Moving a deal to
  // another stage counts as movement, so its clock restarts.
  function applyBoardOrder(
    updates: { id: string; stage_id: string | null; sort_order: number }[],
    movedId: string,
    fromStage: string | null
  ) {
    const now = new Date().toISOString();
    const moved = updates.find((u) => u.id === movedId);
    const changedStage = moved && moved.stage_id !== fromStage;
    setDeals((prev) =>
      prev.map((d) => {
        const u = updates.find((x) => x.id === d.id);
        if (!u) return d;
        return { ...d, stage_id: u.stage_id, sort_order: u.sort_order, ...(changedStage && d.id === movedId ? { last_activity_at: now } : {}) };
      })
    );
    Promise.all(
      updates.map((u) =>
        updateDeal(u.id, {
          stage_id: u.stage_id,
          sort_order: u.sort_order,
          ...(changedStage && u.id === movedId ? { last_activity_at: now } : {}),
        })
      )
    ).catch(report);
    if (changedStage && moved) log(movedId, "stage", `${stageName(fromStage)} → ${stageName(moved.stage_id)}`);
  }

  // "I followed up": the clock restarts, the proposed message is used up
  async function markContacted(deal: DealRow, message: string) {
    await saveDeal(deal.id, { last_activity_at: new Date().toISOString(), suggested_message: "" });
    log(deal.id, "contacted", message.trim() || "Followed up");
  }

  async function setStatus(deal: DealRow, status: DealStatus) {
    await saveDeal(deal.id, { status });
    log(deal.id, status === "open" ? "edited" : status, status === "open" ? "Reopened" : status === "won" ? "Won 🎉" : "Lost");
  }

  async function removeDeal(id: string) {
    setDeals((prev) => prev.filter((d) => d.id !== id));
    setActivity((prev) => prev.filter((a) => a.deal_id !== id));
    try {
      await deleteDeal(id);
    } catch (err) {
      report(err);
    }
  }

  // ---------- stages ----------

  async function createStage(fields: Omit<StageRow, "id" | "sort_order">) {
    try {
      const sort_order = stages.length ? Math.max(...stages.map((s) => s.sort_order)) + 1 : 0;
      const row = await addStage({ ...fields, sort_order });
      setStages((prev) => [...prev, row]);
    } catch (err) {
      report(err);
    }
  }

  function editStage(id: string, fields: Partial<Omit<StageRow, "id">>) {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...fields } : s)));
    updateStage(id, fields).catch(report);
  }

  async function removeStage(id: string) {
    // Its deals fall back to the first remaining stage
    const fallback = stages.find((s) => s.id !== id)?.id ?? null;
    const orphans = deals.filter((d) => d.stage_id === id);
    setStages((prev) => prev.filter((s) => s.id !== id));
    setDeals((prev) => prev.map((d) => (d.stage_id === id ? { ...d, stage_id: fallback } : d)));
    try {
      await Promise.all(orphans.map((d) => updateDeal(d.id, { stage_id: fallback })));
      await deleteStage(id);
    } catch (err) {
      report(err);
    }
  }

  return {
    stages: stages.slice().sort((a, b) => a.sort_order - b.sort_order),
    deals,
    activity,
    ideaOptions,
    loading,
    error,
    clearError: () => setError(""),
    createDeal,
    saveDeal,
    applyBoardOrder,
    markContacted,
    setStatus,
    removeDeal,
    createStage,
    editStage,
    removeStage,
  };
}

export type Pipeline = ReturnType<typeof usePipeline>;
