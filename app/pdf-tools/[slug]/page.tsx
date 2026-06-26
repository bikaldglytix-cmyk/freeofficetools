import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { getTool, getRelatedTools, toolSlugs } from "@/lib/tools";
import { guides } from "@/lib/guides";
import {
  buildMetadata,
  breadcrumbJsonLd,
  faqJsonLd,
  howToJsonLd,
  webApplicationJsonLd,
} from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/sections/breadcrumbs";
import { HowTo } from "@/components/sections/how-to";
import { Faq } from "@/components/sections/faq";
import { RelatedTools } from "@/components/sections/related-tools";
import { ToolRunner } from "@/components/tools/tool-runner";
import { WorkspaceLayout } from "@/components/layout/workspace-layout";

export function generateStaticParams() {
  return toolSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return { title: "Tool not found" };
  return buildMetadata({
    title: tool.title,
    description: tool.metaDescription,
    path: `/pdf-tools/${tool.slug}`,
    keywords: tool.keywords,
  });
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  const related = getRelatedTools(slug);
  const relatedGuide = guides.find((g) => g.toolSlug === slug);

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "PDF tools", path: "/pdf-tools" },
    { name: tool.name, path: `/pdf-tools/${tool.slug}` },
  ];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          webApplicationJsonLd(tool),
          howToJsonLd(tool),
          faqJsonLd(tool.faqs),
        ]}
      />
      
      <div className="container-page pt-6 pb-2">
        <Breadcrumbs items={crumbs} />
      </div>

      <WorkspaceLayout 
        title={tool.h1} 
        subtitle={tool.heroSubtitle} 
        runner={<ToolRunner slug={tool.slug} />}
      >
        <div className="space-y-16">
          <section className="mx-auto max-w-3xl space-y-4" aria-label="About this tool">
            <p className="text-lg leading-relaxed text-foreground">{tool.intro[0]}</p>
            {tool.intro.slice(1).map((p, i) => (
              <p key={i} className="leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </section>

          <div className="mx-auto max-w-3xl">
            <HowTo title={`How to ${tool.name.toLowerCase()}`} steps={tool.steps} />
          </div>

          {relatedGuide ? (
            <div className="mx-auto max-w-3xl">
              <Link
                href={`/guides/${relatedGuide.slug}`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-transparent bg-muted/20 p-5 transition-colors hover:border-border/40 hover:bg-muted/40"
              >
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">Read the guide</p>
                  <p className="mt-1 font-medium text-foreground">{relatedGuide.h1}</p>
                </div>
                <ArrowRight className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          ) : null}

          <div className="mx-auto max-w-3xl border-t border-border/40 pt-16">
            <h2 className="mb-8 text-2xl font-medium tracking-tight">Frequently asked questions</h2>
            <Faq faqs={tool.faqs} />
          </div>

          <div className="border-t border-border/40 pt-16">
            <h2 className="mb-8 text-xl font-medium tracking-tight">Related tools</h2>
            <RelatedTools tools={related} />
          </div>
        </div>
      </WorkspaceLayout>
    </>
  );
}
