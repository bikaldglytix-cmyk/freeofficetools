import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { getGuide, guideSlugs } from "@/lib/guides";
import { getTool } from "@/lib/tools";
import { getMediaTool } from "@/lib/media/tools";
import { getOfficeTool } from "@/lib/office/tools";
import { siteConfig } from "@/lib/site";
import { buildMetadata, breadcrumbJsonLd, faqJsonLd, canonical } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/sections/breadcrumbs";
import { Faq } from "@/components/sections/faq";
import { Button } from "@/components/ui/button";

export function generateStaticParams() {
  return guideSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: "Guide not found" };
  return buildMetadata({
    title: guide.title,
    description: guide.metaDescription,
    path: `/guides/${guide.slug}`,
    keywords: guide.keywords,
  });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const tool =
    guide.toolCategory === "pdf-tools"
      ? getTool(guide.toolSlug)
      : guide.toolCategory === "media-tools"
        ? getMediaTool(guide.toolSlug)
        : getOfficeTool(guide.toolSlug);

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides" },
    { name: guide.h1, path: `/guides/${guide.slug}` },
  ];

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.metaDescription,
    datePublished: guide.updated,
    dateModified: guide.updated,
    author: { "@type": "Organization", name: siteConfig.name },
    publisher: { "@type": "Organization", name: siteConfig.name },
    mainEntityOfPage: canonical(`/guides/${guide.slug}`),
  };

  return (
    <div className="container-page py-8 md:py-12">
      <JsonLd data={[breadcrumbJsonLd(crumbs), articleJsonLd, faqJsonLd(guide.faqs)]} />

      <div className="mx-auto max-w-3xl space-y-8">
        <Breadcrumbs items={crumbs} />

        <header>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{guide.h1}</h1>
          <div className="mt-4 space-y-3">
            {guide.intro.map((p, i) => (
              <p key={i} className="text-lg leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </div>
        </header>

        {tool ? (
          <Button asChild size="lg">
            <Link href={`/${guide.toolCategory}/${tool.slug}`}>
              Open the {tool.name} tool <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : null}

        <article className="space-y-10">
          {guide.sections.map((section, i) => (
            <section key={i} className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight">{section.heading}</h2>
              {section.body.map((p, j) => (
                <p key={j} className="leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
              {section.steps ? (
                <ol className="ml-1 space-y-2">
                  {section.steps.map((step, k) => (
                    <li key={k} className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {k + 1}
                      </span>
                      <span className="leading-relaxed text-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>
          ))}
        </article>

        <Faq faqs={guide.faqs} />

        {tool ? (
          <div className="rounded-xl border border-border bg-muted/40 p-6 text-center">
            <p className="font-semibold text-foreground">Ready to try it?</p>
            <p className="mt-1 text-sm text-muted-foreground">{tool.short}</p>
            <Button asChild className="mt-3">
              <Link href={`/${guide.toolCategory}/${tool.slug}`}>
                Use {tool.name} <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
