import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CURRICULUM_SUBJECTS,
  CURRICULUM_CONNECTIONS,
  SEMESTER_LABELS,
  getSemesterSubjects,
  getSemesterTotals,
  type CurriculumSubject,
} from "../curriculumData";
import type { CurriculumStatus } from "../api";

interface CurriculumMapProps {
  statusMap: Map<string, CurriculumStatus>;
  onToggle: (id: string) => void;
  hideSeenText: boolean;
  currentUC: number;
}

interface ArrowPath {
  d: string;
  color: string;
}

const PRELACION_COLOR = "#9ca3af"; // gray-400, visible on the dark theme
const COREQUISITO_COLOR = "#22c55e"; // green-500, matches the source legend

function SubjectBox({
  subject,
  status,
  hideSeenText,
  currentUC,
  onToggle,
  registerRef,
}: {
  subject: CurriculumSubject;
  status: CurriculumStatus | undefined;
  hideSeenText: boolean;
  currentUC: number;
  onToggle: (id: string) => void;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  const gateMet = subject.minUC != null && currentUC >= subject.minUC;

  const overlayClass =
    status === "seen"
      ? hideSeenText
        ? "bg-gray-600"
        : "bg-gray-500/50"
      : status === "tentative"
      ? "bg-orange-500/50"
      : null;

  const title =
    status === "seen"
      ? "Marcada como vista — click para desmarcar"
      : status === "tentative"
      ? "Marcada como tentativa — click para desmarcar"
      : "Click para marcar";

  return (
    <div
      ref={registerRef}
      onClick={() => onToggle(subject.id)}
      className="relative cursor-pointer select-none rounded-lg border border-border bg-surface hover:border-primary/60 transition-colors"
      style={{ minHeight: 76 }}
      title={title}
    >
      <div className="absolute -top-2.5 left-2 px-1.5 py-0.5 rounded bg-surface-hover border border-border text-[10px] leading-none text-muted whitespace-nowrap">
        {subject.uc} UC
      </div>
      {subject.minUC != null && (
        <div
          className={`absolute -top-2.5 right-2 px-1.5 py-0.5 rounded border text-[10px] leading-none whitespace-nowrap ${
            gateMet
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
              : "bg-amber-500/20 border-amber-500/40 text-amber-400"
          }`}
          title={gateMet ? "Requisito de UC cumplido" : "Requisito de UC no cumplido"}
        >
          &ge;{subject.minUC} UC
        </div>
      )}
      <div className="px-3 pt-4 pb-3 text-[12px] sm:text-[13px] leading-snug font-medium">
        {subject.name}
      </div>
      {overlayClass && (
        <div className={`absolute inset-0 rounded-lg pointer-events-none ${overlayClass}`} />
      )}
    </div>
  );
}

// Renders the full curriculum as semester columns with subject boxes, plus
// an SVG layer drawing prerequisite (gray) / corequisite (green) arrows
// between them. Positions are measured from the DOM after layout (not
// hardcoded), so it stays correct at any container width.
export default function CurriculumMap({ statusMap, onToggle, hideSeenText, currentUC }: CurriculumMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const boxRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [paths, setPaths] = useState<ArrowPath[]>([]);
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });

  const totals = useMemo(() => getSemesterTotals(), []);
  const subjectById = useMemo(() => {
    const map = new Map<string, CurriculumSubject>();
    for (const s of CURRICULUM_SUBJECTS) map.set(s.id, s);
    return map;
  }, []);

  useLayoutEffect(() => {
    const recompute = () => {
      const container = containerRef.current;
      if (!container) return;
      setSvgSize({ width: container.scrollWidth, height: container.scrollHeight });

      const containerRect = container.getBoundingClientRect();
      const next: ArrowPath[] = [];

      for (const conn of CURRICULUM_CONNECTIONS) {
        const fromEl = boxRefs.current[conn.from];
        const toEl = boxRefs.current[conn.to];
        const fromSubject = subjectById.get(conn.from);
        const toSubject = subjectById.get(conn.to);
        if (!fromEl || !toEl || !fromSubject || !toSubject) continue;

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        const sameSemester = fromSubject.semester === toSubject.semester;

        let x1: number, y1: number, x2: number, y2: number, d: string;

        if (sameSemester) {
          const fromAbove = fromRect.top < toRect.top;
          x1 = fromRect.left + fromRect.width / 2 - containerRect.left;
          y1 = (fromAbove ? fromRect.bottom : fromRect.top) - containerRect.top;
          x2 = toRect.left + toRect.width / 2 - containerRect.left;
          y2 = (fromAbove ? toRect.top : toRect.bottom) - containerRect.top;
          const dy = y2 - y1;
          d = `M ${x1} ${y1} C ${x1} ${y1 + dy * 0.5}, ${x2} ${y2 - dy * 0.5}, ${x2} ${y2}`;
        } else {
          x1 = fromRect.right - containerRect.left;
          y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
          x2 = toRect.left - containerRect.left;
          y2 = toRect.top + toRect.height / 2 - containerRect.top;
          const dx = x2 - x1;
          const semesterGap = Math.abs(toSubject.semester - fromSubject.semester);

          if (semesterGap > 1) {
            // Skips one or more columns: bow well below the row so the line
            // visibly detours around the intermediate box(es) instead of
            // passing behind them at the same height (which would look
            // identical to a direct connection to that box).
            const bowY = Math.max(y1, y2) + 60 + (semesterGap - 2) * 25;
            d = `M ${x1} ${y1} C ${x1 + dx * 0.2} ${bowY}, ${x2 - dx * 0.2} ${bowY}, ${x2} ${y2}`;
          } else {
            d = `M ${x1} ${y1} C ${x1 + dx * 0.5} ${y1}, ${x2 - dx * 0.5} ${y2}, ${x2} ${y2}`;
          }
        }

        next.push({
          d,
          color: conn.type === "correquisito" ? COREQUISITO_COLOR : PRELACION_COLOR,
        });
      }

      setPaths(next);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [subjectById]);

  return (
    <div className="relative left-1/2 -translate-x-1/2 w-screen px-4 sm:px-6 lg:px-8">
      <div className="overflow-x-auto pb-4">
        <div ref={containerRef} className="relative flex gap-8 pt-2 pb-6 w-full min-w-[1600px]">
          <svg
            className="absolute top-0 left-0 pointer-events-none overflow-visible"
            width={svgSize.width}
            height={svgSize.height}
            style={{ width: svgSize.width, height: svgSize.height }}
          >
            <defs>
              <marker
                id="curriculum-arrow-prelacion"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill={PRELACION_COLOR} />
              </marker>
              <marker
                id="curriculum-arrow-correquisito"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill={COREQUISITO_COLOR} />
              </marker>
            </defs>
            {paths.map((p, i) => (
              <path
                key={i}
                d={p.d}
                stroke={p.color}
                strokeWidth={2}
                fill="none"
                markerEnd={`url(#${p.color === COREQUISITO_COLOR ? "curriculum-arrow-correquisito" : "curriculum-arrow-prelacion"})`}
              />
            ))}
          </svg>

          {Array.from({ length: 8 }, (_, i) => i + 1).map((sem) => {
            const total = totals[sem - 1];
            return (
              <div key={sem} className="relative flex flex-col gap-5 flex-1 min-w-[180px]">
                <div className="rounded-lg border border-border bg-surface-hover px-3 py-2 text-center">
                  <div className="text-[11px] text-muted">
                    {total.uc} UC -&gt; {total.cumulative}
                  </div>
                  <div className="text-xs font-semibold tracking-wide uppercase">
                    {SEMESTER_LABELS[sem - 1]} Semestre
                  </div>
                </div>
                {getSemesterSubjects(sem).map((subject) => (
                  <SubjectBox
                    key={subject.id}
                    subject={subject}
                    status={statusMap.get(subject.id)}
                    hideSeenText={hideSeenText}
                    currentUC={currentUC}
                    onToggle={onToggle}
                    registerRef={(el) => {
                      boxRefs.current[subject.id] = el;
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
