import { useState } from "react";
import type { ComponentType } from "react";
import {
  Plus,
  CalendarRange,
  LayoutGrid,
  CircleCheck,
  Tags,
  Sparkles,
  Inbox,
  Flame,
  Clapperboard,
} from "lucide-react";
import { useContentStudio } from "./useContentStudio";
import type { IdeaFields } from "./types";
import {
  isDone,
  stepsDone,
  weekKeyOf,
  weekKeyOfISO,
  weekNumber,
  weekRangeLabel,
} from "./types";
import PlannerTab from "./tabs/PlannerTab";
import BoardTab from "./tabs/BoardTab";
import DoneTab from "./tabs/DoneTab";
import CategoriesTab from "./tabs/CategoriesTab";
import IdeaModal from "./components/IdeaModal";

type TabId = "planner" | "ideas" | "done" | "categories";

// What the idea modal is showing: an existing piece, or a new one prefilled
type ModalState = { id: string } | { defaults: Partial<IdeaFields> } | null;

export default function ContentPage() {
  const studio = useContentStudio();
  const { ideas, categories, weeks, loading, error } = studio;

  const [activeTab, setActiveTab] = useState<TabId>("planner");
  const currentWeek = weekKeyOf(new Date());
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [modal, setModal] = useState<ModalState>(null);

  const thisWeek = ideas.filter(
    (i) => i.scheduled_date && weekKeyOfISO(i.scheduled_date) === currentWeek
  );
  const thisWeekDone = thisWeek.filter(isDone).length;
  const inProduction = ideas.filter((i) => !isDone(i) && stepsDone(i) > 0).length;
  const inBank = ideas.filter((i) => !isDone(i) && !i.scheduled_date).length;
  const published = ideas.filter(isDone).length;
  const currentPlan = weeks.find((w) => w.week_key === currentWeek);

  const tabs: { id: TabId; label: string; icon: ComponentType<{ className?: string }>; count?: number }[] = [
    { id: "planner", label: "Planner semanal", icon: CalendarRange },
    { id: "ideas", label: "Tablero de ideas", icon: LayoutGrid, count: ideas.length - published },
    { id: "done", label: "Publicadas", icon: CircleCheck, count: published },
    { id: "categories", label: "Categorías", icon: Tags, count: categories.length },
  ];

  const stats = [
    {
      label: "Esta semana",
      value: `${thisWeekDone}/${thisWeek.length}`,
      hint: thisWeek.length ? "piezas listas" : "sin piezas programadas",
      icon: CalendarRange,
      accent: "#8b5cf6",
      progress: thisWeek.length ? thisWeekDone / thisWeek.length : 0,
    },
    { label: "En producción", value: inProduction, hint: "con guion o grabadas", icon: Clapperboard, accent: "#38bdf8" },
    { label: "Banco de ideas", value: inBank, hint: "sin fecha asignada", icon: Inbox, accent: "#f59e0b" },
    { label: "Publicadas", value: published, hint: "piezas terminadas", icon: Flame, accent: "#34d399" },
  ];

  const openIdea = modal && "id" in modal ? ideas.find((i) => i.id === modal.id) ?? null : null;

  function planThisWeek() {
    setSelectedWeek(currentWeek);
    setActiveTab("planner");
  }

  return (
    <div className="space-y-7">
      {/* ===== Hero ===== */}
      <header className="relative rounded-[28px] border border-border bg-surface overflow-hidden">
        <span className="absolute -top-40 -right-24 w-[520px] h-[520px] rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <span className="absolute -bottom-48 left-1/3 w-[420px] h-[420px] rounded-full bg-fuchsia-500/10 blur-3xl pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at 70% 0%, black 10%, transparent 65%)",
          }}
        />

        <div className="relative px-6 sm:px-9 pt-8 pb-7 space-y-7">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-3 min-w-0">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted">
                <Sparkles className="w-3.5 h-3.5 text-primary-hover" />
                Content Studio · {currentWeek}
              </p>
              <h1 className="text-[40px] sm:text-[56px] font-extrabold tracking-[-0.03em] leading-[0.95]">
                Planner semanal{" "}
                <span className="bg-gradient-to-r from-primary-hover via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                  {weekNumber(currentWeek)}
                </span>
              </h1>
              <p className="text-[15px] text-muted max-w-2xl leading-relaxed">
                {currentPlan?.title ? (
                  <>
                    <span className="text-foreground font-medium">{currentPlan.title}</span> ·{" "}
                  </>
                ) : null}
                Semana del {weekRangeLabel(currentWeek)}. Cada semana es un plan con piezas listas
                para producir: arrastra ideas a los días, escribe el brief y deja que la IA te ayude a llenarla.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => setModal({ defaults: {} })}
                className="flex items-center gap-2 h-12 px-5 rounded-2xl border border-border bg-background/50 hover:border-[#3a3a44] text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nueva idea
              </button>
              <button
                onClick={planThisWeek}
                className="flex items-center gap-2 h-12 px-5 rounded-2xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold shadow-[0_10px_30px_-10px_rgba(139,92,246,0.8)] transition-colors"
              >
                <CalendarRange className="w-4 h-4" />
                Planificar semana
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((st) => {
              const Icon = st.icon;
              return (
                <div
                  key={st.label}
                  className="relative rounded-2xl border border-border bg-background/50 backdrop-blur px-4 py-4 space-y-3 overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-medium text-muted">{st.label}</span>
                    <span
                      className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${st.accent}1f`, color: st.accent }}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                  </div>
                  <div>
                    <p className="text-[30px] font-extrabold tabular-nums leading-none tracking-tight">
                      {loading ? "–" : st.value}
                    </p>
                    <p className="text-xs text-muted mt-1.5">{st.hint}</p>
                  </div>
                  {"progress" in st && (
                    <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(st.progress ?? 0) * 100}%`, backgroundColor: st.accent }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* ===== Tabs ===== */}
      <nav className="flex gap-1.5 p-1.5 rounded-2xl bg-surface border border-border overflow-x-auto no-scrollbar w-fit max-w-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 h-11 rounded-xl text-sm whitespace-nowrap transition-colors ${
                active
                  ? "bg-surface-hover text-foreground font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? "text-primary-hover" : ""}`} />
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`min-w-6 px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums ${
                    active ? "bg-primary/20 text-primary-hover" : "bg-white/5 text-muted"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span>{error}</span>
          <button onClick={studio.clearError} className="text-red-300/70 hover:text-red-200 shrink-0">
            Cerrar
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl border border-border bg-surface animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {activeTab === "planner" && (
            <PlannerTab
              studio={studio}
              selectedWeek={selectedWeek}
              onSelectWeek={setSelectedWeek}
              onOpenIdea={(id) => setModal({ id })}
              onNewIdea={(defaults) => setModal({ defaults })}
            />
          )}
          {activeTab === "ideas" && <BoardTab studio={studio} onOpenIdea={(id) => setModal({ id })} />}
          {activeTab === "done" && <DoneTab studio={studio} onOpenIdea={(id) => setModal({ id })} />}
          {activeTab === "categories" && <CategoriesTab studio={studio} />}
        </>
      )}

      {modal && ("defaults" in modal || openIdea) && (
        <IdeaModal
          key={"id" in modal ? modal.id : "new"}
          idea={openIdea}
          defaults={"defaults" in modal ? modal.defaults : undefined}
          categories={categories}
          onClose={() => setModal(null)}
          onSave={(fields) => {
            if (openIdea) studio.saveIdea(openIdea.id, fields);
            else studio.createIdea(fields);
          }}
          onDelete={openIdea ? () => studio.removeIdea(openIdea.id) : undefined}
        />
      )}
    </div>
  );
}
