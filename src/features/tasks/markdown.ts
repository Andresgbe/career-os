import { Marked } from "marked";

// HTML crudo dentro del markdown (lo escribe Andrés o el asistente) se muestra
// como texto, no se ejecuta.
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const md = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html: ({ text }) => esc(text),
    link({ href, title, tokens }) {
      const safe = /^(https?:|mailto:)/i.test(href) ? href : "#";
      return `<a href="${esc(safe)}"${title ? ` title="${esc(title)}"` : ""} target="_blank" rel="noreferrer noopener">${this.parser.parseInline(tokens)}</a>`;
    },
  },
});

export function renderMarkdown(src: string): string {
  return md.parse(src, { async: false }) as string;
}

/** Clases para el HTML renderizado (Tailwind, sin plugin typography). */
export const TASK_MD_CLASS =
  "text-sm text-foreground break-words [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 " +
  "[&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-medium " +
  "[&_a]:text-primary-hover [&_a]:underline [&_code]:bg-background [&_code]:px-1 [&_code]:rounded [&_code]:text-xs " +
  "[&_pre]:bg-background [&_pre]:border [&_pre]:border-border [&_pre]:rounded-lg [&_pre]:p-2 [&_pre]:overflow-x-auto " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted";
