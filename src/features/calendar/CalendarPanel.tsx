import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock, ListTodo, Plus, Repeat, Trash2, X } from "lucide-react";
import ConfirmDialog from "../../components/ConfirmDialog";
import { errorMessage } from "../../lib/errors";
import { monthGrid, monthKeyOf, shiftMonth, toISODate, todayISO } from "../content/types";
import { getTasks } from "../tasks/api";
import type { TaskRow } from "../tasks/types";
import { addEvent, deleteEvent, getEvents, updateEvent } from "./api";
import { dayBefore, occurrencesOn } from "./recurrence";
import {
  DAYS_ES,
  KIND_CLASS,
  KIND_DOT,
  KIND_LABEL,
  KINDS,
  longDayLabel,
  monthTitle,
  repeatLabel,
  repeatShort,
  REPEATS,
  sortOccurrences,
  type CalendarEvent,
  type EventKind,
  type Occurrence,
  type RepeatKind,
} from "./types";

// Cuántos items se ven en una celda antes de colapsar el resto en "+N"
const MAX_CHIPS = 3;

const inputClass =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-primary";

/**
 * Calendario del mes con recordatorios, tareas y eventos propios en cualquier
 * día. También muestra (solo lectura) las tareas del asistente que tienen
 * fecha límite, para ver todo junto.
 */
