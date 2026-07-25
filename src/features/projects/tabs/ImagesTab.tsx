import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { updateProjectResources, uploadProjectImage, getProjectFileUrl } from "../api";
import type { ProjectRow } from "../types";

interface ImagesTabProps {
  project: ProjectRow;
  onProjectChange: (project: ProjectRow) => void;
}

export default function ImagesTab({ project, onProjectChange }: ImagesTabProps) {
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const images = project.resources.filter((r) => r.type === "image" && r.file_path);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      images.map(async (img) => {
        try {
          const url = await getProjectFileUrl(img.file_path);
          return [img.id, url] as const;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const r of results) if (r) next[r[0]] = r[1];
      setImageUrls(next);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.resources]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const filePath = await uploadProjectImage(file);
      const resources = [
        ...project.resources,
        {
          id: crypto.randomUUID(),
          type: "image" as const,
          label: file.name,
          value: "",
          username: "",
          password: "",
          file_path: filePath,
        },
      ];
      const updated = await updateProjectResources(project.id, resources);
      onProjectChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    const prev = project;
    const resources = project.resources.filter((r) => r.id !== id);
    onProjectChange({ ...project, resources });
    try {
      await updateProjectResources(project.id, resources);
    } catch (err) {
      onProjectChange(prev);
      setError(err instanceof Error ? err.message : "Error deleting image");
    }
  };

  return (
    <div className="space-y-4">
      <section className="bg-surface border border-border rounded-xl p-5 space-y-3">
        {error && <p className="text-sm text-red-400">{error}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelected}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          {uploading ? "Uploading..." : "Upload image"}
        </button>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5">
        {images.length === 0 ? (
          <p className="text-sm text-muted">No images yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((img) => (
              <div key={img.id} className="group relative">
                <a
                  href={imageUrls[img.id] ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="relative aspect-video rounded-lg overflow-hidden border border-border bg-background block"
                >
                  {imageUrls[img.id] ? (
                    <img
                      src={imageUrls[img.id]}
                      alt={img.label || "Project image"}
                      className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted">
                      <ImageIcon className="w-6 h-6 animate-pulse" />
                    </div>
                  )}
                  {img.label && (
                    <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[11px] px-2 py-1 truncate">
                      {img.label}
                    </span>
                  )}
                </a>
                <button
                  onClick={() => handleDelete(img.id)}
                  className="absolute top-1.5 right-1.5 p-1.5 rounded bg-black/60 text-white hover:bg-red-500/80 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete image"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
