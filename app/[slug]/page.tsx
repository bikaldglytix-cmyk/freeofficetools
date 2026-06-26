import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getMediaTool, mediaToolSlugs } from "@/lib/media/tools";
import { getOfficeTool, officeToolSlugs } from "@/lib/office/tools";
import { buildMetadata } from "@/lib/seo";
import { MediaToolView } from "@/components/media/media-tool-view";
import { OfficeToolView } from "@/components/office/office-tool-view";

// Media and Office tools live at exact-match root slugs (e.g. /video-to-mp3,
// /word-to-pdf) for the strongest keyword targeting. Only the slugs below
// resolve here; any other root path falls through to the 404 page.
export const dynamicParams = false;

export function generateStaticParams() {
  return [...mediaToolSlugs, ...officeToolSlugs].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getMediaTool(slug) ?? getOfficeTool(slug);
  if (!tool) return { title: "Tool not found" };
  return buildMetadata({
    title: tool.title,
    description: tool.metaDescription,
    path: `/${tool.slug}`,
    keywords: tool.keywords,
  });
}

export default async function RootToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const mediaTool = getMediaTool(slug);
  if (mediaTool) return <MediaToolView tool={mediaTool} />;

  const officeTool = getOfficeTool(slug);
  if (officeTool) return <OfficeToolView tool={officeTool} />;

  notFound();
}
