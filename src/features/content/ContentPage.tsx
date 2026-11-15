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
  BrainCircuit,
  ChevronUp,
  ChevronDown,
  Send,
  BarChart3,
} from "lucide-react";
import ContextLibrary from "../../components/ContextLibrary";
import { CONTENT_CONTEXT_SECTION, CONTENT_CONTEXT_STARTER } from "./contextTemplates";
import { useContentStudio } from "./useContentStudio";
import type { IdeaFields } from "./types";
import {
  isDone,
  stepsDone,
  weekKeyOf,
  weekKeyOfISO,
  weekNumber,
} from "./types";
import PlannerTab from "./tabs/PlannerTab";
import BoardTab from "./tabs/BoardTab";
import DoneTab from "./tabs/DoneTab";
import CategoriesTab from "./tabs/CategoriesTab";
import IdeaModal from "./components/IdeaModal";
import MarkPostedDialog from "./components/MarkPostedDialog";
import PublishedTab from "./tabs/PublishedTab";
import StatsTab from "./tabs/StatsTab";

type TabId = "planner" | "ideas" | "done" | "published" | "stats" | "categories" | "context";

// What the idea modal is showing: an existing piece, or a new one prefilled
type ModalState = { id: string } | { defaults: Partial<IdeaFields> } | null;

