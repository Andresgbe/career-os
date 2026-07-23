import { useState } from "react";
import { ChevronDown, ChevronRight, Code2, Copy, Check, Plus } from "lucide-react";

interface CodeBlockProps {
  value: string;
  onChange?: (value: string) => void; // provide to make it editable
  placeholder?: string;
}

// Renders as a compact collapsed header by default so a saved snippet
// doesn't eat vertical space; expand to read/edit, with a one-click copy.
export default function CodeBlock({ value, onChange, placeholder }: CodeBlockProps) {
  const editable = !!onChange;
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!editable && !value) return null;

  const lineCount = value ? value.split("\n").length : 0;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard permission denied — nothing else to do here
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-surface-hover text-left text-xs"
      >
        {value ? (
          expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0" />
          )
        ) : (
          <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
        )}
        <Code2 className="w-3.5 h-3.5 text-muted shrink-0" />
        <span className="font-medium text-muted">
          {value
            ? `Code (${lineCount} line${lineCount === 1 ? "" : "s"})`
            : "Add code (optional)"}
        </span>
        {value && (
          <span
            onClick={handleCopy}
            className="ml-auto p-1 rounded hover:bg-surface text-muted hover:text-primary cursor-pointer"
            title="Copy code"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </span>
        )}
      </button>

      {expanded &&
        (editable ? (
          <textarea
            rows={6}
            autoFocus={!value}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange!(e.target.value)}
            className="w-full bg-background border-t border-border px-3 py-2 text-xs font-mono focus:outline-none resize-y"
          />
        ) : (
          <pre className="bg-background border-t border-border px-3 py-2 text-xs font-mono whitespace-pre-wrap break-all overflow-x-auto max-h-80 overflow-y-auto">
            <code>{value}</code>
          </pre>
        ))}
    </div>
  );
}
