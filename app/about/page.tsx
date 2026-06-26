import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { siteConfig } from "@/lib/site";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/sections/breadcrumbs";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = buildMetadata({
  title: "About",
  description:
    "FreeOfficeTools offers fast, private, free PDF and document tools that run in your browser — no sign-up, no uploads, no watermarks.",
  path: "/about",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "About", path: "/about" },
];

export default function AboutPage() {
  return (
    <div className="container-page py-8 md:py-12">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <div className="mx-auto max-w-3xl space-y-6">
        <Breadcrumbs items={crumbs} />
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">About {siteConfig.name}</h1>
        <div className="space-y-4 leading-relaxed text-muted-foreground">
          <p>
            {siteConfig.name} is a growing collection of free document tools built around one idea:
            getting everyday PDF tasks done should be fast, private and effortless.
          </p>
          <p>
            Most of our tools run entirely in your browser. When you merge, split, compress or convert
            a file, the work happens on your own device — your documents are never uploaded to a
            server. That makes the tools faster (no upload wait) and far more private, which matters
            for contracts, IDs, medical records and anything else you&apos;d rather keep to yourself.
          </p>
          <p>
            There are no accounts to create, no email to hand over, and no watermarks stamped on your
            results. We keep the interface clean and the steps obvious, so you can do what you came to
            do and move on.
          </p>
          <p>
            We&apos;re just getting started. The toolset will keep expanding based on what people
            actually need — always with the same focus on speed, clarity and privacy.
          </p>
        </div>
        <Button asChild>
          <Link href="/pdf-tools">
            Explore the tools <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
