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
 * Canonical path for a tool. Every category nests its tools under its hub so the
 * URL structure stays consistent: PDF tools at /pdf-tools/<slug>, Office tools at
 * /office-tools/<slug>, media tools at /media-tools/<slug>. Centralised here so
 * links stay consistent everywhere.
 */
export function toolHref(tool: { category: ToolCategory; slug: string }): string {
  return `/${tool.category}-tools/${tool.slug}`;
}
