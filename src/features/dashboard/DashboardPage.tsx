import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MODULES } from "../../lib/modules";
import { APP_NAME } from "../../lib/constants";
import {
  getShortcuts,
  addShortcut,
  deleteShortcut,
  reorderShortcuts,
  uploadShortcutIcon,
} from "./api";
import type { ShortcutRow } from "./types";
import ShortcutsBar from "../../components/ShortcutsBar";

export default function DashboardPage() {
  const [shortcuts, setShortcuts] = useState<ShortcutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getShortcuts()
      .then(setShortcuts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">
        Welcome to <span className="text-primary">{APP_NAME}</span>
      </h1>
      <p className="text-muted mb-6">Your career command center</p>

      {/* Shortcuts */}
      <div className="mb-8">
        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
        {!loading && (
          <ShortcutsBar
            items={shortcuts}
            addShortcut={addShortcut}
            deleteShortcut={deleteShortcut}
            reorderShortcuts={reorderShortcuts}
            uploadIcon={uploadShortcutIcon}
            onAdded={(item) => setShortcuts((prev) => [...prev, item])}
            onDeleted={(id) => setShortcuts((prev) => prev.filter((s) => s.id !== id))}
            onReordered={setShortcuts}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.id}
              to={m.path}
              className="group bg-surface border border-border rounded-xl p-5 hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-surface-hover group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-semibold">{m.name}</h2>
              </div>
              <p className="text-sm text-muted">{m.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
