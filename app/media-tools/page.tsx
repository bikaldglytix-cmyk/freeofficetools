import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { mediaTools } from "@/lib/media/tools";
import { buildMetadata, breadcrumbJsonLd, faqJsonLd, canonical } from "@/lib/seo";
import { staticPageSeo } from "@/lib/static-pages";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/sections/breadcrumbs";
import { ToolGrid } from "@/components/sections/tool-card";
import { TrustBar } from "@/components/sections/trust-bar";
import { Faq } from "@/components/sections/faq";

const seo = staticPageSeo("/media-tools");
export const metadata: Metadata = buildMetadata({
  title: seo.title,
  description: seo.description,
  path: seo.path,
  keywords: ["video tools", "audio tools", "image converter", "video to mp3", "png to jpg", "heic to jpg", "metadata editor", "online media tools"],
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Media tools", path: "/media-tools" },
];

const faqs = [
  {
    q: "Are these video, audio, and image tools really free?",
    a: "Yes. Every tool is free with no sign-up, no page limits and no watermark on the output.",
  },
  {
    q: "Do you upload my files to a server?",
    a: "No. All tools process your files locally in your browser using WebAssembly and HTML5, so your videos, audio, and images stay entirely on your device.",
  },
  {
    q: "Why does video processing take longer than image tools?",
    a: "Audio and video are re-encoded on your own device, which is more intensive than converting an image. Image conversions (like PNG to JPG) are nearly instant because they use lightweight HTML5 Canvas.",
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
    name: "Video, Audio & Image tools",
    itemListElement: mediaTools.map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: tool.name,
      url: canonical(`/media-tools/${tool.slug}`),
    })),
  };

  return (
    <div className="container-page space-y-12 py-8 md:py-12">
      <JsonLd data={[breadcrumbJsonLd(crumbs), itemList, faqJsonLd(faqs)]} />
      <Breadcrumbs items={crumbs} />

      <header className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Video, Audio & Image tools</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Convert, compress and edit video, audio and images — right in your browser. No uploads, no sign-up,
          no watermarks. Just pick a tool and go.
        </p>
      </header>

      <ToolGrid tools={mediaTools} />

      <TrustBar />

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
