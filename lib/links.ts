import type { LucideIcon } from "lucide-react";

export type ToolCategory = "pdf" | "media" | "office";

/**
 * The minimal shape needed to render a tool card or grid. PDF tools
 * (`lib/tools.ts`), media tools (`lib/media/tools.ts`) and Office tools
 * (`lib/office/tools.ts`) all satisfy it, so one card, grid and "related tools"
 * component serve every category.
 */
export interface ToolCardItem {
  slug: string;
  name: string;
  short: string;
  icon: LucideIcon;
  category: ToolCategory;
}

/**
 * Canonical path for a tool. PDF tools live under /pdf-tools/<slug>; media and
 * Office tools use exact-match root slugs (/video-to-mp3, /word-to-pdf) for the
 * strongest keyword targeting. Centralised here so links stay consistent.
 */
export function toolHref(tool: { category: ToolCategory; slug: string }): string {
  return tool.category === "pdf" ? `/pdf-tools/${tool.slug}` : `/${tool.slug}`;
}
