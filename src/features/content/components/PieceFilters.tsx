import { FORMATS, STYLES } from "../types";
import FormatIcon from "./FormatIcon";
import type { PieceFilter } from "./pieceFilter";

// Format + style filter row shared by the Idea board and the Finished tab.
export default function PieceFilters({
  value,
  onChange,
  count,
}: {
  value: PieceFilter;
  onChange: (next: PieceFilter) => void;
  count?: number;
}) {
  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
      active ? "bg-surface-hover border-[#3a3a44] text-foreground" : "border-transparent text-muted hover:text-foreground"
    }`;
  const active = value.format !== "all" || value.style !== "all";

  return (
    <div className="flex items-center gap-x-4 gap-y-2 flex-wrap rounded-2xl border border-border bg-surface px-3 py-2">
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted mr-1">Format</span>
        <button className={chip(value.format === "all")} onClick={() => onChange({ ...value, format: "all" })}>
          All
        </button>
        {FORMATS.map((f) => (
          <button key={f.key} className={chip(value.format === f.key)} onClick={() => onChange({ ...value, format: f.key })}>
            <FormatIcon format={f.key} className="w-3 h-3" />
            {f.label}
          </button>
        ))}
        <button className={chip(value.format === "")} onClick={() => onChange({ ...value, format: "" })}>
          No format
        </button>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted mr-1">Style</span>
        <button className={chip(value.style === "all")} onClick={() => onChange({ ...value, style: "all" })}>
          All
        </button>
        {STYLES.map((s) => (
          <button key={s.key} className={chip(value.style === s.key)} onClick={() => onChange({ ...value, style: s.key })}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </button>
        ))}
        <button className={chip(value.style === "")} onClick={() => onChange({ ...value, style: "" })}>
          No style
        </button>
      </div>
      {active && (
        <div className="flex items-center gap-2 ml-auto text-xs text-muted">
          {count !== undefined && <span className="tabular-nums">{count} shown</span>}
          <button onClick={() => onChange({ format: "all", style: "all" })} className="font-semibold hover:text-foreground">
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
