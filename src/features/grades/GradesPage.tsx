import { useEffect, useState } from "react";
import { BookOpen, LineChart, Workflow } from "lucide-react";
import SubjectsTab from "./tabs/SubjectsTab";
import SummaryTab from "./tabs/SummaryTab";
import CurriculumTab from "./tabs/CurriculumTab";
import ShortcutsBar from "../../components/ShortcutsBar";
import {
  getSubjects,
  getEvaluations,
  getGradesShortcuts,
  addGradesShortcut,
  deleteGradesShortcut,
  reorderGradesShortcuts,
  uploadShortcutIcon,
} from "./api";
import type { SubjectRow, EvaluationRow, GradesShortcutRow } from "./types";

const TABS = [
  { id: "subjects", label: "Subjects & Grades", icon: BookOpen },
  { id: "summary", label: "Summary", icon: LineChart },
  { id: "curriculum", label: "Malla Curricular", icon: Workflow },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function GradesPage() {
  const [activeTab, setActiveTab] = useState<TabId>("subjects");
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shortcuts, setShortcuts] = useState<GradesShortcutRow[]>([]);
  const [shortcutsLoading, setShortcutsLoading] = useState(true);
  const [shortcutsError, setShortcutsError] = useState("");

  useEffect(() => {
    Promise.all([getSubjects(), getEvaluations()])
      .then(([subs, evals]) => {
        setSubjects(subs);
        setEvaluations(evals);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getGradesShortcuts()
      .then(setShortcuts)
      .catch((e) => setShortcutsError(e.message))
      .finally(() => setShortcutsLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl">
          {error}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border pb-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px border-b-2 ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Shortcuts */}
      {shortcutsError && (
        <p className="text-sm text-red-400">{shortcutsError}</p>
      )}
      {!shortcutsLoading && (
        <ShortcutsBar
          items={shortcuts}
          size="lg"
          addShortcut={addGradesShortcut}
          deleteShortcut={deleteGradesShortcut}
          reorderShortcuts={reorderGradesShortcuts}
          uploadIcon={uploadShortcutIcon}
          onAdded={(item) => setShortcuts((prev) => [...prev, item])}
          onDeleted={(id) =>
            setShortcuts((prev) => prev.filter((s) => s.id !== id))
          }
          onReordered={setShortcuts}
        />
      )}

      {/* Tab content */}
      {loading ? (
        <p className="text-muted text-sm">Loading...</p>
      ) : (
        <>
          {activeTab === "subjects" && (
            <SubjectsTab
              subjects={subjects}
              evaluations={evaluations}
              onSubjectsChange={setSubjects}
              onEvaluationsChange={setEvaluations}
            />
          )}
          {activeTab === "summary" && (
            <SummaryTab subjects={subjects} evaluations={evaluations} />
          )}
          {activeTab === "curriculum" && <CurriculumTab />}
        </>
      )}
    </div>
  );
}
