import { useEffect, useState } from "react";
import {
  getShortcuts,
  addShortcut,
  deleteShortcut,
  reorderShortcuts,
  uploadShortcutIcon,
} from "./api";
import type { ShortcutRow } from "./types";
import ShortcutsBar from "../../components/ShortcutsBar";
import PillTrackerButton from "./components/PillTrackerButton";
import ModuleBoard from "./components/ModuleBoard";

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
            storageKey="dashboard"
          />
        )}
      </div>

      <div className="flex items-start gap-3">
        <PillTrackerButton />
        <div className="flex-1 min-w-0">
          <ModuleBoard />
        </div>
      </div>
    </div>
  );
}
