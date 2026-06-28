import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getMediaTool, mediaToolSlugs } from "@/lib/media/tools";
import { buildMetadata } from "@/lib/seo";
import { MediaToolView } from "@/components/media/media-tool-view";

// Media tools live under /media-tools/<slug>, mirroring /pdf-tools/<slug>.
// Only the known slugs resolve here; anything else falls through to 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return mediaToolSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getMediaTool(slug);
  if (!tool) return { title: "Tool not found" };
  return buildMetadata({
    title: tool.title,
    description: tool.metaDescription,
    path: `/media-tools/${tool.slug}`,
    keywords: tool.keywords,
  });
}

export default async function MediaToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getMediaTool(slug);
  if (!tool) notFound();
  return <MediaToolView tool={tool} />;
}
