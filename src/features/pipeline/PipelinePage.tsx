import { useState } from "react";
import { Plus, Radar, Settings2, Trophy, CircleX, ChevronDown, ChevronRight } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { usePipeline } from "./usePipeline";
import type { DealRow } from "./types";
import { daysSince, healthOf } from "./types";
import DealCard from "./components/DealCard";
import GuardianPanel from "./components/GuardianPanel";
import DealModal from "./components/DealModal";
import StagesModal from "./components/StagesModal";

type Modal = { id: string } | { stageId: string | null } | null;

const PROTOCOL = [
  ["Review", "Every deal, every time you open it"],
  ["Compare", "Days in the stage vs. its rule"],
  ["Alert", "Only what needs attention"],
  ["Propose", "The next message to send"],
  ["You approve", "Nothing goes out without you"],
];

// Client follow-up: deals move through stages, each stage has a rule (max
// days without movement) and the guardian flags whatever is going cold and
// proposes the follow-up. Agents read and edit it over MCP
// (pipeline_review / pipeline_update).
export default function PipelinePage() {
  const pipeline = usePipeline();
  const { stages, deals, loading, error } = pipeline;
  const [modal, setModal] = useState<Modal>(null);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [closedOpen, setClosedOpen] = useState(false);

  const open = deals.filter((d) => d.status === "open");
  const closed = deals.filter((d) => d.status !== "open").sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const stageOf = (d: DealRow) => stages.find((s) => s.id === d.stage_id);
  const overBy = (d: DealRow) => daysSince(d.last_activity_at) - (stageOf(d)?.max_days ?? 0);

  const attention = open.filter((d) => healthOf(d, stageOf(d)) === "attention").sort((a, b) => overBy(b) - overBy(a));
  const watch = open.filter((d) => healthOf(d, stageOf(d)) === "watch");
  const selected = open.find((d) => d.id === selectedId) ?? null;
  const focus = selected ?? attention[0] ?? null;
  const queue = attention.filter((d) => d.id !== focus?.id);

  const pipelineValue = open.reduce((n, d) => n + (d.currency === "USD" && d.value ? d.value : 0), 0);

  function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const inStage = (id: string) => open.filter((d) => d.stage_id === id).sort((a, b) => a.sort_order - b.sort_order);
    const moved = open.find((d) => d.id === draggableId);
    if (!moved) return;
    const src = inStage(source.droppableId).filter((d) => d.id !== moved.id);
    const same = source.droppableId === destination.droppableId;
    const dst = same ? src : inStage(destination.droppableId);
    dst.splice(destination.index, 0, { ...moved, stage_id: destination.droppableId });
    const lists = same ? [dst] : [src, dst];
    const updates = lists.flatMap((list) => list.map((d, i) => ({ id: d.id, stage_id: d.stage_id, sort_order: i })));
    pipeline.applyBoardOrder(updates, moved.id, moved.stage_id);
    setSelectedId(moved.id);
  }

  const modalDeal = modal && "id" in modal ? deals.find((d) => d.id === modal.id) ?? null : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted">
            <Radar className="w-3.5 h-3.5 text-primary-hover" />
            Client follow-up
          </p>
          <h1 className="text-[34px] sm:text-[42px] font-extrabold tracking-tight leading-none mt-2">
            The pipeline{" "}
            <span className="px-2 rounded-lg bg-primary text-white">guardian</span>
          </h1>
          <p className="text-sm text-muted mt-2">Watches every stage against its rule and warns you before a deal goes cold.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStagesOpen(true)}
            className="flex items-center gap-2 h-11 px-4 rounded-xl border border-border bg-surface text-sm font-semibold text-muted hover:text-foreground hover:border-[#3a3a44]"
          >
            <Settings2 className="w-4 h-4" />
            Stages & rules
          </button>
          <button
            onClick={() => setModal({ stageId: stages[0]?.id ?? null })}
            disabled={!stages.length}
            className="flex items-center gap-2 h-11 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            New deal
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span>{error}</span>
          <button onClick={pipeline.clearError} className="text-red-300/70 hover:text-red-200 shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Needs attention", value: attention.length, tone: "text-red-300" },
          { label: "Watch", value: watch.length, tone: "text-amber-300" },
          { label: "Open deals", value: open.length, tone: "text-foreground" },
          { label: "Open value (USD)", value: `$${pipelineValue.toLocaleString("en")}`, tone: "text-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-surface px-4 py-3.5">
            <p className="text-[12.5px] text-muted">{s.label}</p>
            <p className={`text-[26px] font-extrabold tabular-nums leading-none mt-2 ${s.tone}`}>{loading ? "–" : s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
        {/* Board */}
        <section className="rounded-3xl border border-border bg-surface p-4 space-y-3 min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted px-1">Your open deals</p>
          {!loading && stages.length === 0 ? (
            <p className="px-1 py-8 text-sm text-muted text-center">
              No stages yet. Run BLOQUE 26 of PENDIENTE.sql (it creates the default stages), or add them in "Stages & rules".
            </p>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="overflow-x-auto pb-1">
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: `repeat(${Math.max(1, stages.length)}, minmax(220px, 1fr))` }}
                >
                  {stages.map((stage) => {
                    const items = open.filter((d) => d.stage_id === stage.id).sort((a, b) => a.sort_order - b.sort_order);
                    return (
                      <div key={stage.id} className="flex flex-col gap-2 min-w-0">
                        <div className="rounded-xl border border-border bg-background/50 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold truncate">{stage.name}</span>
                            <span className="min-w-6 px-1.5 py-0.5 rounded-md bg-white/5 text-[11px] font-bold tabular-nums text-center">
                              {items.length}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted mt-0.5 truncate" title={stage.rule}>
                            Alert if: {stage.rule || `more than ${stage.max_days} days without movement`}
                          </p>
                        </div>
                        <Droppable droppableId={stage.id}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`flex flex-col gap-2 min-h-[120px] rounded-xl transition-colors ${
                                snapshot.isDraggingOver ? "bg-primary/10" : ""
                              }`}
                            >
                              {items.map((deal, index) => (
                                <Draggable key={deal.id} draggableId={deal.id} index={index}>
                                  {(drag) => (
                                    <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps}>
                                      <DealCard
                                        deal={deal}
                                        stage={stage}
                                        selected={focus?.id === deal.id}
                                        onClick={() => (focus?.id === deal.id ? setModal({ id: deal.id }) : setSelectedId(deal.id))}
                                      />
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                              <button
                                onClick={() => setModal({ stageId: stage.id })}
                                className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-xs text-muted hover:text-foreground hover:bg-white/5"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add deal
                              </button>
                            </div>
                          )}
                        </Droppable>
                      </div>
                    );
                  })}
                </div>
              </div>
            </DragDropContext>
          )}
          <p className="text-[11px] text-muted px-1">Click a card to review it with the guardian; click it again to edit. Moving a deal to another stage restarts its clock.</p>
        </section>

        <GuardianPanel pipeline={pipeline} focus={focus} queue={queue} onFocus={setSelectedId} />
      </div>

      {/* Protocol */}
      <section className="rounded-2xl border border-border bg-background/60 px-4 py-3.5">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted mb-2.5">The guardian's protocol</p>
        <ol className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {PROTOCOL.map(([title, desc], i) => (
            <li key={title} className="flex items-start gap-2.5">
              <span className="w-6 h-6 shrink-0 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-muted">{desc}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Closed deals */}
      {closed.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface">
          <button onClick={() => setClosedOpen((v) => !v)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold">
            {closedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Closed deals
            <span className="text-muted font-normal">· {closed.filter((d) => d.status === "won").length} won · {closed.filter((d) => d.status === "lost").length} lost</span>
          </button>
          {closedOpen && (
            <ul className="border-t border-border divide-y divide-border">
              {closed.map((d) => (
                <li key={d.id}>
                  <button onClick={() => setModal({ id: d.id })} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.03]">
                    {d.status === "won" ? <Trophy className="w-4 h-4 text-emerald-300" /> : <CircleX className="w-4 h-4 text-muted" />}
                    <span className="flex-1 text-sm truncate">{d.name}</span>
                    {d.value !== null && <span className="text-xs text-muted tabular-nums">{d.currency} {d.value.toLocaleString("en")}</span>}
                    <span className="text-xs text-muted">{new Date(d.updated_at).toLocaleDateString("en", { month: "short", day: "numeric" })}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {modal && ("stageId" in modal || modalDeal) && (
        <DealModal
          key={"id" in modal ? modal.id : "new"}
          deal={modalDeal}
          defaultStageId={"stageId" in modal ? modal.stageId : undefined}
          ideaOptions={pipeline.ideaOptions}
          stages={stages}
          activity={pipeline.activity}
          onClose={() => setModal(null)}
          onSave={(fields) => {
            if (modalDeal) pipeline.saveDeal(modalDeal.id, fields);
            else pipeline.createDeal({ ...fields, stage_id: fields.stage_id ?? ("stageId" in modal ? modal.stageId : null) });
          }}
          onStatus={modalDeal ? (s) => pipeline.setStatus(modalDeal, s) : undefined}
          onDelete={modalDeal ? () => pipeline.removeDeal(modalDeal.id) : undefined}
        />
      )}
      {stagesOpen && <StagesModal pipeline={pipeline} onClose={() => setStagesOpen(false)} />}
    </div>
  );
}
