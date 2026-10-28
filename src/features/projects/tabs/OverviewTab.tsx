import type { ProjectRow } from "../types";

interface OverviewTabProps {
  project: ProjectRow;
}

// What the project is about and what it's built with. Day-to-day work lives
// on the board, not here.
export default function OverviewTab({ project }: OverviewTabProps) {
  const empty = !project.description && project.tech_stack.length === 0;

  return (
    <div className="rounded-2xl bg-surface border border-border p-5 sm:p-6 space-y-5">
      {project.description && (
        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-muted font-semibold">Descripción</h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{project.description}</p>
        </section>
      )}

      {project.tech_stack.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-muted font-semibold">Stack</h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            {project.tech_stack.map((tech) => (
              <span
                key={tech}
                className="text-xs px-2.5 py-1 rounded-full bg-surface-hover border border-[#2c2c34] text-[#d4d4d8]"
              >
                {tech}
              </span>
            ))}
          </div>
        </section>
      )}

      {empty && (
        <p className="text-sm text-muted">
          Sin detalles todavía. Usa "Editar proyecto" para agregar una descripción y el stack.
        </p>
      )}
    </div>
  );
}
