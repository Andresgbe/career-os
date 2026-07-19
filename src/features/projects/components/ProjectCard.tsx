import { CheckSquare, DollarSign, FolderKanban, Paperclip } from "lucide-react";
import type { ProjectRow } from "../types";
import { PAYMENT_STATUSES, PROJECT_STATUSES } from "../types";

const PAYMENT_STYLE: Record<ProjectRow["payment_status"], string> = {
  unpaid: "text-red-400 bg-red-400/10",
  partial: "text-amber-400 bg-amber-400/10",
  paid: "text-emerald-400 bg-emerald-400/10",
};

interface ProjectCardProps {
  project: ProjectRow;
  onClick: () => void;
}

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
  const doneMilestones = project.milestones.filter((m) => m.done).length;
  const paymentLabel = PAYMENT_STATUSES.find(
    (p) => p.value === project.payment_status
  )?.label;
  const status = PROJECT_STATUSES.find((s) => s.value === project.status)!;

  return (
    <div
      onClick={onClick}
      className="group bg-surface border border-border rounded-xl p-5 hover:border-primary transition-all cursor-pointer hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-lg bg-primary/10">
          <FolderKanban className="w-6 h-6 text-primary" />
        </div>
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.bg} ${status.color}`}
        >
          {status.label}
        </span>
      </div>

      <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors truncate">
        {project.name}
      </h3>
      {project.client && (
        <p className="text-sm text-muted truncate mb-2">{project.client}</p>
      )}

      {project.description && (
        <p className="text-sm text-muted line-clamp-2 mb-3">
          {project.description}
        </p>
      )}

      {project.tech_stack.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {project.tech_stack.slice(0, 5).map((tech, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 bg-surface-hover rounded text-muted"
            >
              {tech}
            </span>
          ))}
          {project.tech_stack.length > 5 && (
            <span className="text-[10px] px-1.5 py-0.5 text-muted">
              +{project.tech_stack.length - 5}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center flex-wrap gap-3 pt-3 border-t border-border text-xs text-muted">
        {project.milestones.length > 0 && (
          <span className="flex items-center gap-1">
            <CheckSquare className="w-3.5 h-3.5" />
            {doneMilestones}/{project.milestones.length}
          </span>
        )}
        {project.resources.length > 0 && (
          <span className="flex items-center gap-1">
            <Paperclip className="w-3.5 h-3.5" />
            {project.resources.length}
          </span>
        )}
        {project.budget !== null && (
          <span
            className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded font-medium ${PAYMENT_STYLE[project.payment_status]}`}
            title={paymentLabel}
          >
            <DollarSign className="w-3.5 h-3.5" />
            {project.budget.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
