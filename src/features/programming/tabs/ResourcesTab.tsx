import { useState, useEffect } from "react";
import { Plus, ExternalLink, Link2, FileText, Bookmark, Trash2, Loader2 } from "lucide-react";
import { getResources, addResource, deleteResource } from "../api";
import type { ProgrammingResourceRow, ResourceType } from "../types";

const TYPE_ICONS = {
  link: Link2,
  article: FileText,
  tool: Bookmark,
  other: ExternalLink,
};

export default function ResourcesTab() {
  const [resources, setResources] = useState<ProgrammingResourceRow[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ResourceType>("link");

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    try {
      setIsLoading(true);
      const data = await getResources();
      setResources(data);
    } catch (error) {
      console.error("Error loading resources:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !url) return;

    try {
      setIsSubmitting(true);
      const newResource = await addResource({
        title,
        url,
        description,
        type,
      });

      setResources([newResource, ...resources]);
      
      // Reset form
      setTitle("");
      setUrl("");
      setDescription("");
      setType("link");
      setIsFormOpen(false);
    } catch (error) {
      console.error("Error adding resource:", error);
      alert("Failed to add resource.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this resource?")) return;
    try {
      await deleteResource(id);
      setResources(resources.filter((r) => r.id !== id));
    } catch (error) {
      console.error("Error deleting resource:", error);
      alert("Failed to delete resource.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Saved Resources</h2>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Resource
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-surface border border-border rounded-xl p-5 animate-in slide-in-from-top-4 fade-in duration-200">
          <h3 className="font-semibold mb-4">Publish New Resource</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-muted">Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Next.js Docs"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted">URL / Link *</label>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-muted">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ResourceType)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary appearance-none"
                >
                  <option value="link">General Link</option>
                  <option value="article">Article / Guide</option>
                  <option value="tool">Tool / Library</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted">Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this resource about? Why did you save it?"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary min-h-[80px]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-70"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Resource
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="text-center p-8 bg-surface border border-border rounded-xl text-muted flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin mb-3 opacity-50" />
            <p>Loading resources...</p>
          </div>
        ) : resources.length === 0 ? (
          <div className="text-center p-8 bg-surface border border-dashed border-border rounded-xl text-muted">
            <Bookmark className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p>No resources saved yet.</p>
          </div>
        ) : (
          resources.map((resource) => {
            const Icon = TYPE_ICONS[resource.type] || ExternalLink;
            return (
              <div
                key={resource.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface border border-border rounded-xl p-4 hover:border-primary/50 transition-all"
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className="p-2.5 rounded-lg bg-surface-hover group-hover:bg-primary/10 transition-colors shrink-0">
                    <Icon className="w-5 h-5 text-muted group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:text-primary hover:underline transition-colors truncate"
                      >
                        {resource.title}
                      </a>
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 bg-surface-hover rounded text-muted whitespace-nowrap">
                        {resource.type}
                      </span>
                    </div>
                    {resource.description && (
                      <p className="text-sm text-muted line-clamp-2 mb-1.5">
                        {resource.description}
                      </p>
                    )}
                    <div className="flex items-center text-xs text-muted/70">
                      Added on {new Date(resource.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 sm:self-center self-end">
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Open link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleDelete(resource.id)}
                    className="p-2 rounded text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Delete resource"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
