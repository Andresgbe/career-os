import { CheckSquare, FolderKanban, Paperclip, ListTodo } from "lucide-react";
import type { ProjectRow } from "../types";

interface ProjectCardProps {
  project: ProjectRow;
  openTasks: number;
  onClick: () => void;
}

export default function ProjectCard({
  project,
  openTasks,
  onClick,
}: ProjectCardProps) {
  const doneMilestones = project.milestones.filter((m) => m.done).length;

  return (
    <div
      onClick={onClick}
      className="group bg-surface border border-border rounded-xl p-5 hover:border-primary transition-all cursor-pointer hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-lg bg-primary/10">
          <FolderKanban className="w-6 h-6 text-primary" />
        </div>
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
        {openTasks > 0 && (
          <span className="flex items-center gap-1">
            <ListTodo className="w-3.5 h-3.5" />
            {openTasks}
          </span>
        )}
        {project.resources.length > 0 && (
          <span className="flex items-center gap-1">
            <Paperclip className="w-3.5 h-3.5" />
            {project.resources.length}
          </span>
        )}
      </div>
    </div>
  );
}
