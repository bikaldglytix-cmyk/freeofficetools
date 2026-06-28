import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import Link from "next/link";

import type { OfficeToolDefinition } from "@/lib/office/tools";
import { relatedCards } from "@/lib/registry";
import { guides } from "@/lib/guides";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  howToJsonLd,
  officeApplicationJsonLd,
} from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/sections/breadcrumbs";
import { TrustBar } from "@/components/sections/trust-bar";
import { HowTo } from "@/components/sections/how-to";
import { Faq } from "@/components/sections/faq";
import { RelatedTools } from "@/components/sections/related-tools";
import { OfficeRunner } from "@/components/office/office-runner";

export function OfficeToolView({ tool }: { tool: OfficeToolDefinition }) {
  const related = relatedCards(tool.related);
  const relatedGuide = guides.find((g) => g.toolSlug === tool.slug);
  // The hub is /office-tools; the old per-type hubs (/word-tools, …) only 301 now.
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Office tools", path: "/office-tools" },
    { name: tool.name, path: `/office-tools/${tool.slug}` },
  ];

  return (
    <div className="container-page space-y-14 py-8 md:space-y-20 md:py-12">
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          officeApplicationJsonLd(tool),
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
          <OfficeRunner slug={tool.slug} />
          <p className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-xs font-medium text-foreground">
            <ShieldCheck className="size-4 shrink-0 text-success" />
            Files are converted securely and deleted right after — never stored or shared.
          </p>
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

      <section className="mx-auto max-w-3xl" aria-labelledby="benefits-heading">
        <h2 id="benefits-heading" className="text-2xl font-semibold tracking-tight">
          Why use this {tool.name.toLowerCase()} tool
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {tool.benefits.map((benefit, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-4">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                <Check className="size-3.5" />
              </span>
              <span className="text-sm leading-relaxed text-foreground">{benefit}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mx-auto max-w-3xl">
        <HowTo title={`How to use the ${tool.name.toLowerCase()} converter`} steps={tool.steps} />
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
