import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface MonthPickerProps {
  value: string; // yyyy-mm
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

function parseMonth(value: string): { year: number; month: number } {
  const [y, m] = value.split("-").map(Number);
  const now = new Date();
  return {
    year: y || now.getFullYear(),
    month: m ? m - 1 : now.getMonth(),
  };
}

function formatLabel(value: string): string {
  const { year, month } = parseMonth(value);
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

// Click-driven month picker: a button showing "Month Year" that opens a
// dropdown with year navigation arrows and a 12-month grid, so changing
// the month never depends on keyboard arrow keys (unlike native
// `<input type="month">`, which is the opposite of intuitive to drive
// with a mouse). The panel renders through a portal at a fixed position
// so it isn't clipped when this sits inside a scrollable table wrapper.
export default function MonthPicker({
  value,
  onChange,
  disabled,
  className = "",
}: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => parseMonth(value).year);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleReposition = () => setOpen(false);

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open]);

  const { year: selectedYear, month: selectedMonth } = parseMonth(value);

  const selectMonth = (m: number) => {
    onChange(`${viewYear}-${String(m + 1).padStart(2, "0")}`);
    setOpen(false);
  };

  const openPicker = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 4, left: rect.left });
    setViewYear(parseMonth(value).year);
    setOpen(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={`flex items-center justify-between gap-2 bg-background border border-border rounded px-2 py-1 text-sm disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      >
        <span>{formatLabel(value)}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" />
      </button>

      {open &&
        !disabled &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: coords.top, left: coords.left }}
            className="fixed z-50 bg-surface border border-border rounded-lg shadow-lg p-3 w-56"
          >
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setViewYear((y) => y - 1)}
                className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium">{viewYear}</span>
              <button
                type="button"
                onClick={() => setViewYear((y) => y + 1)}
                className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {MONTH_LABELS.map((label, m) => {
                const isSelected =
                  viewYear === selectedYear && m === selectedMonth;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => selectMonth(m)}
                    className={`px-2 py-1.5 rounded text-sm transition-colors ${
                      isSelected
                        ? "bg-primary text-white"
                        : "text-foreground hover:bg-surface-hover"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
