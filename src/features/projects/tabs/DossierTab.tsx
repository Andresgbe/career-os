import { useEffect, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Pencil,
  Receipt,
  Trash2,
} from "lucide-react";
import ConfirmDialog from "../../../components/ConfirmDialog";
import { errorMessage } from "../../../lib/errors";
import {
  addDossierSection,
  deleteDossierSection,
  getDossierSections,
  reorderDossierSections,
  updateDossierSection,
} from "../api";
import DossierContent from "../components/DossierContent";
import DossierPayments from "../components/DossierPayments";
import type { DossierKind, DossierSectionRow } from "../types";

interface DossierTabProps {
  projectId: string;
  // The admin builds it. Everyone else only reads the blocks shown to them.
  canManage: boolean;
}

const DEFAULT_TITLE: Record<DossierKind, string> = {
  content: "Documentos",
  payments: "Pagos",
};

export default function DossierTab({ projectId, canManage }: DossierTabProps) {
  const [sections, setSections] = useState<DossierSectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [toDelete, setToDelete] = useState<DossierSectionRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDossierSections(projectId)
      .then((rows) => {
        if (!cancelled) setSections(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, "No se pudo cargar el expediente"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const addSection = async (kind: DossierKind) => {
    setError("");
    try {
      const row = await addDossierSection(projectId, kind, DEFAULT_TITLE[kind], sections.length);
      setSections((prev) => [...prev, row]);
      setRenameId(row.id);
      setRenameDraft(row.title);
    } catch (err) {
      setError(errorMessage(err, "No se pudo crear el bloque"));
    }
  };

  const updateSection = async (
    id: string,
    fields: Partial<Pick<DossierSectionRow, "title" | "body" | "files" | "visible_to_client">>
  ) => {
    const prev = sections;
    setSections((list) => list.map((s) => (s.id === id ? { ...s, ...fields } : s)));
    try {
      await updateDossierSection(id, fields);
      return true;
    } catch (err) {
      setSections(prev);
      setError(errorMessage(err, "No se pudo guardar el cambio"));
      return false;
    }
  };

  const commitRename = (section: DossierSectionRow) => {
    const title = renameDraft.trim();
    setRenameId(null);
    if (title && title !== section.title) updateSection(section.id, { title });
  };

  const confirmDelete = async () => {
    const section = toDelete;
    setToDelete(null);
    if (!section) return;
    const prev = sections;
    setSections((list) => list.filter((s) => s.id !== section.id));
    try {
      await deleteDossierSection(section);
    } catch (err) {
      setSections(prev);
      setError(errorMessage(err, "No se pudo eliminar el bloque"));
    }
  };

  const onDragEnd = async ({ source, destination }: DropResult) => {
    if (!destination || source.index === destination.index) return;
    const prev = sections;
    const next = [...sections];
    const [moved] = next.splice(source.index, 1);
    next.splice(destination.index, 0, moved);
    setSections(next);
    try {
      await reorderDossierSections(next.map((s, i) => ({ id: s.id, sort_order: i })));
    } catch (err) {
      setSections(prev);
      setError(errorMessage(err, "No se pudo reordenar"));
    }
  };

  const toggleCollapsed = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) return <p className="text-sm text-muted">Cargando...</p>;

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-muted flex-1 min-w-[220px]">
            Contratos, documentos, notas y pagos. El cliente solo ve los bloques que le muestres, y
            nunca puede modificarlos.
          </p>
          <button
            onClick={() => addSection("content")}
            className="flex items-center gap-2 h-10 px-3.5 rounded-xl border border-border bg-surface text-sm font-medium hover:bg-surface-hover transition-colors"
          >
            <FileText className="w-4 h-4" />
            Documentos y notas
          </button>
          <button
            onClick={() => addSection("payments")}
            className="flex items-center gap-2 h-10 px-3.5 rounded-xl border border-border bg-surface text-sm font-medium hover:bg-surface-hover transition-colors"
          >
            <Receipt className="w-4 h-4" />
            Pagos
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {sections.length === 0 && !error && (
        <p className="py-10 text-center text-sm text-muted rounded-2xl border border-dashed border-border">
          {canManage
            ? "Todavía no hay bloques. Crea uno con los botones de arriba."
            : "Todavía no hay nada aquí."}
        </p>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="dossier-sections">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
              {sections.map((section, index) => {
                const isCollapsed = collapsed.has(section.id);
                const Icon = section.kind === "payments" ? Receipt : FileText;
                return (
                  <Draggable
                    key={section.id}
                    draggableId={section.id}
                    index={index}
                    isDragDisabled={!canManage}
                  >
                    {(dragProvided, snapshot) => (
                      <section
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={`bg-surface border rounded-xl p-4 sm:p-5 ${
                          snapshot.isDragging
                            ? "border-primary/60 shadow-lg shadow-black/40"
                            : "border-border"
                        }`}
                      >
                        <div className={`flex items-center gap-2 ${isCollapsed ? "" : "mb-3"}`}>
                          {canManage && (
                            <span
                              {...dragProvided.dragHandleProps}
                              className="p-1 -ml-1 rounded text-muted hover:text-foreground cursor-grab"
                              title="Arrastrar bloque"
                            >
                              <GripVertical className="w-4 h-4" />
                            </span>
                          )}
                          <Icon className="w-4 h-4 text-primary-hover shrink-0" />
                          {renameId === section.id ? (
                            <>
                              <input
                                autoFocus
                                value={renameDraft}
                                onChange={(e) => setRenameDraft(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                onBlur={() => commitRename(section)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitRename(section);
                                  if (e.key === "Escape") setRenameId(null);
                                }}
                                placeholder="Nombre del bloque (ej. Contrato)"
                                className="flex-1 min-w-0 bg-background border border-primary rounded-lg px-3 py-1 text-sm outline-none"
                              />
                              <button
                                onClick={() => commitRename(section)}
                                className="p-1.5 rounded text-emerald-400 hover:bg-surface-hover shrink-0"
                                aria-label="Guardar nombre"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => toggleCollapsed(section.id)}
                              className="flex-1 min-w-0 text-left font-semibold text-sm uppercase tracking-wide truncate"
                            >
                              {section.title || "Sin nombre"}
                            </button>
                          )}

                          {canManage && (
                            <>
                              <button
                                onClick={() =>
                                  updateSection(section.id, {
                                    visible_to_client: !section.visible_to_client,
                                  })
                                }
                                aria-pressed={section.visible_to_client}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                                  section.visible_to_client
                                    ? "bg-emerald-400/15 text-emerald-300"
                                    : "bg-surface-hover text-muted hover:text-foreground"
                                }`}
                                title={
                                  section.visible_to_client
                                    ? "El cliente lo ve. Clic para ocultarlo."
                                    : "El cliente no lo ve. Clic para mostrárselo."
                                }
                              >
                                {section.visible_to_client ? (
                                  <Eye className="w-3.5 h-3.5" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5" />
                                )}
                                <span className="hidden sm:inline">
                                  {section.visible_to_client ? "Lo ve el cliente" : "Oculto"}
                                </span>
                              </button>
                              <button
                                onClick={() => {
                                  setRenameId(section.id);
                                  setRenameDraft(section.title);
                                }}
                                className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-primary shrink-0"
                                title="Renombrar"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setToDelete(section)}
                                className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-red-400 shrink-0"
                                title="Eliminar bloque"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => toggleCollapsed(section.id)}
                            className="p-1.5 rounded text-muted hover:bg-surface-hover hover:text-foreground shrink-0"
                            title={isCollapsed ? "Expandir" : "Minimizar"}
                            aria-expanded={!isCollapsed}
                          >
                            <ChevronDown
                              className={`w-4 h-4 transition-transform ${
                                isCollapsed ? "-rotate-90" : ""
                              }`}
                            />
                          </button>
                        </div>

                        {!isCollapsed &&
                          (section.kind === "payments" ? (
                            <DossierPayments sectionId={section.id} canManage={canManage} />
                          ) : (
                            <DossierContent
                              section={section}
                              canManage={canManage}
                              onUpdate={(fields) => updateSection(section.id, fields)}
                            />
                          ))}
                      </section>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {toDelete && (
        <ConfirmDialog
          title="Eliminar bloque"
          message={`Se elimina "${toDelete.title || "este bloque"}" con todo lo que tiene adentro.`}
          confirmLabel="Eliminar"
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
