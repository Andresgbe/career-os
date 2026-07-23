import { useState } from "react";
import { Globe, X } from "lucide-react";

function faviconUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
  } catch {
    return null;
  }
}

const SIZE = {
  md: { box: "w-14 h-14", icon: "w-7 h-7", fallback: "w-6 h-6", wrap: "w-20" },
  lg: { box: "w-18 h-18", icon: "w-9 h-9", fallback: "w-7 h-7", wrap: "w-24" },
};

interface ShortcutTileProps {
  name: string;
  url: string;
  iconUrl?: string | null;
  onDelete: () => void;
  size?: "md" | "lg";
}

export default function ShortcutTile({
  name,
  url,
  iconUrl,
  onDelete,
  size = "md",
}: ShortcutTileProps) {
  const [imgError, setImgError] = useState(false);
  const image = iconUrl || faviconUrl(url);
  const s = SIZE[size];

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative flex flex-col items-center gap-2 ${s.wrap}`}
    >
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        className="absolute -top-1.5 -right-1.5 z-10 p-0.5 rounded-full bg-surface border border-border text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove shortcut"
      >
        <X className="w-3 h-3" />
      </button>
      <div
        className={`${s.box} rounded-xl bg-surface border border-border flex items-center justify-center group-hover:border-primary transition-colors overflow-hidden`}
      >
        {image && !imgError ? (
          <img
            src={image}
            alt=""
            className={iconUrl ? "w-full h-full object-cover" : s.icon}
            onError={() => setImgError(true)}
          />
        ) : (
          <Globe className={`${s.fallback} text-muted`} />
        )}
      </div>
      <span className="text-xs text-center text-muted group-hover:text-foreground transition-colors truncate w-full">
        {name}
      </span>
    </a>
  );
}
