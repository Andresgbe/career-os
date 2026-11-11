import type { CSSProperties } from "react";

// Neutral accent for pieces without a category
export const NO_CATEGORY_COLOR = "#71717a";

// Cover-like background for a piece, tinted with its category color
export function coverStyle(color: string): CSSProperties {
  return {
    backgroundImage: `radial-gradient(120% 90% at 100% 0%, ${color}55 0%, transparent 60%), linear-gradient(160deg, ${color}26 0%, #141418 75%)`,
  };
}
