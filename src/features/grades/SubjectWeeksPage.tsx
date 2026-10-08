import { errorMessage } from "../../lib/errors";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MessageCircle, Plus } from "lucide-react";
import { getSubjects, ensureWeeksSeeded } from "./api";
import {
  weekDateLabel,
  weekMetaLabel,
  weekStatus,
  type SubjectRow,
  type WeekRow,
} from "./types";
import { todayIso } from "../tasks/types";

// La vista de carpetas: las 16 semanas de una materia, cada una como una
// tarjeta. Sigue el patrón de taller aprobado en la propuesta de diseño.
export default function SubjectWeeksPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const [subject, setSubject] = useState<SubjectRow | null>(null);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!subjectId) return;
    Promise.all([getSubjects(), ensureWeeksSeeded(subjectId)])
      .then(([subjects, weekRows]) => {
        setSubject(subjects.find((s) => s.id === subjectId) ?? null);
        setWeeks(weekRows);
      })
      .catch((err) => setError(errorMessage(err, "Error cargando las semanas")))
      .finally(() => setLoading(false));
  }, [subjectId]);

  if (loading) return <p className="text-muted text-sm">Cargando...</p>;
  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (!subject) return <p className="text-muted text-sm">Materia no encontrada.</p>;

  const today = todayIso();
  const filledCount = weeks.filter((w) => weekStatus(w, today) !== "empty").length;
  const progressPct = weeks.length ? Math.round((filledCount / weeks.length) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-6 mb-6">
        <div>
          <nav className="text-xs text-muted mb-2.5 flex items-center gap-1.5">
            <Link to="/grades" className="hover:text-foreground transition-colors">
              University
            </Link>
            <span>/</span>
            <span className="text-foreground">{subject.name}</span>
          </nav>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold">Semanas</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-sm text-muted">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: subject.color }}
              />
              {subject.name}
            </span>
          </div>
        </div>

        {weeks.length > 0 && (
          <div className="min-w-[220px]">
            <div className="flex justify-between text-xs text-muted mb-1.5 gap-4">
              <span>Avance del semestre</span>
              <span className="text-foreground font-semibold">
                {filledCount} de {weeks.length} semanas
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface border border-border overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="flex gap-3 items-start p-3.5 rounded-xl bg-surface border border-border mb-6">
        <MessageCircle className="w-[18px] h-[18px] text-primary shrink-0 mt-0.5" />
        <p className="text-sm leading-relaxed text-muted">
          Lo que guardes en cada semana — temas, apuntes, código, archivos — el chat de NEXUS lo
          repasa para ayudarte con precisión en esta materia. Preguntale{" "}
          <span className="text-foreground">"¿qué vimos esta semana?"</span> o pedile un resumen
          para estudiar.
        </p>
      </div>

      {/* Grid */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
        {weeks.map((week) => {
          const status = weekStatus(week, today);
          return (
            <button
              key={week.id}
              onClick={() => navigate(`/grades/${subjectId}/weeks/${week.week_number}`)}
              className={`text-left p-4 rounded-2xl transition-colors ${
                status === "current"
                  ? "bg-surface border-2 border-primary"
                  : status === "empty"
                    ? "bg-transparent border-[1.5px] border-dashed border-border hover:border-muted"
                    : "bg-surface border border-border hover:border-muted"
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wide">
                  Semana {week.week_number}
                </span>
                {status === "current" ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-primary text-white whitespace-nowrap">
                    En curso
                  </span>
                ) : status === "filled" ? (
                  <span className="w-4 h-4 rounded-full bg-emerald-400/20 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </span>
                ) : (
                  <Plus className="w-4 h-4 text-muted" />
                )}
              </div>
              <p
                className={`mt-3 mb-1 text-sm font-semibold leading-snug min-h-[38px] ${
                  status === "empty" ? "text-muted font-normal" : ""
                }`}
              >
                {week.topics[0] || "Sin tema asignado"}
              </p>
              <p
                className={`text-xs mb-2.5 ${
                  status === "current"
                    ? "text-primary"
                    : status === "empty"
                      ? "text-muted italic"
                      : "text-muted"
                }`}
              >
                {status === "current" && !hasVisibleContent(week)
                  ? "Apuntes en progreso"
                  : weekMetaLabel(week)}
              </p>
              <span className="text-xs text-muted">{weekDateLabel(week)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function hasVisibleContent(week: WeekRow): boolean {
  return (
    week.notes.replace(/<[^>]*>/g, "").trim().length > 0 ||
    week.code.trim().length > 0 ||
    week.resources.length > 0
  );
}
