import { useState } from "react";
import { X, Save, Trash2 } from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import type { ScheduleBlockRow, ScheduleDay } from "../types";
import { SCHEDULE_DAYS } from "../types";

const DEFAULT_COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#ec4899",
  "#3b82f6",
  "#f97316",
];

interface ScheduleBlockModalProps {
  block: ScheduleBlockRow | null; // null = adding a new class
  defaultDay?: ScheduleDay;
  personLabel: string; // shown in the title, e.g. "mi horario" or a friend's name
  onClose: () => void;
  onSave: (fields: {
    subject: string;
    day: ScheduleDay;
    start_time: string;
    end_time: string;
    color: string;
  }) => void;
  onDelete?: () => void;
}

export default function ScheduleBlockModal({
  block,
  defaultDay,
  personLabel,
  onClose,
  onSave,
  onDelete,
}: ScheduleBlockModalProps) {
  const [subject, setSubject] = useState(block?.subject ?? "");
  const [day, setDay] = useState<ScheduleDay>(block?.day ?? defaultDay ?? 0);
  const [startTime, setStartTime] = useState(block?.start_time ?? "07:00");
  const [endTime, setEndTime] = useState(block?.end_time ?? "09:00");
  const [color, setColor] = useState(block?.color ?? DEFAULT_COLORS[0]);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    if (!subject.trim()) {
      setError("Ingresa el nombre de la materia.");
      return;
    }
    if (startTime >= endTime) {
      setError("La hora de fin debe ser después de la de inicio.");
      return;
    }
    onSave({
      subject: subject.trim(),
      day,
      start_time: startTime,
      end_time: endTime,
      color,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">
            {block ? "Editar clase" : "Nueva clase"}{" "}
            <span className="text-muted font-normal">· {personLabel}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-muted hover:bg-surface-hover"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Materia</label>
            <input
              type="text"
              autoFocus
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Programación Web"
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Día</label>
            <select
              value={day}
              onChange={(e) => setDay(Number(e.target.value) as ScheduleDay)}
              className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
            >
              {SCHEDULE_DAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Inicio</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Fin</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Color</label>
            <div className="flex gap-1.5">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-all ${
                    color === c
                      ? "ring-2 ring-offset-2 ring-offset-background scale-110"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-5">
          {block && onDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 px-4 py-2 rounded text-red-400 hover:bg-surface-hover text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded bg-surface-hover hover:bg-border text-foreground text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              Guardar
            </button>
          </div>
        </div>
      </div>

      {confirmDelete && onDelete && (
        <ConfirmDialog
          title="Eliminar clase"
          message={`Eliminar "${subject}" del horario?`}
          onConfirm={() => {
            onDelete();
            setConfirmDelete(false);
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
