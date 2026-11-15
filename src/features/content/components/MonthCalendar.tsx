import { Plus, Check } from "lucide-react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import type { CategoryRow, ContentIdeaRow } from "../types";
import {
  DAYS_SHORT,
  isDone,
  monthGrid,
  monthKeyOf,
  toISODate,
  weekKeyOf,
  weekNumber,
} from "../types";
import FormatIcon from "./FormatIcon";
import { NO_CATEGORY_COLOR } from "./visuals";

// Cells show this many pieces before collapsing the rest into "+N more"
const MAX_CHIPS = 3;

interface MonthCalendarProps {
  monthKey: string; // 'YYYY-MM'
  today: string; // 'YYYY-MM-DD'
  piecesOn: (date: string) => ContentIdeaRow[];
  categories: CategoryRow[];
  droppablePrefix: string; // must match the planner's drag handler ("day:")
  onOpenIdea: (id: string) => void;
  onNewIdea: (date: string) => void;
  onOpenWeek: (weekKey: string) => void;
}

// Google-Calendar-style month: Monday-first rows with the ISO week number on
// the left, each day a drop target holding its pieces as compact chips.
// Rendered inside the planner's DragDropContext, so pieces drag between days
// and to/from the idea bank exactly like in the week view.
export default function MonthCalendar({
  monthKey,
  today,
  piecesOn,
  categories,
  droppablePrefix,
  onOpenIdea,
  onNewIdea,
  onOpenWeek,
}: MonthCalendarProps) {
  const rows = monthGrid(monthKey);
  const colorOf = (id: string | null) => categories.find((c) => c.id === id)?.color ?? NO_CATEGORY_COLOR;

  return (
    <div className="rounded-3xl border border-border bg-surface overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          {/* Weekday header */}
          <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-border bg-background/40">
            <div />
            {DAYS_SHORT.map((d, i) => (
              <div
                key={d}
                className={`px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] ${
                  i >= 5 ? "text-muted/70" : "text-muted"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {rows.map((row) => {
            const weekKey = weekKeyOf(row[0]);
            return (
              <div
                key={weekKey}
                className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-border last:border-b-0"
              >
                <button
                  onClick={() => onOpenWeek(weekKey)}
                  title={`Open ${weekNumber(weekKey)} in the week view`}
                  className="flex justify-center pt-3 text-[11px] font-mono text-primary-hover/70 hover:text-primary-hover hover:bg-primary/5 transition-colors"
                >
                  {weekNumber(weekKey)}
                </button>

                {row.map((day) => {
                  const date = toISODate(day);
                  const inMonth = monthKeyOf(day) === monthKey;
                  const isToday = date === today;
                  const list = piecesOn(date);
                  const shown = list.slice(0, MAX_CHIPS);
                  const hidden = list.length - shown.length;

                  return (
                    <div
                      key={date}
                      className={`group relative flex flex-col min-h-[132px] border-l border-border p-1.5 ${
                        inMonth ? "" : "bg-background/40"
                      }`}
                    >
                      <div className="flex items-center justify-between px-1 pb-1">
                        <span
                          className={`inline-flex items-center justify-center min-w-7 h-7 px-1 rounded-full text-[13px] font-semibold tabular-nums ${
                            isToday
                              ? "bg-primary text-white"
                              : inMonth
                              ? "text-foreground"
                              : "text-muted/50"
                          }`}
                        >
                          {day.getDate() === 1 && !isToday
                            ? day.toLocaleDateString("en", { month: "short", day: "numeric" })
                            : day.getDate()}
                        </span>
                        <button
                          onClick={() => onNewIdea(date)}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-muted opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-foreground transition-all"
                          aria-label={`New piece on ${date}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <Droppable droppableId={`${droppablePrefix}${date}`}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 flex flex-col gap-1 rounded-lg min-h-[40px] transition-colors ${
                              snapshot.isDraggingOver ? "bg-primary/10 outline outline-1 outline-dashed outline-primary/50" : ""
                            }`}
                          >
                            {shown.map((idea, index) => {
                              const accent = colorOf(idea.category_id);
                              const done = isDone(idea);
                              return (
                                <Draggable key={idea.id} draggableId={idea.id} index={index}>
                                  {(drag, dragSnap) => (
                                    <div
                                      ref={drag.innerRef}
                                      {...drag.draggableProps}
                                      {...drag.dragHandleProps}
                                      onClick={() => onOpenIdea(idea.id)}
                                      title={idea.title}
                                      className={`flex items-center gap-1.5 pl-1.5 pr-1 py-1 rounded-md text-[11.5px] font-medium cursor-pointer transition-colors ${
                                        dragSnap.isDragging ? "shadow-2xl" : ""
                                      } ${inMonth ? "" : "opacity-60"}`}
                                      style={{
                                        backgroundColor: `${accent}22`,
                                        boxShadow: `inset 3px 0 0 ${accent}`,
                                        ...drag.draggableProps.style,
                                      }}
                                    >
                                      <span className="shrink-0" style={{ color: accent }}>
                                        <FormatIcon format={idea.format} className="w-3 h-3" />
                                      </span>
                                      <span className={`truncate flex-1 ${done ? "text-foreground/70" : ""}`}>
                                        {idea.title}
                                      </span>
                                      {done && (
                                        <Check className="w-3 h-3 shrink-0 text-emerald-400" strokeWidth={3} />
                                      )}
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })}
                            {provided.placeholder}
                            {hidden > 0 && (
                              <button
                                onClick={() => onOpenWeek(weekKey)}
                                className="text-left px-1.5 text-[11px] font-semibold text-muted hover:text-foreground"
                              >
                                +{hidden} more
                              </button>
                            )}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
