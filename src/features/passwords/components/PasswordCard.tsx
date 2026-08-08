import { useState } from "react";
import { Globe, UserRound } from "lucide-react";
import type { PasswordEntryRow } from "../types";

function faviconUrl(url: string): string | null {
  try {
    const hostname = new URL(
      /^https?:\/\//i.test(url) ? url : `https://${url}`
    ).hostname;
    return `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
  } catch {
    return null;
  }
}

interface PasswordCardProps {
  entry: PasswordEntryRow;
  onClick: () => void;
}

export default function PasswordCard({ entry, onClick }: PasswordCardProps) {
  const [imgError, setImgError] = useState(false);
  const image = entry.url ? faviconUrl(entry.url) : null;

  return (
    <div
      onClick={onClick}
      className="group bg-surface border border-border rounded-xl p-5 hover:border-primary transition-all cursor-pointer hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-lg bg-surface-hover border border-border flex items-center justify-center overflow-hidden shrink-0">
          {image && !imgError ? (
            <img
              src={image}
              alt=""
              className="w-6 h-6"
              onError={() => setImgError(true)}
            />
          ) : (
            <Globe className="w-5 h-5 text-muted" />
          )}
        </div>
      </div>

      <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors truncate">
        {entry.site_name || "Untitled site"}
      </h3>

      <div className="space-y-1.5">
        {entry.username && (
          <p className="flex items-center gap-2 text-sm text-muted truncate">
            <UserRound className="w-3.5 h-3.5 shrink-0" />
            {entry.username}
          </p>
        )}
        {entry.url && (
          <p className="text-sm text-muted truncate">{entry.url}</p>
        )}
      </div>
    </div>
  );
}