export default function CalendarPanel() {
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [assistantTasks, setAssistantTasks] = useState<TaskRow[]>([]);
  const [error, setError] = useState("");
  const [openDay, setOpenDay] = useState<string | null>(null);
  const today = todayISO();

  const rows = useMemo(() => monthGrid(monthKey), [monthKey]);
  const from = toISODate(rows[0][0]);
  const to = toISODate(rows[rows.length - 1][6]);

  const load = useCallback(() => {
    getEvents(from, to)
      .then((r) => {
        setEvents(r);
        setError("");
      })
      .catch((e) => setError(errorMessage(e, "No pude cargar el calendario")));
  }, [from, to]);

  useEffect(load, [load]);

  // Las tareas del asistente no dependen del mes: se leen una vez.
  useEffect(() => {
    getTasks()
      .then(setAssistantTasks)
      .catch(() => {});
  }, []);

  const occurrences = (date: string) => occurrencesOn(events, date).sort(sortOccurrences);
  const tasksOn = (date: string) =>
    assistantTasks.filter((t) => t.due_date === date && t.status !== "hecha");

  const [, currentMonth] = monthKey.split("-").map(Number);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold mr-auto truncate">{monthTitle(monthKey)}</h2>
        <button
          onClick={() => setMonthKey(monthKeyOf(new Date()))}
          className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
        >
          Hoy
        </button>
        <div className="flex gap-1">
          <button
            onClick={() => setMonthKey(shiftMonth(monthKey, -1))}
            aria-label="Mes anterior"
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMonthKey(shiftMonth(monthKey, 1))}
            aria-label="Mes siguiente"
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-background/40">
          {DAYS_ES.map((d, i) => (
            <div
              key={d}
              className={`px-2 py-2 text-[11px] font-bold uppercase tracking-wider ${
                i >= 5 ? "text-muted/70" : "text-muted"
              }`}
            >
              {d}
            </div>
          ))}
        </div>
        {rows.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {week.map((day, di) => {
              const date = toISODate(day);
              const inMonth = day.getMonth() + 1 === currentMonth;
              const isToday = date === today;
              const evs = occurrences(date);
              const tks = tasksOn(date);
              const items = [
                ...evs.map((o) => ({ key: o.event.id, label: o.event.title, cls: KIND_CLASS[o.event.kind], dot: KIND_DOT[o.event.kind], done: o.done, time: o.event.event_time, repeats: o.event.repeat !== "none" })),
                ...tks.map((t) => ({ key: `t${t.id}`, label: t.title, cls: "bg-surface-hover text-muted", dot: "bg-muted", done: false, time: "", repeats: false })),
              ];
              const extra = items.length - MAX_CHIPS;
              return (
                <button
                  key={date}
                  onClick={() => setOpenDay(date)}
                  className={`group min-h-[62px] sm:min-h-[104px] p-1 sm:p-1.5 text-left align-top border-r border-border last:border-r-0 hover:bg-surface-hover/60 transition-colors ${
                    di >= 5 ? "bg-background/20" : ""
                  } ${inMonth ? "" : "opacity-40"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? "bg-primary text-white font-bold" : "text-muted"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    <Plus className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {/* Celular: solo puntos de color (no caben los textos) */}
                  <div className="flex flex-wrap gap-0.5 px-0.5 sm:hidden">
                    {items.slice(0, 6).map((it) => (
                      <span key={it.key} className={`w-1.5 h-1.5 rounded-full ${it.dot} ${it.done ? "opacity-40" : ""}`} />
                    ))}
                    {items.length > 6 && <span className="text-[9px] leading-none text-muted">+</span>}
                  </div>
                  <div className="hidden sm:block space-y-0.5">
                    {items.slice(0, MAX_CHIPS).map((it) => (
                      <div
                        key={it.key}
                        className={`truncate rounded px-1 py-0.5 text-[10px] sm:text-[11px] leading-tight ${it.cls} ${
                          it.done ? "line-through opacity-60" : ""
                        }`}
                      >
                        {it.repeats && <Repeat className="hidden sm:inline w-2.5 h-2.5 mr-0.5 -mt-0.5 opacity-70" />}
                        {it.time && <span className="hidden sm:inline font-medium">{it.time} </span>}
                        {it.label}
                      </div>
                    ))}
                    {extra > 0 && <div className="px-1 text-[10px] text-muted">+{extra} más</div>}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted">
        {KINDS.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded ${KIND_CLASS[k]}`} />
            {KIND_LABEL[k]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-surface-hover" />
          Tarea del asistente (fecha límite)
        </span>
      </div>

      {openDay && (
        <DayModal
          date={openDay}
          occurrences={occurrences(openDay)}
          assistantTasks={tasksOn(openDay)}
          onClose={() => setOpenDay(null)}
          onChange={load}
          onError={setError}
        />
      )}
    </div>
  );
}

// ============================================
// DÍA: lista + alta rápida
// ============================================

function DayModal({
  date,
  occurrences,
  assistantTasks,
  onClose,
  onChange,
  onError,
}: {
  date: string;
  occurrences: Occurrence[];
  assistantTasks: TaskRow[];
  onClose: () => void;
  onChange: () => void;
  onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [kind, setKind] = useState<EventKind>("recordatorio");
  const [notes, setNotes] = useState("");
  const [repeat, setRepeat] = useState<RepeatKind>("none");
  const [until, setUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Occurrence | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !deleting && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, deleting]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || saving) return;
    setSaving(true);
    try {
      await addEvent({
        title: t,
        notes: notes.trim(),
        event_date: date,
        event_time: time,
        kind,
        // Los campos de repetición solo se mandan si hay repetición, así
        // un evento simple funciona aunque la BD no los tenga todavía.
        ...(repeat !== "none" ? { repeat, repeat_until: until && until >= date ? until : null } : {}),
      });
      setTitle("");
      setTime("");
      setNotes("");
      setRepeat("none");
      setUntil("");
      onChange();
    } catch (err) {
      onError(errorMessage(err, "No pude guardar"));
    } finally {
      setSaving(false);
    }
  }

  async function toggle({ event: ev, done }: Occurrence) {
    try {
      if (ev.repeat === "none") await updateEvent(ev.id, { done: !done });
      else {
        const done_dates = done ? ev.done_dates.filter((d) => d !== date) : [...ev.done_dates, date];
        await updateEvent(ev.id, { done_dates });
      }
      onChange();
    } catch (err) {
      onError(errorMessage(err, "No pude actualizar"));
    }
  }

  // scope: "one" = solo este día, "following" = este y los siguientes, "all" = toda la serie
  async function remove(ev: Occurrence["event"], scope: "one" | "following" | "all") {
    setDeleting(null);
    try {
      if (scope === "all" || ev.repeat === "none" || (scope === "following" && date <= ev.event_date)) {
        await deleteEvent(ev.id);
      } else if (scope === "following") {
        await updateEvent(ev.id, { repeat_until: dayBefore(date) });
      } else {
        await updateEvent(ev.id, { skip_dates: [...ev.skip_dates, date] });
      }
      onChange();
    } catch (err) {
      onError(errorMessage(err, "No pude borrar"));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="relative bg-surface border border-border rounded-xl p-4 sm:p-5 w-full max-w-md max-h-[90dvh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover"
        >
          <X className="w-4 h-4" />
        </button>
        <h3 className="font-semibold pr-8 capitalize">{longDayLabel(date)}</h3>

        {occurrences.length === 0 && assistantTasks.length === 0 ? (
          <p className="text-sm text-muted">Nada este día todavía.</p>
        ) : (
          <ul className="space-y-2">
            {occurrences.map((occ) => {
              const ev = occ.event;
              return (
              <li key={ev.id} className="group flex items-start gap-2.5">
                <button
                  onClick={() => toggle(occ)}
                  aria-label={occ.done ? "Marcar pendiente" : "Marcar hecho"}
                  className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
                    occ.done ? "bg-emerald-500 border-emerald-500" : "border-muted/50 hover:border-primary"
                  }`}
                >
                  {occ.done && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className={`text-sm font-medium break-words ${occ.done ? "line-through text-muted" : ""}`}>
                      {ev.title}
                    </span>
                    <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 ${KIND_CLASS[ev.kind]}`}>
                      {KIND_LABEL[ev.kind]}
                    </span>
                    {ev.event_time && (
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        <Clock className="w-3 h-3" />
                        {ev.event_time}
                      </span>
                    )}
                    {ev.repeat !== "none" && (
                      <span
                        className="flex items-center gap-1 text-[11px] text-muted"
                        title={ev.repeat_until ? `Hasta el ${ev.repeat_until}` : "Sin fecha final"}
                      >
                        <Repeat className="w-3 h-3" />
                        {repeatShort(ev.repeat)}
                      </span>
                    )}
                  </div>
                  {ev.notes && <p className="text-xs text-muted whitespace-pre-line mt-0.5">{ev.notes}</p>}
                </div>
                <button
                  onClick={() => setDeleting(occ)}
                  aria-label="Borrar"
                  className="p-1 rounded text-muted opacity-60 sm:opacity-0 group-hover:opacity-100 hover:text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
              );
            })}
            {assistantTasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2.5 text-sm text-muted">
                <ListTodo className="w-5 h-5 shrink-0 p-0.5" />
                <span className="break-words">{t.title}</span>
                <span className="text-[10px] rounded px-1.5 py-0.5 bg-surface-hover shrink-0">Tarea del asistente</span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={add} className="space-y-2 border-t border-border pt-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nuevo recordatorio, tarea o evento…"
            maxLength={200}
            className={inputClass}
            autoFocus
          />
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value as EventKind)} className={inputClass}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="Hora (opcional)"
              className={inputClass}
            />
          </div>
          <select
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as RepeatKind)}
            aria-label="Repetición"
            className={inputClass}
          >
            {REPEATS.map((r) => (
              <option key={r} value={r}>
                {repeatLabel(r, date)}
              </option>
            ))}
          </select>
          {repeat !== "none" && (
            <label className="flex items-center gap-2 text-xs text-muted">
              Hasta
              <input
                type="date"
                value={until}
                min={date}
                onChange={(e) => setUntil(e.target.value)}
                className={inputClass}
              />
              <span className="shrink-0">(opcional)</span>
            </label>
          )}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas (opcional)"
            rows={2}
            className={`${inputClass} resize-y`}
          />
          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold disabled:opacity-40 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        </form>
      </div>

      {deleting && deleting.event.repeat === "none" && (
        <ConfirmDialog
          title="Borrar"
          message={`¿Borrar "${deleting.event.title}"? No se puede deshacer.`}
          confirmLabel="Borrar"
          onConfirm={() => remove(deleting.event, "all")}
          onCancel={() => setDeleting(null)}
        />
      )}
      {deleting && deleting.event.repeat !== "none" && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            e.stopPropagation();
            setDeleting(null);
          }}
        >
          <div
            className="bg-surface border border-border rounded-xl p-5 w-full max-w-sm space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold">Borrar evento que se repite</h3>
            <p className="text-sm text-muted break-words">"{deleting.event.title}"</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => remove(deleting.event, "one")}
                className="px-3 py-2 rounded-lg text-sm text-left bg-surface-hover hover:bg-surface-hover/70"
              >
                Solo este día
              </button>
              <button
                onClick={() => remove(deleting.event, "following")}
                className="px-3 py-2 rounded-lg text-sm text-left bg-surface-hover hover:bg-surface-hover/70"
              >
                Este día y los siguientes
              </button>
              <button
                onClick={() => remove(deleting.event, "all")}
                className="px-3 py-2 rounded-lg text-sm text-left text-red-300 bg-red-500/10 hover:bg-red-500/20"
              >
                Toda la serie
              </button>
              <button onClick={() => setDeleting(null)} className="px-3 py-2 rounded-lg text-sm text-muted hover:text-foreground">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
