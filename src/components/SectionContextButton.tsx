import { errorMessage } from "../lib/errors";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { StickyNote, X, Copy, Check, Save } from "lucide-react";
import { MODULES } from "../lib/modules";
import { getSectionContext, saveSectionContext } from "../lib/sectionContext";

// Fixed "CONTEXT" tab, always docked to the left edge of the viewport on
// every section. Opens a modal with a free-text scratchpad (one note per
// user per section) that can be edited, pasted into, and copied out.
export default function SectionContextButton() {
  const location = useLocation();
  const activeModule = MODULES.find((m) => location.pathname.startsWith(m.path));
  const sectionId = activeModule?.id ?? "dashboard";
  const sectionLabel = activeModule?.name ?? "Dashboard";

  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const openModal = async () => {
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      setContent(await getSectionContext(sectionId));
    } catch (e) {
      setError(errorMessage(e, "Error loading context"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await saveSectionContext(sectionId, content);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(errorMessage(err, "Error saving context"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Compact round FAB on phones (a left-edge vertical tab would sit on
          top of the page content there), the docked side tab from sm up. */}
      <button
        onClick={openModal}
        className="fixed z-40 flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold tracking-wide shadow-lg transition-colors
          bottom-4 right-4 p-3 rounded-full
          sm:bottom-auto sm:right-auto sm:left-0 sm:top-1/2 sm:-translate-y-1/2 sm:px-2 sm:py-3 sm:rounded-l-none sm:rounded-r-lg sm:[writing-mode:vertical-rl] sm:rotate-180"
        title="Section context"
      >
        <StickyNote className="w-4 h-4 sm:rotate-90" />
        <span className="hidden sm:inline">CONTEXT</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface border border-border rounded-xl p-5 w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Context — {sectionLabel}</h3>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded text-muted hover:bg-surface-hover"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

            {loading ? (
              <p className="text-sm text-muted">Loading...</p>
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Free-form notes for this section... paste anything here."
                className="flex-1 min-h-[180px] sm:min-h-[300px] bg-background border border-border rounded px-3 py-2 text-sm font-mono focus:border-primary outline-none resize-none"
              />
            )}

            <div className="flex items-center justify-between mt-4">
              <button
                onClick={handleCopy}
                disabled={loading || !content}
                className="flex items-center gap-2 px-3 py-2 rounded bg-surface-hover hover:bg-border text-foreground text-sm font-medium transition-colors disabled:opacity-50"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>

              <button
                onClick={handleSave}
                disabled={loading || saving}
                className="flex items-center gap-2 px-4 py-2 rounded bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : saved ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
