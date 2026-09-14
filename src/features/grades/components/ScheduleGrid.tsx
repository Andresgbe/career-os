import type { ScheduleBlockRow, ScheduleDay } from "../types";
import {
  SCHEDULE_DAYS,
  SCHEDULE_GRID_START_HOUR,
  SCHEDULE_GRID_END_HOUR,
} from "../types";

const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 24; // px per half-hour row
const TOTAL_SLOTS =
  ((SCHEDULE_GRID_END_HOUR - SCHEDULE_GRID_START_HOUR) * 60) / SLOT_MINUTES;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

// 1-indexed CSS grid row for a given "HH:MM" time within the grid's range.
function rowForTime(t: string): number {
  const minutes = timeToMinutes(t) - SCHEDULE_GRID_START_HOUR * 60;
  return Math.round(minutes / SLOT_MINUTES) + 1;
}

function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? "pm" : "am";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${period}`;
}

interface ScheduleGridProps {
  blocks: ScheduleBlockRow[];
  onBlockClick: (block: ScheduleBlockRow) => void;
  onDayClick: (day: ScheduleDay) => void;
}

// Weekly Monday-Friday calendar grid. Each class block is a CSS grid item
// placed by day (column) and start/end time (row span), so overlapping
// blocks and arbitrary durations are handled without manual pixel math.
export default function ScheduleGrid({
  blocks,
  onBlockClick,
  onDayClick,
}: ScheduleGridProps) {
  const hours: number[] = [];
  for (let h = SCHEDULE_GRID_START_HOUR; h <= SCHEDULE_GRID_END_HOUR; h++) {
    hours.push(h);
  }
  const columns = "44px repeat(5, minmax(0, 1fr))";

  return (
    <div className="bg-surface/60 border border-border rounded-xl overflow-hidden">
      {/* Day header row */}
      <div className="grid" style={{ gridTemplateColumns: columns }}>
        <div className="border-b border-border" />
        {SCHEDULE_DAYS.map((d) => (
          <div
            key={d.value}
            className="text-center text-xs font-semibold text-muted py-2 border-b border-l border-border"
          >
            {d.label}
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div
        className="relative grid"
        style={{
          gridTemplateColumns: columns,
          gridTemplateRows: `repeat(${TOTAL_SLOTS}, ${SLOT_HEIGHT}px)`,
        }}
      >
        {/* Hour labels */}
        {hours.map((h) => (
          <div
            key={h}
            className="text-[10px] text-muted pr-1 text-right leading-none pt-0.5"
            style={{ gridColumn: 1, gridRow: rowForTime(`${h}:00`) }}
          >
            {formatHourLabel(h)}
          </div>
        ))}

        {/* Day columns: hour gridlines + click-to-add empty space */}
        {SCHEDULE_DAYS.map((d) => (
          <button
            key={d.value}
            onClick={() => onDayClick(d.value)}
            title="Agregar clase"
            className="border-l border-border hover:bg-surface-hover/40 transition-colors"
            style={{
              gridColumn: d.value + 2,
              gridRow: `1 / ${TOTAL_SLOTS + 1}`,
              backgroundImage:
                "repeating-linear-gradient(to bottom, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent " +
                SLOT_HEIGHT * 2 +
                "px)",
            }}
          />
        ))}

        {/* Class blocks */}
        {blocks.map((block) => (
          <button
            key={block.id}
            onClick={(e) => {
              e.stopPropagation();
              onBlockClick(block);
            }}
            className="relative z-10 m-[1px] rounded px-1.5 py-1 text-left overflow-hidden text-white shadow-sm hover:brightness-110 transition-[filter]"
            style={{
              gridColumn: block.day + 2,
              gridRow: `${rowForTime(block.start_time)} / ${rowForTime(block.end_time)}`,
              backgroundColor: block.color,
            }}
            title={`${block.subject} · ${block.start_time}–${block.end_time}`}
          >
            <span className="block text-[11px] font-semibold leading-tight truncate">
              {block.subject}
            </span>
            <span className="block text-[9px] opacity-90 leading-tight truncate">
              {block.start_time}–{block.end_time}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
