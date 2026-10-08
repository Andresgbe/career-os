import { errorMessage } from "../../lib/errors";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  MessageCircle,
  Paperclip,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import RichTextEditor from "../../components/RichTextEditor";
import CodeBlock from "../../components/CodeBlock";
import ConfirmDialog from "../../components/ConfirmDialog";
import {
  getSubjects,
  getWeeks,
  updateWeek,
  uploadGradesImage,
  uploadWeekFile,
  deleteWeekFile,
} from "./api";
import { weekStatus, type SubjectRow, type WeekRow, type WeekResource } from "./types";
import { todayIso } from "../tasks/types";

const EXAMPLE_PROMPTS = [
  "¿Qué vimos esta semana?",
  "Armame un resumen para estudiar esta semana",
  "Hazme 5 preguntas de práctica sobre esto",
];

export default function WeekDetailPage() {
  const { subjectId, weekNumber } = useParams<{ subjectId: string; weekNumber: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState<SubjectRow | null>(null);
  const [week, setWeek] = useState<WeekRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [addingTopic, setAddingTopic] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<WeekResource | null>(null);

  useEffect(() => {
    if (!subjectId || !weekNumber) return;
    Promise.all([getSubjects(), getWeeks(subjectId)])
      .then(([subjects, weeks]) => {
        setSubject(subjects.find((s) => s.id === subjectId) ?? null);
        setWeek(weeks.find((w) => w.week_number === Number(weekNumber)) ?? null);
      })
      .catch((err) => setError(errorMessage(err, "Error cargando la semana")))
      .finally(() => setLoading(false));
  }, [subjectId, weekNumber]);

  // Autoguardado: cada cambio se persiste solo, como ya hace el plan de
  // evaluación — nunca hay un botón "Guardar" que se pueda olvidar apretar.
  async function save(fields: Parameters<typeof updateWeek>[1]) {
    if (!week) return;
    const previous = week;
    const optimistic = { ...week, ...fields } as WeekRow;
    setWeek(optimistic);
    setSaving(true);
    try {
      const saved = await updateWeek(week.id, fields);
      setWeek(saved);
    } catch (err) {
      setWeek(previous);
      setError(errorMessage(err, "Error guardando"));
    } finally {
      setSaving(false);
    }
  }

  function addTopic() {
    const topic = newTopic.trim();
    setNewTopic("");
    setAddingTopic(false);
    if (!topic || !week) return;
    save({ topics: [...week.topics, topic] });
  }

  function removeTopic(topic: string) {
    if (!week) return;
    save({ topics: week.topics.filter((t) => t !== topic) });
  }

  async function handleFile(file: File | undefined) {
    if (!file || !week) return;
    setUploading(true);
    setError("");
    try {
      const { name, url } = await uploadWeekFile(file);
      const resource: WeekResource = { id: crypto.randomUUID(), name, file_path: url };
      await save({ resources: [...week.resources, resource] });
    } catch (err) {
      setError(errorMessage(err, "Error subiendo el archivo"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeFile(resource: WeekResource) {
    if (!week) return;
    setConfirmDeleteFile(null);
    await save({ resources: week.resources.filter((r) => r.id !== resource.id) });
    deleteWeekFile(resource.file_path).catch(() => {
      // el registro ya se quitó; un archivo huérfano en Storage no rompe nada
    });
  }

  if (loading) return <p className="text-muted text-sm">Cargando...</p>;
  if (error && !week) return <p className="text-red-400 text-sm">{error}</p>;
  if (!subject || !week) return <p className="text-muted text-sm">Semana no encontrada.</p>;

  const status = weekStatus(week, todayIso());

  return (
    <div>
      <Link
        to={`/grades/${subjectId}/weeks`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Semanas
      </Link>

      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-5 mb-7">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap mb-2">
            <h1 className="text-2xl font-bold">Semana {week.week_number}</h1>
            {status === "current" && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary text-white">
                En curso
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-border text-xs text-muted">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: subject.color }}
              />
              {subject.name}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <input
              type="date"
              value={week.start_date ?? ""}
              onChange={(e) => save({ start_date: e.target.value || null })}
              className="bg-transparent border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
            />
            <span>–</span>
            <input
              type="date"
              value={week.end_date ?? ""}
              onChange={(e) => save({ end_date: e.target.value || null })}
              className="bg-transparent border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
            />
          </div>
        </div>

        <span className="text-xs text-muted px-3 py-2">
          {saving ? "Guardando..." : "Guardado automático"}
        </span>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="flex flex-wrap items-start gap-6">
        {/* Columna principal */}
        <div className="flex-[999_1_560px] min-w-0 flex flex-col gap-5">
          {/* Temas */}
          <section>
            <h2 className="text-xs font-bold text-muted uppercase tracking-wide mb-2.5">
              Temas de la semana
            </h2>
            <div className="flex flex-wrap gap-2">
              {week.topics.map((topic) => (
                <span
                  key={topic}
                  className="group flex items-center gap-1.5 pl-3.5 pr-2 py-1.5 rounded-full bg-surface border border-border text-sm"
                >
                  {topic}
                  <button
                    onClick={() => removeTopic(topic)}
                    className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-opacity"
                    aria-label={`Quitar ${topic}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {addingTopic ? (
                <input
                  autoFocus
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addTopic();
                    if (e.key === "Escape") setAddingTopic(false);
                  }}
                  onBlur={addTopic}
                  placeholder="Nuevo tema"
                  className="px-3.5 py-1.5 rounded-full bg-background border border-primary text-sm outline-none w-36"
                />
              ) : (
                <button
                  onClick={() => setAddingTopic(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border-[1.5px] border-dashed border-border text-sm text-muted hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar tema
                </button>
              )}
            </div>
          </section>

          {/* Qué se vio en clase */}
          <section className="rounded-2xl bg-surface border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-xs font-bold text-muted uppercase tracking-wide">
                Qué se vio en clase
              </h2>
            </div>
            <div className="p-1">
              <RichTextEditor
                value={week.notes}
                onChange={(html) => save({ notes: html })}
                uploadImage={uploadGradesImage}
                placeholder="Escribí lo que se vio en clase..."
              />
            </div>
          </section>

          {/* Código y ejercicios */}
          <CodeBlock value={week.code} onChange={(code) => save({ code })} placeholder="Código, consultas, ejercicios..." />

          {/* Recursos */}
          <section>
            <h2 className="text-xs font-bold text-muted uppercase tracking-wide mb-2.5">
              Recursos
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {week.resources.map((resource) => {
                const isImage = /\.(png|jpe?g|webp|gif)$/i.test(resource.file_path);
                return (
                  <a
                    key={resource.id}
                    href={resource.file_path}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-2.5 pl-3.5 pr-2 py-2.5 rounded-xl bg-surface border border-border text-sm hover:border-muted transition-colors"
                  >
                    {isImage ? (
                      <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    {resource.name}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setConfirmDeleteFile(resource);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-opacity shrink-0"
                      aria-label={`Eliminar ${resource.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </a>
                );
              })}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border-[1.5px] border-dashed border-border text-sm text-muted hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
              >
                <Paperclip className="w-3.5 h-3.5" />
                {uploading ? "Subiendo..." : "Agregar archivo"}
              </button>
            </div>
          </section>
        </div>

        {/* Panel lateral */}
        <aside className="flex-[1_1_280px] max-w-[320px] min-w-[260px] rounded-2xl bg-surface border border-border p-5 sticky top-6">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="w-[17px] h-[17px] text-primary" />
            <h2 className="text-sm font-bold">Cómo lo usa Claude</h2>
          </div>
          <p className="text-[13px] leading-relaxed text-muted mb-3.5">
            Esto queda disponible para el chat de NEXUS cuando hablás de {subject.name}. Por
            ejemplo, podés escribirle:
          </p>
          <div className="flex flex-col gap-2 mb-4">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <p
                key={prompt}
                className="px-3 py-2.5 rounded-lg bg-surface-hover text-[13px] italic"
              >
                "{prompt}"
              </p>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted border-t border-border pt-3">
            No reemplaza buscar en internet: usa justo lo que guardaste acá, nada más.
          </p>
        </aside>
      </div>

      {confirmDeleteFile && (
        <ConfirmDialog
          title="Eliminar archivo"
          message={`Se elimina "${confirmDeleteFile.name}" de esta semana.`}
          confirmLabel="Eliminar"
          onCancel={() => setConfirmDeleteFile(null)}
          onConfirm={() => removeFile(confirmDeleteFile)}
        />
      )}
    </div>
  );
}
