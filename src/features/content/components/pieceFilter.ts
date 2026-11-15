import type { ContentIdeaRow } from "../types";

// "all" = no filter; "" = only pieces without a value yet
export interface PieceFilter {
  format: string;
  style: string;
}

export const NO_FILTER: PieceFilter = { format: "all", style: "all" };

export function matchesFilter(idea: ContentIdeaRow, f: PieceFilter): boolean {
  return (f.format === "all" || idea.format === f.format) && (f.style === "all" || idea.style === f.style);
}

export function isFiltering(f: PieceFilter): boolean {
  return f.format !== "all" || f.style !== "all";
}