export default function ContentPage() {
  const studio = useContentStudio();
  const { ideas, categories, loading, error } = studio;

  const [activeTab, setActiveTab] = useState<TabId>("planner");
  const currentWeek = weekKeyOf(new Date());
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [modal, setModal] = useState<ModalState>(null);
  const [postingId, setPostingId] = useState<string | null>(null);

  const thisWeek = ideas.filter(
    (i) => i.scheduled_date && weekKeyOfISO(i.scheduled_date) === currentWeek
  );
  const thisWeekDone = thisWeek.filter(isDone).length;
  const inProduction = ideas.filter((i) => !isDone(i) && stepsDone(i) > 0).length;
  const inBank = ideas.filter((i) => !isDone(i) && !i.scheduled_date && !i.do_not_publish).length;
  const finished = ideas.filter(isDone).length;
  // Finished but not posted yet (and not marked do-not-publish)
  const readyToPost = ideas.filter((i) => isDone(i) && !i.do_not_publish && !studio.publishedIds.has(i.id)).length;
  const postedPieces = studio.publishedIds.size;

  const tabs: { id: TabId; label: string; icon: ComponentType<{ className?: string }>; count?: number }[] = [
    { id: "planner", label: "Planner", icon: CalendarRange },
    { id: "ideas", label: "Idea board", icon: LayoutGrid, count: ideas.length - finished },
    { id: "done", label: "Finished", icon: CircleCheck, count: readyToPost },
    { id: "published", label: "Published", icon: Send, count: postedPieces },
    { id: "stats", label: "Stats", icon: BarChart3 },
    { id: "categories", label: "Categories", icon: Tags, count: categories.length },
    { id: "context", label: "AI context", icon: BrainCircuit },
  ];

  const stats = [
    {
      label: "This week",
      value: `${thisWeekDone}/${thisWeek.length}`,
      hint: thisWeek.length ? "pieces ready" : "nothing scheduled yet",
      icon: CalendarRange,
      accent: "#8b5cf6",
      progress: thisWeek.length ? thisWeekDone / thisWeek.length : 0,
    },
    { label: "In production", value: inProduction, hint: "scripted or recorded", icon: Clapperboard, accent: "#38bdf8" },
    { label: "Idea bank", value: inBank, hint: "no date yet", icon: Inbox, accent: "#f59e0b" },
    { label: "Ready to post", value: readyToPost, hint: `${postedPieces} already posted`, icon: Flame, accent: "#34d399" },
  ];

  const openIdea = modal && "id" in modal ? ideas.find((i) => i.id === modal.id) ?? null : null;

  // The hero can be minimized to a slim bar; the choice is remembered per browser
  const [heroCollapsed, setHeroCollapsed] = useState(() => {
    try {
      return localStorage.getItem("content-hero-collapsed") === "1";
    } catch {
      return false;
    }
  });
  function toggleHero(collapsed: boolean) {
    setHeroCollapsed(collapsed);
    try {
      localStorage.setItem("content-hero-collapsed", collapsed ? "1" : "0");
    } catch {
      /* storage blocked */
    }
  }

  function planThisWeek() {
    setSelectedWeek(currentWeek);
    setActiveTab("planner");
  }

  return (
    <div className="space-y-7">
      {/* ===== Hero ===== */}
      <header
        className={`relative border border-border bg-surface overflow-hidden ${heroCollapsed ? "rounded-2xl" : "rounded-[28px]"}`}
      >
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

        {heroCollapsed ? (
          /* Minimized: one slim bar with the title, the numbers and the actions */
          <div className="relative px-5 sm:px-6 py-3 flex items-center gap-x-5 gap-y-2 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <Sparkles className="w-4 h-4 text-primary-hover shrink-0" />
              <span className="text-lg font-extrabold tracking-tight whitespace-nowrap">
                Weekly planner{" "}
                <span className="bg-gradient-to-r from-primary-hover via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                  {weekNumber(currentWeek)}
                </span>
              </span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 flex-wrap">
              {stats.map((st) => (
                <span
                  key={st.label}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-background/50 border border-border text-xs text-muted whitespace-nowrap"
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: st.accent }} />
                  {st.label}
                  <span className="font-bold text-foreground tabular-nums">{loading ? "–" : st.value}</span>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setModal({ defaults: {} })}
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-background/50 hover:border-[#3a3a44] text-[13px] font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New idea</span>
              </button>
              <button
                onClick={planThisWeek}
                className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-[13px] font-semibold transition-colors"
              >
                <CalendarRange className="w-4 h-4" />
                <span className="hidden sm:inline">Plan this week</span>
              </button>
              <button
                onClick={() => toggleHero(false)}
                className="w-9 h-9 rounded-xl border border-border bg-background/50 flex items-center justify-center text-muted hover:text-foreground hover:border-[#3a3a44] transition-colors"
                aria-label="Expand header"
                title="Expand"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
        <div className="relative px-6 sm:px-9 pt-8 pb-7 space-y-7">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-3 min-w-0">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted">
                <Sparkles className="w-3.5 h-3.5 text-primary-hover" />
                Content Studio · {currentWeek}
              </p>
              <h1 className="text-[40px] sm:text-[56px] font-extrabold tracking-[-0.03em] leading-[0.95]">
                Weekly planner{" "}
                <span className="bg-gradient-to-r from-primary-hover via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                  {weekNumber(currentWeek)}
                </span>
              </h1>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => setModal({ defaults: {} })}
                className="flex items-center gap-2 h-12 px-5 rounded-2xl border border-border bg-background/50 hover:border-[#3a3a44] text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                New idea
              </button>
              <button
                onClick={planThisWeek}
                className="flex items-center gap-2 h-12 px-5 rounded-2xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold shadow-[0_10px_30px_-10px_rgba(139,92,246,0.8)] transition-colors"
              >
                <CalendarRange className="w-4 h-4" />
                Plan this week
              </button>
              <button
                onClick={() => toggleHero(true)}
                className="w-12 h-12 rounded-2xl border border-border bg-background/50 flex items-center justify-center text-muted hover:text-foreground hover:border-[#3a3a44] transition-colors"
                aria-label="Minimize header"
                title="Minimize"
              >
                <ChevronUp className="w-5 h-5" />
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
        )}
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
            Dismiss
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
          {activeTab === "done" && (
            <DoneTab studio={studio} onOpenIdea={(id) => setModal({ id })} onMarkPosted={setPostingId} />
          )}
          {activeTab === "published" && <PublishedTab studio={studio} onOpenIdea={(id) => setModal({ id })} />}
          {activeTab === "stats" && <StatsTab studio={studio} onOpenIdea={(id) => setModal({ id })} />}
          {activeTab === "categories" && <CategoriesTab studio={studio} />}
          {activeTab === "context" && (
            <ContextLibrary
              section={CONTENT_CONTEXT_SECTION}
              starter={CONTENT_CONTEXT_STARTER}
              lang="en"
              starterLabel="Create context folders"
              emptyText="Give the AI some context"
              aiHint={
                <>
                  These docs are your content's memory: voice, audience, pillars, formats and learnings. Claude reads
                  them with the{" "}
                  <code className="font-mono text-primary-hover">get_content_context</code> tool before planning a
                  week or writing a script. Fill them in over time, or ask Claude to update them.
                </>
              }
            />
          )}
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
            if (openIdea) {
              if (Object.keys(fields).length) studio.saveIdea(openIdea.id, fields);
            } else studio.createIdea({ ...fields, title: fields.title ?? "" });
          }}
          onDelete={openIdea ? () => studio.removeIdea(openIdea.id) : undefined}
          publications={openIdea ? studio.publications.filter((p) => p.idea_id === openIdea.id) : undefined}
          onMarkPosted={openIdea && studio.publicationsReady ? () => setPostingId(openIdea.id) : undefined}
        />
      )}
      {postingId && studio.ideas.find((i) => i.id === postingId) && (
        <MarkPostedDialog
          idea={studio.ideas.find((i) => i.id === postingId)!}
          onConfirm={(entries) => studio.markPosted(postingId, entries)}
          onClose={() => setPostingId(null)}
        />
      )}
    </div>
  );
}
