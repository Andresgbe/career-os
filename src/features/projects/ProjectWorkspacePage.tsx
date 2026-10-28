import { errorMessage } from "../../lib/errors";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Eye } from "lucide-react";
import { getProject, getProjectAccess, getUnreadCount } from "./api";
import type { ProjectAccess, ProjectRow } from "./types";
import { projectAccent, projectInitials } from "./types";
import ProjectModal from "./components/ProjectModal";
import { useAuth } from "../../hooks/useAuth";
import { usePermissions } from "../../hooks/usePermissions";
import BoardTab from "./tabs/BoardTab";
import MessagesTab from "./tabs/MessagesTab";
import OverviewTab from "./tabs/OverviewTab";
import LinksTab from "./tabs/LinksTab";
import CredentialsTab from "./tabs/CredentialsTab";
import EntriesTab from "./tabs/EntriesTab";
import DesignTab from "./tabs/DesignTab";

type TabId = "board" | "messages" | "overview" | "links" | "credentials" | "entries" | "design";

const ACCESS_LABEL: Record<ProjectAccess, string> = {
  private: "",
  view: "el cliente puede ver este proyecto",
  edit: "el cliente puede editar este proyecto",
};

export default function ProjectWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, canEdit } = usePermissions();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("board");
  const [showEditModal, setShowEditModal] = useState(false);
  const [unread, setUnread] = useState(0);
  const [access, setAccess] = useState<ProjectAccess>("private");

  useEffect(() => {
    if (!id) return;
    getProject(id)
      .then(setProject)
      .catch((e) => setError(errorMessage(e, "No se pudo abrir el proyecto")))
      .finally(() => setLoading(false));
    getUnreadCount(id).then(setUnread).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!isAdmin || !id) return;
    getProjectAccess()
      .then((map) => setAccess(map[id] ?? "private"))
      .catch(() => {});
  }, [isAdmin, id]);

  const clearUnread = useCallback(() => setUnread(0), []);

  if (loading) return <p className="text-sm text-muted">Cargando...</p>;

  if (!project) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl">
            {error}
          </div>
        )}
        <Link to="/projects" className="flex items-center gap-2 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Proyectos
        </Link>
      </div>
    );
  }

  const editable = canEdit("projects");
  const isOwner = project.user_id === user?.id;
  // Credentials are Andrés's working notes: a client never sees them
  const showCredentials = isAdmin || isOwner;
  const accent = projectAccent(project.name);

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: "board", label: "Tablero" },
    { id: "messages", label: "Mensajes", badge: unread },
    { id: "overview", label: "Resumen" },
    { id: "links", label: "Links" },
    ...(showCredentials ? [{ id: "credentials" as const, label: "Credenciales" }] : []),
    { id: "entries", label: "Entradas" },
    { id: "design", label: "Diseño" },
  ];

  return (
    <div className="space-y-5">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Proyectos
      </Link>

      <div className="flex items-center gap-3.5 flex-wrap">
        <span
          className="w-12 h-12 rounded-[13px] flex items-center justify-center font-bold shrink-0"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          {projectInitials(project.name)}
        </span>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">{project.name}</h1>
            {!editable && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-hover border border-[#2c2c34] text-xs text-muted">
                <Eye className="w-3 h-3" />
                Solo lectura
              </span>
            )}
          </div>
          {(project.client || access !== "private") && (
            <p className="text-[13px] text-muted mt-0.5">
              {project.client && `Cliente: ${project.client}`}
              {project.client && access !== "private" && " · "}
              {access !== "private" && <span className="text-emerald-300">{ACCESS_LABEL[access]}</span>}
            </p>
          )}
        </div>
        {editable && (
          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-2 h-10 px-3.5 rounded-xl border border-[#2f2f37] bg-surface text-sm font-medium hover:bg-surface-hover transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Editar proyecto
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl">{error}</div>
      )}

      <div className="flex gap-1 p-1 rounded-xl bg-surface border border-border w-fit max-w-full overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] whitespace-nowrap transition-colors ${
                active
                  ? "bg-surface-hover text-foreground font-semibold"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
              {!!tab.badge && (
                <span className="px-1.5 min-w-[20px] rounded-full bg-primary text-white text-[11px] font-semibold">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "board" && <BoardTab projectId={project.id} canEdit={editable} />}
      {activeTab === "messages" && <MessagesTab projectId={project.id} onRead={clearUnread} />}
      {activeTab === "overview" && <OverviewTab project={project} />}
      {activeTab === "links" && <LinksTab project={project} onProjectChange={setProject} />}
      {activeTab === "credentials" && showCredentials && (
        <CredentialsTab project={project} onProjectChange={setProject} />
      )}
      {activeTab === "entries" && <EntriesTab projectId={project.id} />}
      {activeTab === "design" && <DesignTab projectId={project.id} />}

      {showEditModal && (
        <ProjectModal
          project={project}
          nextSortOrder={0}
          canDelete={isOwner}
          onClose={() => setShowEditModal(false)}
          onSaved={(saved) => {
            setProject(saved);
            setShowEditModal(false);
          }}
          onDeleted={() => navigate("/projects")}
        />
      )}
    </div>
  );
}
