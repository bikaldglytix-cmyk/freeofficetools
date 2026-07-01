import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { guides } from "@/lib/guides";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { staticPageSeo } from "@/lib/static-pages";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/sections/breadcrumbs";

const seo = staticPageSeo("/guides");
export const metadata: Metadata = buildMetadata({
  title: seo.title,
  description: seo.description,
  path: seo.path,
  keywords: ["pdf guides", "media tutorials", "how to convert video", "how to pdf", "office tools tutorials"],
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Guides", path: "/guides" },
];

export default function GuidesPage() {
  return (
    <div className="container-page space-y-10 py-8 md:py-12">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />

      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Guides</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
          Short, practical walkthroughs for common document tasks — each one links straight to a free
          tool so you can get it done.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={`/guides/${guide.slug}`}
            className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/40"
          >
            <h2 className="font-semibold text-foreground transition-colors group-hover:text-primary">
              {guide.h1}
            </h2>
            <p className="mt-2.5 flex-1 text-sm leading-relaxed text-muted-foreground">{guide.intro[0]}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Read guide
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
