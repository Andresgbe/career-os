import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  Plus,
  Sparkles,
  Check,
  Copy,
  CalendarDays,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import type { ContentIdeaRow, ContentWeekRow, IdeaFields, WeekStatus } from "../types";
import {
  WEEK_STATUSES,
  isDone,
  shiftWeek,
  toISODate,
  todayISO,
  weekDays,
  weekKeyOf,
  weekKeyOfISO,
  weekNumber,
  weekRangeLabel,
  dayShort,
  monthShort,
} from "../types";
import WeekCard from "../components/WeekCard";
import PieceCard from "../components/PieceCard";
import type { ContentStudio } from "../useContentStudio";

const BANK = "bank";
const DAY = "day:";
const STRIP_SIZE = 8;

interface PlannerTabProps {
  studio: ContentStudio;
  selectedWeek: string;
  onSelectWeek: (key: string) => void;
  onOpenIdea: (id: string) => void;
  onNewIdea: (defaults: Partial<IdeaFields>) => void;
}

const byDayOrder = (a: ContentIdeaRow, b: ContentIdeaRow) =>
  a.schedule_order - b.schedule_order || a.created_at.localeCompare(b.created_at);

// Weekly content planner: a strip of ISO weeks on top, and the selected
// week below as seven day columns you drag pieces into from the idea bank.
export default function PlannerTab({
  studio,
  selectedWeek,
  onSelectWeek,
  onOpenIdea,
  onNewIdea,
}: PlannerTabProps) {
  const { ideas, weeks, categories } = studio;
  const today = todayISO();
  const currentWeek = weekKeyOf(new Date());

  // The strip shows STRIP_SIZE weeks starting one before the selected one
  const [stripStart, setStripStart] = useState(() => shiftWeek(selectedWeek, -1));
  const stripWeeks = Array.from({ length: STRIP_SIZE }, (_, i) => shiftWeek(stripStart, i));
  if (!stripWeeks.includes(selectedWeek)) {
    // Selected from outside (e.g. "Planificar semana") — bring it into view
    setStripStart(shiftWeek(selectedWeek, -1));
  }

  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-week="${selectedWeek}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [selectedWeek, stripStart]);

  const scheduled = ideas.filter((i) => i.scheduled_date);
  const piecesOfWeek = (key: string) =>
    scheduled
      .filter((i) => weekKeyOfISO(i.scheduled_date!) === key)
      .sort((a, b) => a.scheduled_date!.localeCompare(b.scheduled_date!) || byDayOrder(a, b));
  const weekRow = (key: string) => weeks.find((w) => w.week_key === key);

  const days = weekDays(selectedWeek).map(toISODate);
  const piecesOn = (date: string) => ideas.filter((i) => i.scheduled_date === date).sort(byDayOrder);
  const bank = ideas
    .filter((i) => !i.scheduled_date && !isDone(i))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const selectedPieces = piecesOfWeek(selectedWeek);
  const selectedDone = selectedPieces.filter(isDone).length;
  const week = weekRow(selectedWeek);
  const categoryOf = (id: string | null) => categories.find((c) => c.id === id);

  // A finished piece can move between days but not back to the bank, which
  // only holds ideas still in production
  const [draggingDone, setDraggingDone] = useState(false);

  function handleDragEnd(result: DropResult) {
    setDraggingDone(false);
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    // The bank is sorted by date added, there's no manual order to keep
    if (source.droppableId === BANK && destination.droppableId === BANK) return;

    const dateOf = (id: string) => (id === BANK ? null : id.slice(DAY.length));
    const listOf = (id: string) => (id === BANK ? bank.slice() : piecesOn(id.slice(DAY.length)));

    const moved = ideas.find((i) => i.id === draggableId);
    if (!moved) return;
    const destDate = dateOf(destination.droppableId);

    const sourceList = listOf(source.droppableId).filter((i) => i.id !== moved.id);
    const sameList = source.droppableId === destination.droppableId;
    const destList = sameList ? sourceList : listOf(destination.droppableId);
    destList.splice(destination.index, 0, { ...moved, scheduled_date: destDate });

    const updates: { id: string; scheduled_date: string | null; schedule_order: number }[] = [];
    const pushDay = (list: ContentIdeaRow[], date: string) =>
      list.forEach((i, idx) => updates.push({ id: i.id, scheduled_date: date, schedule_order: idx }));

    if (destDate) pushDay(destList, destDate);
    else updates.push({ id: moved.id, scheduled_date: null, schedule_order: 0 });
    const srcDate = dateOf(source.droppableId);
    if (!sameList && srcDate) pushDay(sourceList, srcDate);

    studio.applySchedule(updates);
  }

  return (
    <div className="space-y-6">
      {/* ===== Week strip ===== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            {STRIP_SIZE} semanas · planificación
          </h2>
          <div className="flex items-center gap-1.5">
            {selectedWeek !== currentWeek && (
              <button
                onClick={() => onSelectWeek(currentWeek)}
                className="h-9 px-3 rounded-xl border border-border bg-surface text-xs font-semibold text-muted hover:text-foreground hover:border-[#3a3a44] transition-colors"
              >
                Semana actual
              </button>
            )}
            <button
              onClick={() => setStripStart((s) => shiftWeek(s, -4))}
              className="w-9 h-9 rounded-xl border border-border bg-surface flex items-center justify-center text-muted hover:text-foreground hover:border-[#3a3a44] transition-colors"
              aria-label="Semanas anteriores"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setStripStart((s) => shiftWeek(s, 4))}
              className="w-9 h-9 rounded-xl border border-border bg-surface flex items-center justify-center text-muted hover:text-foreground hover:border-[#3a3a44] transition-colors"
              aria-label="Semanas siguientes"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={stripRef}
          className="flex gap-3.5 overflow-x-auto snap-x pb-3 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {stripWeeks.map((key) => (
            <WeekCard
              key={key}
              weekKey={key}
              week={weekRow(key)}
              pieces={piecesOfWeek(key)}
              categories={categories}
              isCurrent={key === currentWeek}
              isPast={key < currentWeek}
              selected={key === selectedWeek}
              onSelect={() => onSelectWeek(key)}
            />
          ))}
        </div>
      </section>

      {/* ===== Selected week ===== */}
      <section className="relative rounded-3xl border border-border bg-surface overflow-hidden">
        <span className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <span className="absolute -bottom-40 right-0 w-96 h-96 rounded-full bg-fuchsia-500/10 blur-3xl pointer-events-none" />

        <div className="relative p-5 sm:p-7 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="space-y-2 min-w-0">
              <p className="font-mono text-xs tracking-wider text-primary-hover">
                {selectedWeek}
                {selectedWeek === currentWeek && " · SEMANA ACTUAL"}
              </p>
              <h2 className="text-[28px] sm:text-4xl font-extrabold tracking-tight leading-[1.05]">
                Semana {weekNumber(selectedWeek)}{" "}
                <span className="text-muted font-bold">— {weekRangeLabel(selectedWeek)}</span>
              </h2>
              <div className="flex items-center gap-3 pt-1">
                <div className="w-44 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all"
                    style={{ width: `${selectedPieces.length ? (selectedDone / selectedPieces.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm text-muted tabular-nums">
                  <span className="text-foreground font-semibold">{selectedDone}</span> de {selectedPieces.length} piezas listas
                </span>
              </div>
            </div>

            <div className="flex gap-1 p-1 rounded-2xl bg-background/60 border border-border self-start lg:self-auto">
              {WEEK_STATUSES.map((s) => {
                const active = (week?.status ?? "draft") === s.key && !!week;
                return (
                  <button
                    key={s.key}
                    onClick={() => studio.saveWeek(selectedWeek, { status: s.key as WeekStatus })}
                    className={`px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
                      active
                        ? s.key === "approved"
                          ? "bg-emerald-400/15 text-emerald-300"
                          : s.key === "done"
                          ? "bg-primary/20 text-primary-hover"
                          : "bg-surface-hover text-foreground"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <WeekBrief key={selectedWeek} weekKey={selectedWeek} week={week} studio={studio} />

          <DragDropContext
            onDragStart={(start) => {
              const idea = ideas.find((i) => i.id === start.draggableId);
              setDraggingDone(!!idea && isDone(idea));
            }}
            onDragEnd={handleDragEnd}
          >
            {/* Days */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
              {days.map((date) => {
                const d = new Date(`${date}T00:00:00`);
                const isToday = date === today;
                const isPastDay = date < today;
                const list = piecesOn(date);
                return (
                  <div
                    key={date}
                    className={`flex flex-col rounded-2xl border p-2.5 min-h-[200px] transition-colors ${
                      isToday
                        ? "border-primary/60 bg-primary/[0.06]"
                        : "border-border bg-background/50"
                    } ${isPastDay && !isToday ? "opacity-75" : ""}`}
                  >
                    <div className="flex items-start justify-between px-1 pb-2.5">
                      <div>
                        <p className={`text-[10.5px] font-bold uppercase tracking-[0.14em] ${isToday ? "text-primary-hover" : "text-muted"}`}>
                          {dayShort(d)}
                        </p>
                        <p className="flex items-baseline gap-1">
                          <span className="text-2xl font-extrabold tabular-nums leading-none">{d.getDate()}</span>
                          <span className="text-xs text-muted">{monthShort(d)}</span>
                        </p>
                      </div>
                      {isToday ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-primary text-white text-[9.5px] font-bold tracking-wider">HOY</span>
                      ) : (
                        list.length > 0 && (
                          <span className="text-[11px] text-muted tabular-nums">{list.length}</span>
                        )
                      )}
                    </div>

                    <Droppable droppableId={`${DAY}${date}`}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 flex flex-col gap-2 rounded-xl min-h-[60px] transition-colors ${
                            snapshot.isDraggingOver ? "bg-primary/10 outline outline-1 outline-dashed outline-primary/50" : ""
                          }`}
                        >
                          {list.map((idea, index) => (
                            <Draggable key={idea.id} draggableId={idea.id} index={index}>
                              {(drag, dragSnap) => (
                                <div
                                  ref={drag.innerRef}
                                  {...drag.draggableProps}
                                  {...drag.dragHandleProps}
                                  className={dragSnap.isDragging ? "shadow-2xl rotate-[1.5deg]" : ""}
                                >
                                  <PieceCard
                                    idea={idea}
                                    category={categoryOf(idea.category_id)}
                                    onClick={() => onOpenIdea(idea.id)}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>

                    <button
                      onClick={() => onNewIdea({ scheduled_date: date })}
                      className="mt-2 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs text-muted hover:text-foreground hover:bg-white/5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Pieza
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Idea bank */}
            <div className="rounded-2xl border border-border bg-background/40 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-muted">
                    <Inbox className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">
                      Banco de ideas <span className="text-muted font-normal tabular-nums">· {bank.length}</span>
                    </p>
                    <p className="text-xs text-muted">Arrastra una idea a un día para programarla, o devuélvela aquí.</p>
                  </div>
                </div>
                <button
                  onClick={() => onNewIdea({})}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border text-xs font-semibold text-muted hover:text-foreground hover:border-[#3a3a44] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nueva idea
                </button>
              </div>

              <Droppable droppableId={BANK} direction="horizontal" isDropDisabled={draggingDone}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex gap-2.5 overflow-x-auto pb-2 min-h-[96px] rounded-xl transition-colors ${
                      snapshot.isDraggingOver ? "bg-primary/10" : ""
                    }`}
                  >
                    {bank.map((idea, index) => (
                      <Draggable key={idea.id} draggableId={idea.id} index={index}>
                        {(drag) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            {...drag.dragHandleProps}
                            className="w-[210px] shrink-0"
                          >
                            <PieceCard
                              idea={idea}
                              category={categoryOf(idea.category_id)}
                              onClick={() => onOpenIdea(idea.id)}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {bank.length === 0 && (
                      <p className="self-center text-sm text-muted px-2">
                        El banco está vacío: todas tus ideas en producción ya tienen fecha.
                      </p>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          </DragDropContext>
        </div>
      </section>
    </div>
  );
}

// ===== Brief of the week (theme + goal) and the hand-off to Claude =====

function WeekBrief({
  weekKey,
  week,
  studio,
}: {
  weekKey: string;
  week?: ContentWeekRow;
  studio: ContentStudio;
}) {
  const [title, setTitle] = useState(week?.title ?? "");
  const [goal, setGoal] = useState(week?.goal ?? "");
  const [copied, setCopied] = useState(false);

  function save(fields: { title?: string; goal?: string }) {
    const changed =
      (fields.title !== undefined && fields.title !== (week?.title ?? "")) ||
      (fields.goal !== undefined && fields.goal !== (week?.goal ?? ""));
    if (changed) studio.saveWeek(weekKey, fields);
  }

  // Claude plans the week through the NEXUS MCP server (get_content_week /
  // plan_content_week). This copies a ready-to-paste instruction for it.
  async function copyPrompt() {
    const lines = [`Planea mi semana de contenido ${weekKey} (${weekRangeLabel(weekKey)}) en NEXUS.`];
    if (title.trim()) lines.push(`Tema de la semana: ${title.trim()}`);
    if (goal.trim()) lines.push(`Brief:\n${goal.trim()}`);
    lines.push(
      "",
      "Primero lee mi contexto de contenido con get_content_context (voz, audiencia, pilares, aprendizajes). " +
        `Luego usa get_content_week con week_key "${weekKey}" para ver lo que ya está programado y el banco de ideas. ` +
        "Después usa plan_content_week para programar las piezas día por día (con hook, formato, descripción y guion), " +
        "reutilizando ideas del banco cuando encajen. Déjala en estado borrador para que yo la apruebe."
    );
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked — nothing else to do */
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_1.4fr_auto] gap-3">
      <div className="rounded-2xl border border-border bg-background/50 p-3.5 space-y-1.5">
        <label className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">Tema de la semana</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => save({ title: title.trim() })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          placeholder="Ej. Semana de lanzamiento"
          className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-muted/50"
        />
      </div>
      <div className="rounded-2xl border border-border bg-background/50 p-3.5 space-y-1.5">
        <label className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">
          <Sparkles className="w-3 h-3 text-primary-hover" />
          Brief · objetivo, audiencia, ángulo
        </label>
        <textarea
          rows={2}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onBlur={() => save({ goal })}
          placeholder="Qué quieres lograr esta semana. Esto es lo que lee la IA para planear."
          className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-muted/50 leading-relaxed"
        />
      </div>
      <button
        onClick={copyPrompt}
        className="group relative flex lg:flex-col items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-semibold text-white overflow-hidden bg-gradient-to-br from-primary to-fuchsia-500 hover:brightness-110 transition-all lg:w-44"
        title="Copia una instrucción para pegar en Claude (usa las herramientas de NEXUS)"
      >
        {copied ? <Check className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        <span className="text-center leading-tight">
          {copied ? "Prompt copiado" : "Planear con IA"}
        </span>
        <span className="hidden lg:flex items-center gap-1 text-[10.5px] font-medium text-white/75">
          {copied ? <CalendarDays className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "pégalo en Claude" : "copia el prompt"}
        </span>
      </button>
    </div>
  );
}
