import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { officeTools } from "@/lib/office/tools";
import { buildMetadata, breadcrumbJsonLd, faqJsonLd, canonical } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/sections/breadcrumbs";
import { ToolGrid } from "@/components/sections/tool-card";
import { TrustBar } from "@/components/sections/trust-bar";
import { Faq } from "@/components/sections/faq";

export const metadata: Metadata = buildMetadata({
  title: "Free Office Tools — Convert Word, Excel & PowerPoint",
  description:
    "Free online office tools to convert Word, Excel and PowerPoint to PDF and back. Private, fast and no sign-up — every document converter in one place.",
  path: "/office-tools",
  keywords: ["office tools", "free office tools", "document converter", "word excel powerpoint to pdf", "online office tools"],
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Office tools", path: "/office-tools" },
];

const faqs = [
  {
    q: "Are the office tools free?",
    a: "Yes. Every office tool is free to use with no sign-up, no page limits and no watermark on the output.",
  },
  {
    q: "Which office files can I convert?",
    a: "You can convert Word (DOC, DOCX), Excel (XLS, XLSX, CSV) and PowerPoint (PPT, PPTX) files to PDF, and convert PDFs back into editable Word, Excel and PowerPoint files.",
  },
  {
    q: "Will my formatting be preserved?",
    a: "Yes. Conversions keep fonts, images, tables and layout so the result matches your original document as closely as possible.",
  },
  {
    q: "Are my documents kept private?",
    a: "Your files are processed securely for the conversion and are never stored or shared.",
  },
];

export default function OfficeToolsPage() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Office tools",
    itemListElement: officeTools.map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: tool.name,
      url: canonical(`/office-tools/${tool.slug}`),
    })),
  };

  return (
    <div className="container-page space-y-12 py-8 md:py-12">
      <JsonLd data={[breadcrumbJsonLd(crumbs), itemList, faqJsonLd(faqs)]} />
      <Breadcrumbs items={crumbs} />

      <header className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Free office tools</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Convert Word, Excel and PowerPoint files to PDF — and back again — without installing
          anything. Free, private and no sign-up required.
        </p>
      </header>



      <ToolGrid tools={officeTools} />

      <TrustBar />

      <div className="rounded-2xl border border-border bg-muted/40 p-6 text-center">
        <p className="text-base font-medium text-foreground">Looking for PDF or media tools?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Merge and compress PDFs, or convert video and audio — all in your browser.
        </p>
        <div className="mt-3 flex justify-center gap-5 text-sm font-medium text-primary">
          <Link href="/pdf-tools" className="inline-flex items-center gap-1 hover:underline">
            PDF tools <ArrowRight className="size-4" />
          </Link>
          <Link href="/media-tools" className="inline-flex items-center gap-1 hover:underline">
            Media tools <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl">
        <Faq faqs={faqs} />
      </div>
    </div>
  );
}
