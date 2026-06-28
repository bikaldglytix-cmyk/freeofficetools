import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { getRelatedMediaTools, type MediaToolDefinition } from "@/lib/media/tools";
import { guides } from "@/lib/guides";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  howToJsonLd,
  mediaApplicationJsonLd,
} from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/sections/breadcrumbs";
import { TrustBar } from "@/components/sections/trust-bar";
import { HowTo } from "@/components/sections/how-to";
import { Faq } from "@/components/sections/faq";
import { RelatedTools } from "@/components/sections/related-tools";
import { MediaRunner } from "@/components/media/media-runner";

export function MediaToolView({ tool }: { tool: MediaToolDefinition }) {
  const related = getRelatedMediaTools(tool.slug);
  const relatedGuide = guides.find((g) => g.toolSlug === tool.slug);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Media tools", path: "/media-tools" },
    { name: tool.name, path: `/media-tools/${tool.slug}` },
  ];

  return (
    <div className="container-page space-y-14 py-8 md:space-y-20 md:py-12">
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          mediaApplicationJsonLd(tool),
          howToJsonLd(tool),
          faqJsonLd(tool.faqs),
        ]}
      />

      <div className="space-y-8">
        <Breadcrumbs items={crumbs} />

        <header className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{tool.h1}</h1>
          <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{tool.heroSubtitle}</p>
        </header>

        <div className="mx-auto max-w-3xl space-y-3">
          <MediaRunner slug={tool.slug} />
        </div>

        <div className="mx-auto max-w-3xl">
          <TrustBar />
        </div>
      </div>

      <section className="mx-auto max-w-3xl space-y-4" aria-label="About this tool">
        <p className="text-lg leading-relaxed text-foreground">{tool.intro[0]}</p>
        {tool.intro.slice(1).map((p, i) => (
          <p key={i} className="leading-relaxed text-muted-foreground">
            {p}
          </p>
        ))}
      </section>

      <div className="mx-auto max-w-3xl">
        <HowTo title={`How to use the ${tool.name.toLowerCase()}`} steps={tool.steps} />
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

      <div className="mx-auto max-w-3xl">
        <Faq faqs={tool.faqs} />
      </div>

      <RelatedTools tools={related} />
    </div>
  );
}
