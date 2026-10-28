import type { ColumnCount, ProjectAccess, ProjectRow } from "../types";
import { ACCESS_CHIP, projectAccent, projectInitials } from "../types";

interface ProjectTableProps {
  projects: ProjectRow[];
  boards: Record<string, ColumnCount[]>;
  access: Record<string, ProjectAccess> | null; // null = not the admin
  onOpen: (project: ProjectRow) => void;
}

// Denser view of the same projects: one row each, easier to scan.
export default function ProjectTable({ projects, boards, access, onOpen }: ProjectTableProps) {
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm text-left">
        <thead className="text-xs text-muted uppercase border-b border-border">
          <tr>
            <th className="px-4 py-3 font-medium">Proyecto</th>
            <th className="px-4 py-3 font-medium">Stack</th>
            <th className="px-4 py-3 font-medium">Tablero</th>
            {access && <th className="px-4 py-3 font-medium">Acceso</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {projects.map((project) => {
            const accent = projectAccent(project.name);
            const columns = boards[project.id] ?? [];
            const level = access?.[project.id] ?? "private";
            return (
              <tr
                key={project.id}
                onClick={() => onOpen(project)}
                className="hover:bg-surface-hover/60 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: `${accent}22`, color: accent }}
                    >
                      {projectInitials(project.name)}
                    </span>
                    <span className="font-medium">{project.name}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">
                  {project.tech_stack.slice(0, 3).join(", ") || "—"}
                </td>
                <td className="px-4 py-3">
                  {columns.length === 0 ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <span className="flex gap-3 text-xs text-muted">
                      {columns.map((c, i) => (
                        <span key={i} className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: c.color }} />
                          <span className="font-semibold text-foreground">{c.count}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </td>
                {access && (
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${ACCESS_CHIP[level].className}`}>
                      {ACCESS_CHIP[level].label}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
