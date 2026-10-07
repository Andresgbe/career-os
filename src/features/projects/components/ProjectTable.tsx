import { DollarSign, Paperclip, CheckSquare, ListTodo } from "lucide-react";
import type { ProjectRow } from "../types";
import { PAYMENT_STATUSES } from "../types";

const PAYMENT_STYLE: Record<ProjectRow["payment_status"], string> = {
  unpaid: "text-red-400 bg-red-400/10",
  partial: "text-amber-400 bg-amber-400/10",
  paid: "text-emerald-400 bg-emerald-400/10",
};

interface ProjectTableProps {
  projects: ProjectRow[];
  openTaskCount: Record<string, number>;
  onOpen: (project: ProjectRow) => void;
}

// Notion-style database view: one row per project with its properties as
// columns, denser than the card grid and easier to scan across projects.
export default function ProjectTable({
  projects,
  openTaskCount,
  onOpen,
}: ProjectTableProps) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm text-left">
        <thead className="text-xs text-muted uppercase border-b border-border">
          <tr>
            <th className="px-4 py-2.5 font-medium">Proyecto</th>
            <th className="px-4 py-2.5 font-medium">Cliente</th>
            <th className="px-4 py-2.5 font-medium">Stack</th>
            <th className="px-4 py-2.5 font-medium">Tareas</th>
            <th className="px-4 py-2.5 font-medium">Hitos</th>
            <th className="px-4 py-2.5 font-medium">Archivos</th>
            <th className="px-4 py-2.5 font-medium text-right">Presupuesto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {projects.map((project) => {
            const doneMilestones = project.milestones.filter((m) => m.done).length;
            const openTasks = openTaskCount[project.id] ?? 0;
            const paymentLabel = PAYMENT_STATUSES.find(
              (p) => p.value === project.payment_status
            )?.label;

            return (
              <tr
                key={project.id}
                onClick={() => onOpen(project)}
                className="hover:bg-surface-hover/60 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <span className="font-medium">{project.name}</span>
                  {project.description && (
                    <span className="block text-xs text-muted truncate max-w-[280px]">
                      {project.description}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{project.client || "—"}</td>
                <td className="px-4 py-3">
                  {project.tech_stack.length === 0 ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {project.tech_stack.slice(0, 3).map((tech, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 bg-surface-hover rounded text-muted"
                        >
                          {tech}
                        </span>
                      ))}
                      {project.tech_stack.length > 3 && (
                        <span className="text-[10px] text-muted">
                          +{project.tech_stack.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {openTasks > 0 ? (
                    <span className="flex items-center gap-1 text-muted">
                      <ListTodo className="w-3.5 h-3.5" />
                      {openTasks}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">
                  {project.milestones.length > 0 ? (
                    <span className="flex items-center gap-1">
                      <CheckSquare className="w-3.5 h-3.5" />
                      {doneMilestones}/{project.milestones.length}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-muted">
                  {project.resources.length > 0 ? (
                    <span className="flex items-center gap-1">
                      <Paperclip className="w-3.5 h-3.5" />
                      {project.resources.length}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {project.budget === null ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${PAYMENT_STYLE[project.payment_status]}`}
                      title={paymentLabel}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      {project.budget.toLocaleString()}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
