import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  LayoutDashboard,
  Link2,
  KeyRound,
  Image as ImageIcon,
  NotebookText,
} from "lucide-react";
import { getProject, deleteProject } from "./api";
import type { ProjectRow } from "./types";
import { PROJECT_STATUSES } from "./types";
import ProjectModal from "./components/ProjectModal";
import ConfirmDialog from "./components/ConfirmDialog";
import OverviewTab from "./tabs/OverviewTab";
import LinksTab from "./tabs/LinksTab";
import CredentialsTab from "./tabs/CredentialsTab";
import ImagesTab from "./tabs/ImagesTab";
import EntriesTab from "./tabs/EntriesTab";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "links", label: "Links", icon: Link2 },
  { id: "credentials", label: "Credentials", icon: KeyRound },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "entries", label: "Entries", icon: NotebookText },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ProjectWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [showEditModal, setShowEditModal] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    getProject(id)
      .then(setProject)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!project) return;
    try {
      await deleteProject(project.id);
      navigate("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setConfirmingDelete(false);
    }
  };

  if (loading) return <p className="text-sm text-muted">Loading...</p>;

  if (!project) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl">
            {error}
          </div>
        )}
        <button
          onClick={() => navigate("/projects")}
          className="flex items-center gap-2 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to projects
        </button>
      </div>
    );
  }

  const status = PROJECT_STATUSES.find((s) => s.value === project.status)!;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/projects")}
        className="flex items-center gap-2 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to projects
      </button>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl font-bold truncate">{project.name}</h1>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${status.bg} ${status.color}`}
            >
              {status.label}
            </span>
          </div>
          {project.client && <p className="text-sm text-muted">{project.client}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setConfirmingDelete(true)}
            className="flex items-center gap-2 px-3 py-2 rounded text-red-400 hover:bg-surface-hover text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl">
          {error}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border pb-0 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px border-b-2 whitespace-nowrap ${
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

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab project={project} onProjectChange={setProject} />}
      {activeTab === "links" && <LinksTab project={project} onProjectChange={setProject} />}
      {activeTab === "credentials" && (
        <CredentialsTab project={project} onProjectChange={setProject} />
      )}
      {activeTab === "images" && <ImagesTab project={project} onProjectChange={setProject} />}
      {activeTab === "entries" && <EntriesTab projectId={project.id} />}

      {showEditModal && (
        <ProjectModal
          project={project}
          defaultStatus="planning"
          nextSortOrder={0}
          onClose={() => setShowEditModal(false)}
          onSaved={(saved) => {
            setProject(saved);
            setShowEditModal(false);
          }}
          onDeleted={() => navigate("/projects")}
        />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete project?"
          message={`"${project.name}" will be permanently deleted.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
