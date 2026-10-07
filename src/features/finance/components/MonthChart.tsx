import { money } from "../flow";
import type { DayTotals } from "../flow";

interface MonthChartProps {
  days: DayTotals[];
  monthLabel: string;
}

// Barras de ingresos y gastos por día del mes, en SVG a mano.
//
// Sin librería de gráficas a propósito: son dos series y un eje, y meter
// una dependencia de 100 kB al bundle para esto no se justifica.
export default function MonthChart({ days, monthLabel }: MonthChartProps) {
  const max = Math.max(
    1,
    ...days.map((d) => Math.max(d.income, d.expense))
  );

  // viewBox fijo + preserveAspectRatio: la gráfica escala sola al ancho que
  // tenga, así funciona igual en el teléfono que en el monitor.
  const W = 1000;
  const H = 220;
  const pad = { top: 12, right: 8, bottom: 22, left: 8 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const slot = plotW / days.length;
  const barW = Math.max(2, Math.min(10, slot / 2 - 1.5));

  const y = (value: number) => pad.top + plotH - (value / max) * plotH;

  const hasData = days.some((d) => d.income > 0 || d.expense > 0);

  return (
    <div className="bg-surface border border-border rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="text-sm font-semibold">Día a día — {monthLabel}</h3>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
            Ingresos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-400" />
            Gastos
          </span>
        </div>
      </div>

      {!hasData ? (
        <p className="text-sm text-muted py-8 text-center">
          Sin movimientos este mes.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-[200px]"
          role="img"
          aria-label={`Ingresos y gastos por día de ${monthLabel}`}
        >
          {/* Líneas guía al 25, 50, 75 y 100 % del máximo */}
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
                    <title>{`Día ${d.day}: +$${money(d.income)}`}</title>
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
                    <title>{`Día ${d.day}: -$${money(d.expense)}`}</title>
                  </rect>
                )}
                {/* Un número cada 5 días, para no amontonar el eje */}
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
