import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { tools } from "@/lib/tools";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/sections/breadcrumbs";
import { ToolGrid } from "@/components/sections/tool-card";
import { TrustBar } from "@/components/sections/trust-bar";

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

export default function PdfToolsPage() {
  return (
    <div className="container-page space-y-12 py-8 md:py-12">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />

      <header className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Free PDF tools</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
          A clean, fast set of PDF utilities that run right in your browser. No sign-up, no uploads,
          no watermarks — just pick a tool and go.
        </p>
      </header>

      <TrustBar />

      <ToolGrid tools={tools} />

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
    </div>
  );
}
