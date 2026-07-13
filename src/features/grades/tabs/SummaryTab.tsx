import type { SubjectRow, EvaluationRow } from "../types";
import { getSubjectTotal, MAX_GRADE } from "../types";

interface SummaryTabProps {
  subjects: SubjectRow[];
  evaluations: EvaluationRow[];
}

export default function SummaryTab({ subjects, evaluations }: SummaryTabProps) {
  if (subjects.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted">
        No subjects yet. Create subjects to see a summary here.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {subjects.map((sub) => {
        const subjectEvals = evaluations.filter((ev) => ev.subject_id === sub.id);
        const totalEarned = getSubjectTotal(subjectEvals);
        const totalWeight = subjectEvals.reduce((acc, ev) => acc + ev.weight, 0);
        const currentMaxPts = MAX_GRADE * (totalWeight / 100);

        // Color coding
        let scoreColor = "text-emerald-400"; // >= 15
        if (totalEarned < 10) {
          scoreColor = "text-red-400"; // Failed
        } else if (totalEarned < 15) {
          scoreColor = "text-amber-400"; // Passed, but not excellent
        }

        return (
          <div
            key={sub.id}
            className="bg-surface border border-border rounded-xl p-5 flex flex-col h-full hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3 mb-4">
              <span
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: sub.color }}
              />
              <h3 className="font-bold text-lg truncate flex-1">{sub.name}</h3>
            </div>

            <div className="flex-1 mb-6">
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm text-muted">Current Grade</span>
                <div className="text-right">
                  <span className={`text-3xl font-bold ${scoreColor}`}>
                    {totalEarned.toFixed(2)}
                  </span>
                  <span className="text-sm text-muted"> / {MAX_GRADE}</span>
                </div>
              </div>
              <div className="text-xs text-muted text-right">
                Based on {totalWeight}% evaluated
              </div>
            </div>

            <div className="space-y-2 mt-auto">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-muted">Max Potential Grade:</span>
                <span>
                  {totalWeight === 100
                    ? totalEarned.toFixed(2)
                    : (totalEarned + (MAX_GRADE - currentMaxPts)).toFixed(2)}
                </span>
              </div>
              
              {/* Progress bar visualizing points */}
              <div className="h-2.5 w-full bg-surface-hover rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${(totalEarned / MAX_GRADE) * 100}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
