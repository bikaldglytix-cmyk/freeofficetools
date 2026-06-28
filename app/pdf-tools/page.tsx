import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { tools } from "@/lib/tools";
import { buildMetadata, breadcrumbJsonLd, faqJsonLd, canonical } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/sections/breadcrumbs";
import { ToolGrid } from "@/components/sections/tool-card";
import { TrustBar } from "@/components/sections/trust-bar";
import { Faq } from "@/components/sections/faq";

export const metadata: Metadata = buildMetadata({
  title: "All PDF Tools — Free & Private",
  description:
    "Every FreeOfficeTools PDF utility in one place: merge, split, compress, rotate, convert and watermark PDFs. Free, private and processed in your browser.",
  path: "/pdf-tools",
  keywords: ["free pdf tools", "online pdf tools", "pdf utilities", "edit pdf online"],
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "PDF tools", path: "/pdf-tools" },
];

const faqs = [
  {
    q: "Are the PDF tools free?",
    a: "Yes. Every PDF tool is free to use with no sign-up, no page limits and no watermark on the result.",
  },
  {
    q: "Are my PDF files private?",
    a: "Yes. PDF tools run entirely in your browser, so your files are processed on your device and never uploaded to a server.",
  },
  {
    q: "What can I do with these PDF tools?",
    a: "Merge, split, compress, rotate, reorder, delete and extract pages, add watermarks, convert between PDF and JPG, and edit PDF text and annotations.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. The tools run in any modern browser on desktop or mobile — there's nothing to download and no account to create.",
  },
];

export default function PdfToolsPage() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "PDF tools",
    itemListElement: tools.map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: tool.name,
      url: canonical(`/pdf-tools/${tool.slug}`),
    })),
  };

  return (
    <div className="container-page space-y-12 py-8 md:py-12">
      <JsonLd data={[breadcrumbJsonLd(crumbs), itemList, faqJsonLd(faqs)]} />
      <Breadcrumbs items={crumbs} />

      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Free PDF tools</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
          A clean, fast set of PDF utilities that run right in your browser. No sign-up, no uploads,
          no watermarks — just pick a tool and go.
        </p>
      </header>

      <ToolGrid tools={tools} />

      <TrustBar />

      <div className="rounded-2xl border border-border bg-muted/40 p-6 text-center">
        <p className="text-base font-medium text-foreground">Looking for step-by-step help?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Our guides walk you through common document tasks.
        </p>
        <Link
          href="/guides"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Browse guides <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="mx-auto max-w-3xl">
        <Faq faqs={faqs} />
      </div>
    </div>
  );
}
