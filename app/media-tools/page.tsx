import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { mediaTools } from "@/lib/media/tools";
import { buildMetadata, breadcrumbJsonLd, faqJsonLd, canonical } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/sections/breadcrumbs";
import { ToolGrid } from "@/components/sections/tool-card";
import { TrustBar } from "@/components/sections/trust-bar";
import { Faq } from "@/components/sections/faq";
import { MediaPrivacyNote } from "@/components/media/privacy-note";

export const metadata: Metadata = buildMetadata({
  title: "Free Video & Audio Tools — Private, In Your Browser",
  description:
    "Free online video and audio tools that run in your browser: convert video to MP3, compress video, convert audio formats and trim audio. No uploads, no sign-up.",
  path: "/media-tools",
  keywords: ["video tools", "audio tools", "video to mp3", "audio converter", "compress video", "online media tools"],
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Media tools", path: "/media-tools" },
];

const faqs = [
  {
    q: "Are these video and audio tools really free?",
    a: "Yes. Every media tool is free with no sign-up, no page limits and no watermark on the output.",
  },
  {
    q: "Are my files uploaded to a server?",
    a: "No. The media tools process your files locally in your browser using WebAssembly, so your videos and audio stay on your device whenever possible.",
  },
  {
    q: "Why does video processing take longer than PDF tools?",
    a: "Audio and video are re-encoded on your own device, which is more intensive than editing a PDF. Larger or longer files take longer, and a progress bar keeps you informed.",
  },
  {
    q: "What about very large video files?",
    a: "Because everything runs in your browser, very large files are limited by your device's memory. Files up to a few hundred MB work well on most modern computers and phones.",
  },
];

export default function MediaToolsPage() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Video & audio tools",
    itemListElement: mediaTools.map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: tool.name,
      url: canonical(`/${tool.slug}`),
    })),
  };

  return (
    <div className="container-page space-y-12 py-8 md:py-12">
      <JsonLd data={[breadcrumbJsonLd(crumbs), itemList, faqJsonLd(faqs)]} />
      <Breadcrumbs items={crumbs} />

      <header className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Video &amp; audio tools</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Convert, compress and trim video and audio — right in your browser. No uploads, no sign-up,
          no watermarks. Just pick a tool and go.
        </p>
        <div className="max-w-md">
          <MediaPrivacyNote />
        </div>
      </header>

      <TrustBar />

      <ToolGrid tools={mediaTools} />

      <div className="rounded-2xl border border-border bg-muted/40 p-6 text-center">
        <p className="text-base font-medium text-foreground">Need to work with documents too?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Merge, split, compress and convert PDFs with the same fast, private tools.
        </p>
        <Link
          href="/pdf-tools"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Browse PDF tools <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="mx-auto max-w-3xl">
        <Faq faqs={faqs} />
      </div>
    </div>
  );
}
