import { useRef, useState } from "react";
import { Bold, CaseUpper, List, Palette, Image as ImageIcon, Loader2 } from "lucide-react";
import { uploadWorkImage } from "../api";

// Shared with the read-only render so bullets/images look the same in both places.
export const RICH_CONTENT_CLASS =
  "[&_img]:max-w-full [&_img]:rounded [&_img]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_div]:min-h-[1em]";

const COLORS = ["#f4f4f5", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a78bfa"];

interface RichTextEditorProps {
  value: string; // HTML
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showColors, setShowColors] = useState(false);

  const emitChange = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emitChange();
  };

  const applyUppercase = () => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    const text = selection?.toString();
    if (!text) return;
    document.execCommand("insertText", false, text.toUpperCase());
    emitChange();
  };

  const triggerImageUpload = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadWorkImage(file);
      editorRef.current?.focus();
      document.execCommand("insertImage", false, url);
      emitChange();
    } catch {
      // Upload failures here are non-fatal to the form; the user can retry.
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="border border-border rounded overflow-hidden">
      <div className="flex items-center gap-1 bg-surface-hover px-2 py-1.5 border-b border-border relative">
        <button
          type="button"
          onClick={() => exec("bold")}
          className="p-1.5 rounded hover:bg-surface text-muted hover:text-foreground"
          title="Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={applyUppercase}
          className="p-1.5 rounded hover:bg-surface text-muted hover:text-foreground"
          title="UPPERCASE selection"
        >
          <CaseUpper className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => exec("insertUnorderedList")}
          className="p-1.5 rounded hover:bg-surface text-muted hover:text-foreground"
          title="Bullet list"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColors((s) => !s)}
            className="p-1.5 rounded hover:bg-surface text-muted hover:text-foreground"
            title="Text color"
          >
            <Palette className="w-3.5 h-3.5" />
          </button>
          {showColors && (
            <div className="absolute top-full left-0 mt-1 flex gap-1 bg-surface border border-border rounded p-1.5 z-10 shadow-lg">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    exec("foreColor", c);
                    setShowColors(false);
                  }}
                  className="w-5 h-5 rounded-full border border-border"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={triggerImageUpload}
          disabled={uploading}
          className="p-1.5 rounded hover:bg-surface text-muted hover:text-foreground disabled:opacity-50"
          title="Insert image"
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ImageIcon className="w-3.5 h-3.5" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelected}
          className="hidden"
        />
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        data-placeholder={placeholder}
        dangerouslySetInnerHTML={{ __html: value }}
        className={`rich-text-editable min-h-[120px] max-h-[400px] overflow-y-auto bg-background px-3 py-2 text-sm focus:outline-none ${RICH_CONTENT_CLASS}`}
      />
    </div>
  );
}
