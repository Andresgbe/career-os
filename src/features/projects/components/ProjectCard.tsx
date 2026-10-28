import type { ColumnCount, ProjectAccess, ProjectRow } from "../types";
import { ACCESS_CHIP, projectAccent, projectInitials } from "../types";

interface ProjectCardProps {
  project: ProjectRow;
  columns: ColumnCount[];
  access: ProjectAccess | null; // null = not the admin, so not shown
  onClick: () => void;
}

export default function ProjectCard({ project, columns, access, onClick }: ProjectCardProps) {
  const accent = projectAccent(project.name);
  const links = project.resources.filter((r) => r.type === "link").length;

  return (
    <button
      onClick={onClick}
      className="text-left flex flex-col gap-3.5 p-[18px] rounded-2xl bg-surface border border-border hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start gap-3 w-full">
        <span
          className="w-[42px] h-[42px] rounded-[11px] flex items-center justify-center text-sm font-bold shrink-0"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          {projectInitials(project.name)}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold truncate">{project.name}</h3>
          <p className="text-[13px] text-muted truncate mt-0.5">{project.client || "Sin cliente"}</p>
        </div>
        {access && (
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${ACCESS_CHIP[access].className}`}
          >
            {ACCESS_CHIP[access].label}
          </span>
        )}
      </div>

      {project.description && (
        <p className="text-[13px] text-[#c4c4cc] leading-relaxed line-clamp-2">{project.description}</p>
      )}

      {project.tech_stack.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {project.tech_stack.slice(0, 5).map((tech) => (
            <span
              key={tech}
              className="px-2.5 py-0.5 rounded-full bg-surface-hover border border-[#2c2c34] text-xs text-[#d4d4d8]"
            >
              {tech}
            </span>
          ))}
        </div>
      )}

      {columns.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {columns.map((c, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#131317] border border-border text-xs text-[#d4d4d8]"
            >
              <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: c.color }} />
              {c.name}
              <span className="font-bold text-foreground">{c.count}</span>
            </span>
          ))}
        </div>
      )}

      {links > 0 && (
        <p className="text-xs text-muted border-t border-border pt-3 w-full">{links} links</p>
      )}
    </button>
  );
}
