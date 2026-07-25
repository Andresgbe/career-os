import { useState } from "react";
import { CheckSquare, Square, DollarSign } from "lucide-react";
import { updateProjectMilestones } from "../api";
import type { ProjectRow } from "../types";
import { PAYMENT_STATUSES } from "../types";

const PAYMENT_STYLE: Record<ProjectRow["payment_status"], string> = {
  unpaid: "text-red-400 bg-red-400/10",
  partial: "text-amber-400 bg-amber-400/10",
  paid: "text-emerald-400 bg-emerald-400/10",
};

interface OverviewTabProps {
  project: ProjectRow;
  onProjectChange: (project: ProjectRow) => void;
}

export default function OverviewTab({ project, onProjectChange }: OverviewTabProps) {
  const [error, setError] = useState("");
  const paymentLabel = PAYMENT_STATUSES.find(
    (p) => p.value === project.payment_status
  )?.label;

  const toggleMilestone = async (id: string) => {
    const milestones = project.milestones.map((m) =>
      m.id === id ? { ...m, done: !m.done } : m
    );
    onProjectChange({ ...project, milestones });
    try {
      await updateProjectMilestones(project.id, milestones);
    } catch (err) {
      onProjectChange(project);
      setError(err instanceof Error ? err.message : "Error updating milestone");
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 space-y-6">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {project.description && (
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {project.description}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {(project.budget !== null || project.payment_status !== "unpaid") && (
          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${PAYMENT_STYLE[project.payment_status]}`}
          >
            <DollarSign className="w-4 h-4" />
            {project.budget !== null ? project.budget.toLocaleString() : "—"}
            <span className="text-xs font-normal opacity-80">({paymentLabel})</span>
          </span>
        )}
        {project.tech_stack.map((tech) => (
          <span
            key={tech}
            className="text-xs px-2 py-1 bg-surface-hover rounded-full text-foreground"
          >
            {tech}
          </span>
        ))}
      </div>

      {project.milestones.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-muted font-semibold mb-2">
            Milestones
          </h3>
          <ul className="space-y-1.5">
            {project.milestones.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => toggleMilestone(m.id)}
                  className="flex items-center gap-2 text-sm w-full text-left"
                >
                  {m.done ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-muted shrink-0" />
                  )}
                  <span className={m.done ? "text-muted line-through" : "text-foreground"}>
                    {m.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!project.description && project.milestones.length === 0 && project.tech_stack.length === 0 && (
        <p className="text-sm text-muted">
          No details yet — click Edit to add a description, budget, tech stack, or milestones.
        </p>
      )}
    </div>
  );
}
