import { formatUsd, type DayTotals } from "../types";

interface DailyCashFlowChartProps {
  days: DayTotals[];
  monthLabel: string;
}

// Hand-written responsive SVG bar chart comparing daily agency income vs expenses.
export default function DailyCashFlowChart({ days, monthLabel }: DailyCashFlowChartProps) {
  const max = Math.max(1, ...days.map((d) => Math.max(d.income, d.expense)));

  const W = 1000;
  const H = 220;
  const pad = { top: 12, right: 8, bottom: 24, left: 8 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const slot = plotW / Math.max(1, days.length);
  const barW = Math.max(2, Math.min(10, slot / 2 - 1.5));

  const y = (value: number) => pad.top + plotH - (value / max) * plotH;
  const hasData = days.some((d) => d.income > 0 || d.expense > 0);

  return (
    <div className="bg-surface border border-border rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="text-sm font-semibold">Daily Cash Flow — {monthLabel}</h3>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
            Income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-400" />
            Expenses
          </span>
        </div>
      </div>

      {!hasData ? (
        <p className="text-sm text-muted py-10 text-center">
          No movements logged in {monthLabel} yet.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-[200px]"
          role="img"
          aria-label={`Daily income and expenses for ${monthLabel}`}
        >
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={pad.left}
              x2={W - pad.right}
              y1={y(max * f)}
              y2={y(max * f)}
              stroke="currentColor"
              className="text-border"
              strokeWidth={1}
            />
          ))}

          {days.map((d, i) => {
            const center = pad.left + slot * i + slot / 2;
            return (
              <g key={d.day}>
                {d.income > 0 && (
                  <rect
                    x={center - barW - 1}
                    y={y(d.income)}
                    width={barW}
                    height={pad.top + plotH - y(d.income)}
                    rx={1.5}
                    className="fill-emerald-400"
                  >
                    <title>{`Day ${d.day}: +${formatUsd(d.income)}`}</title>
                  </rect>
                )}
                {d.expense > 0 && (
                  <rect
                    x={center + 1}
                    y={y(d.expense)}
                    width={barW}
                    height={pad.top + plotH - y(d.expense)}
                    rx={1.5}
                    className="fill-red-400"
                  >
                    <title>{`Day ${d.day}: -${formatUsd(d.expense)}`}</title>
                  </rect>
                )}
                {(d.day === 1 || d.day % 5 === 0) && (
                  <text
                    x={center}
                    y={H - 6}
                    textAnchor="middle"
                    className="fill-current text-muted"
                    style={{ fontSize: 11 }}
                  >
                    {d.day}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
