import { Fragment, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Table2, Plus, Trash2 } from "lucide-react";
import type { GeneralInfoTableData } from "../types";

interface TableBlockProps {
  value: GeneralInfoTableData | null;
  onChange?: (value: GeneralInfoTableData | null) => void; // provide to make it editable
}

const DEFAULT_ROW_HEIGHT = 40;
const MIN_COL_WIDTH = 60;
const MIN_ROW_HEIGHT = 28;
const GUTTER = 32;

function emptyGrid(rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
}

function columnLabel(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

type DragState =
  | { type: "col"; index: number; startPos: number; startSize: number }
  | { type: "row"; index: number; startPos: number; startSize: number };

// Renders as a compact collapsed header by default, same pattern as
// CodeBlock; expand to pick dimensions (once) then edit cells inline.
// Columns default to auto-fit the available width (like a fresh Excel
// sheet) until the user drags a header border, at which point that
// column/row is pinned to an explicit pixel size.
export default function TableBlock({ value, onChange }: TableBlockProps) {
  const editable = !!onChange;
  const [expanded, setExpanded] = useState(false);
  const [rowsInput, setRowsInput] = useState(3);
  const [colsInput, setColsInput] = useState(3);
  const dragRef = useRef<DragState | null>(null);
  const colElRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rowElRefs = useRef<(HTMLDivElement | null)[]>([]);

  if (!editable && !value) return null;

  const colWidths: (number | null)[] = value
    ? Array.from({ length: value.cols }, (_, c) => value.colWidths?.[c] ?? null)
    : [];
  const rowHeights: number[] = value
    ? Array.from({ length: value.rows }, (_, r) => value.rowHeights?.[r] ?? DEFAULT_ROW_HEIGHT)
    : [];

  const createTable = () => {
    const rows = Math.min(Math.max(rowsInput, 1), 20);
    const cols = Math.min(Math.max(colsInput, 1), 20);
    onChange!({ rows, cols, cells: emptyGrid(rows, cols) });
  };

  const updateCell = (r: number, c: number, text: string) => {
    if (!value) return;
    const cells = value.cells.map((row) => [...row]);
    cells[r][c] = text;
    onChange!({ ...value, cells });
  };

  const addRow = () => {
    if (!value) return;
    onChange!({
      ...value,
      rows: value.rows + 1,
      cells: [...value.cells, Array.from({ length: value.cols }, () => "")],
      rowHeights: [...rowHeights, DEFAULT_ROW_HEIGHT],
    });
  };

  const removeRow = () => {
    if (!value || value.rows <= 1) return;
    onChange!({
      ...value,
      rows: value.rows - 1,
      cells: value.cells.slice(0, -1),
      rowHeights: rowHeights.slice(0, -1),
    });
  };

  const addCol = () => {
    if (!value) return;
    onChange!({
      ...value,
      cols: value.cols + 1,
      cells: value.cells.map((row) => [...row, ""]),
      colWidths: [...colWidths, null],
    });
  };

  const removeCol = () => {
    if (!value || value.cols <= 1) return;
    onChange!({
      ...value,
      cols: value.cols - 1,
      cells: value.cells.map((row) => row.slice(0, -1)),
      colWidths: colWidths.slice(0, -1),
    });
  };

  const removeTable = () => {
    onChange!(null);
    setExpanded(false);
  };

  const handleDragMove = (e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag || !value) return;
    if (drag.type === "col") {
      const delta = e.clientX - drag.startPos;
      const next = [...colWidths];
      next[drag.index] = Math.max(MIN_COL_WIDTH, drag.startSize + delta);
      onChange!({ ...value, colWidths: next });
    } else {
      const delta = e.clientY - drag.startPos;
      const next = [...rowHeights];
      next[drag.index] = Math.max(MIN_ROW_HEIGHT, drag.startSize + delta);
      onChange!({ ...value, rowHeights: next });
    }
  };

  const handleDragEnd = () => {
    dragRef.current = null;
    window.removeEventListener("mousemove", handleDragMove);
    window.removeEventListener("mouseup", handleDragEnd);
  };

  const startColResize = (index: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    const startSize = colElRefs.current[index]?.getBoundingClientRect().width ?? MIN_COL_WIDTH;
    dragRef.current = { type: "col", index, startPos: e.clientX, startSize };
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
  };

  const startRowResize = (index: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    const startSize = rowElRefs.current[index]?.getBoundingClientRect().height ?? MIN_ROW_HEIGHT;
    dragRef.current = { type: "row", index, startPos: e.clientY, startSize };
    window.addEventListener("mousemove", handleDragMove);
    window.addEventListener("mouseup", handleDragEnd);
  };

  const gridTemplateColumns = `${GUTTER}px ${colWidths
    .map((w) => (w == null ? "minmax(120px, 1fr)" : `${w}px`))
    .join(" ")}`;
  const gridTemplateRows = `${GUTTER}px ${rowHeights.map((h) => `${h}px`).join(" ")}`;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-surface-hover text-left text-xs"
      >
        {value ? (
          expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0" />
          )
        ) : (
          <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
        )}
        <Table2 className="w-3.5 h-3.5 text-muted shrink-0" />
        <span className="font-medium text-muted">
          {value ? `Table (${value.rows}x${value.cols})` : "Add table (optional)"}
        </span>
        {editable && value && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              removeTable();
            }}
            className="ml-auto p-1 rounded hover:bg-surface text-muted hover:text-red-400 cursor-pointer"
            title="Remove table"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {expanded && (
        <div className="bg-background border-t border-border px-3 py-3 space-y-3">
          {!value && editable && (
            <div className="flex items-end gap-2 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-muted">Rows</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={rowsInput}
                  onChange={(e) => setRowsInput(Number(e.target.value))}
                  className="w-16 bg-surface border border-border rounded px-2 py-1 focus:border-primary outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-muted">Columns</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={colsInput}
                  onChange={(e) => setColsInput(Number(e.target.value))}
                  className="w-16 bg-surface border border-border rounded px-2 py-1 focus:border-primary outline-none"
                />
              </div>
              <button
                type="button"
                onClick={createTable}
                className="px-3 py-1.5 rounded bg-primary hover:bg-primary-hover text-white font-medium"
              >
                Create table
              </button>
            </div>
          )}

          {value && (
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns,
                    gridTemplateRows,
                    width: "100%",
                  }}
                >
                  <div
                    className="border border-border bg-surface-hover"
                    style={{ gridColumn: 1, gridRow: 1 }}
                  />

                  {colWidths.map((_, c) => (
                    <div
                      key={`col-${c}`}
                      ref={(el) => {
                        colElRefs.current[c] = el;
                      }}
                      className="relative border border-border bg-surface-hover text-[11px] text-muted flex items-center justify-center select-none"
                      style={{ gridColumn: c + 2, gridRow: 1 }}
                    >
                      {columnLabel(c)}
                      {editable && (
                        <div
                          onMouseDown={startColResize(c)}
                          className="absolute top-0 right-0 h-full w-2 -mr-1 cursor-col-resize hover:bg-primary/50 z-10"
                        />
                      )}
                    </div>
                  ))}

                  {rowHeights.map((_, r) => (
                    <Fragment key={`row-${r}`}>
                      <div
                        ref={(el) => {
                          rowElRefs.current[r] = el;
                        }}
                        className="relative border border-border bg-surface-hover text-[11px] text-muted flex items-center justify-center select-none"
                        style={{ gridColumn: 1, gridRow: r + 2 }}
                      >
                        {r + 1}
                        {editable && (
                          <div
                            onMouseDown={startRowResize(r)}
                            className="absolute bottom-0 left-0 w-full h-2 -mb-1 cursor-row-resize hover:bg-primary/50 z-10"
                          />
                        )}
                      </div>
                      {value.cells[r].map((cell, c) => (
                        <div
                          key={`cell-${r}-${c}`}
                          className="border border-border overflow-hidden bg-surface"
                          style={{ gridColumn: c + 2, gridRow: r + 2 }}
                        >
                          {editable ? (
                            <input
                              type="text"
                              value={cell}
                              onChange={(e) => updateCell(r, c, e.target.value)}
                              className="w-full h-full bg-transparent px-3 text-sm focus:outline-none focus:bg-surface-hover"
                            />
                          ) : (
                            <div className="w-full h-full px-3 py-2 text-sm text-muted break-words overflow-auto">
                              {cell}
                            </div>
                          )}
                        </div>
                      ))}
                    </Fragment>
                  ))}
                </div>
              </div>
              {editable && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={addRow}
                    className="px-2 py-1 rounded bg-surface-hover hover:bg-border text-muted"
                  >
                    + Row
                  </button>
                  <button
                    type="button"
                    onClick={removeRow}
                    className="px-2 py-1 rounded bg-surface-hover hover:bg-border text-muted"
                  >
                    - Row
                  </button>
                  <button
                    type="button"
                    onClick={addCol}
                    className="px-2 py-1 rounded bg-surface-hover hover:bg-border text-muted"
                  >
                    + Column
                  </button>
                  <button
                    type="button"
                    onClick={removeCol}
                    className="px-2 py-1 rounded bg-surface-hover hover:bg-border text-muted"
                  >
                    - Column
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
