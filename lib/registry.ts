/**
 * Unified tool lookup across every category. Lets any page resolve a list of
 * related-tool slugs into cards regardless of category, so PDF, media and
 * Office tools can cross-link freely (a core internal-linking requirement).
 *
 * Only pulls in the tool *data* (and lucide icons) — never the processing
 * engines — so importing this stays cheap and server-safe.
 */
import type { ToolCardItem } from "@/lib/links";
import { tools } from "@/lib/tools";
import { mediaTools } from "@/lib/media/tools";
import { officeTools } from "@/lib/office/tools";

const allTools: ToolCardItem[] = [...tools, ...mediaTools, ...officeTools];
const bySlug = new Map<string, ToolCardItem>(allTools.map((t) => [t.slug, t]));

export function getCardItem(slug: string): ToolCardItem | undefined {
  return bySlug.get(slug);
}

/** Resolve related-tool slugs to cards, dropping any that don't exist. */
export function relatedCards(slugs: string[]): ToolCardItem[] {
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((t): t is ToolCardItem => Boolean(t));
}
