import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  type OfficeCategory,
  getOfficeToolsByGroup,
  officeCategories,
} from "@/lib/office/tools";
import { breadcrumbJsonLd, faqJsonLd, canonical } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/sections/breadcrumbs";
import { ToolGrid } from "@/components/sections/tool-card";
import { TrustBar } from "@/components/sections/trust-bar";
import { Faq } from "@/components/sections/faq";

export function OfficeCategoryView({ category }: { category: OfficeCategory }) {
  const tools = getOfficeToolsByGroup(category.group);
  const others = officeCategories.filter((c) => c.slug !== category.slug);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: category.name, path: `/${category.slug}` },
  ];

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: category.name,
    itemListElement: tools.map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: tool.name,
      url: canonical(`/${tool.slug}`),
    })),
  };

  return (
    <div className="container-page space-y-12 py-8 md:py-12">
      <JsonLd data={[breadcrumbJsonLd(crumbs), itemList, faqJsonLd(category.faqs)]} />
      <Breadcrumbs items={crumbs} />

      <header className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{category.h1}</h1>
        {category.intro.map((p, i) => (
          <p key={i} className="text-lg leading-relaxed text-muted-foreground">
            {p}
          </p>
        ))}
      </header>

      <TrustBar />

      <ToolGrid tools={tools} />

      <div className="rounded-2xl border border-border bg-muted/40 p-6">
        <p className="text-base font-medium text-foreground">More office &amp; document tools</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-primary">
          {others.map((c) => (
            <Link key={c.slug} href={`/${c.slug}`} className="inline-flex items-center gap-1 hover:underline">
              {c.name} <ArrowRight className="size-4" />
            </Link>
          ))}
          <Link href="/pdf-tools" className="inline-flex items-center gap-1 hover:underline">
            PDF tools <ArrowRight className="size-4" />
          </Link>
          <Link href="/media-tools" className="inline-flex items-center gap-1 hover:underline">
            Video &amp; audio tools <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl">
        <Faq faqs={category.faqs} />
      </div>
    </div>
  );
}
