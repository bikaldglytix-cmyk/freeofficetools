import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getOfficeTool, officeToolSlugs } from "@/lib/office/tools";
import { buildMetadata } from "@/lib/seo";
import { OfficeToolView } from "@/components/office/office-tool-view";

// Office tools live under /office-tools/<slug>, mirroring /pdf-tools/<slug>.
// Only the known slugs resolve here; anything else falls through to 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return officeToolSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getOfficeTool(slug);
  if (!tool) return { title: "Tool not found" };
  return buildMetadata({
    title: tool.title,
    description: tool.metaDescription,
    path: `/office-tools/${tool.slug}`,
    keywords: tool.keywords,
  });
}

export default async function OfficeToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getOfficeTool(slug);
  if (!tool) notFound();
  return <OfficeToolView tool={tool} />;
}
