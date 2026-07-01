import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { siteConfig } from "@/lib/site";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { staticPageSeo } from "@/lib/static-pages";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/sections/breadcrumbs";
import { Button } from "@/components/ui/button";

const seo = staticPageSeo("/about");
export const metadata: Metadata = buildMetadata({
  title: seo.title,
  description: seo.description,
  path: seo.path,
  keywords: ["about freeofficetools", "free office tools", "one stop solution office", "free online pdf editor", "private pdf tools", "completely free office suite"],
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
            Welcome to {siteConfig.name}, the ultimate <strong className="text-foreground font-semibold">one-stop solution</strong> for all your office works and document needs. We built this platform with a single, uncompromising vision: to provide a powerful, comprehensive suite of tools that is <strong className="text-foreground font-semibold">100% completely free</strong>, blazingly fast, and built on an absolute guarantee of privacy.
          </p>
          <p>
            Whether you need a free online PDF editor, a reliable Word to PDF converter, an Excel data extractor, or tools to compress and merge PDFs, you will find everything you need right here. We've consolidated the fragmented world of office utilities into one seamless, premium experience.
          </p>
          <p>
            <strong className="text-foreground font-semibold">Unmatched Privacy Focus:</strong> We believe your data belongs to you. That's why our tools process your files locally inside your browser using cutting-edge WebAssembly technology. Your sensitive documents, financial spreadsheets, and personal PDFs are <strong className="text-foreground font-semibold">never uploaded to our servers</strong>. It's privacy by design, meaning zero risk of data leaks because your files never leave your device.
          </p>
          <p>
            <strong className="text-foreground font-semibold">Completely Free Forever:</strong> You will never hit a paywall here. There are no accounts to create, no credit cards required, no annoying email sign-ups, and absolutely no watermarks stamped on your hard work. Just clean, professional results every single time.
          </p>
          <p>
            Say goodbye to downloading expensive, clunky software. {siteConfig.name} is the only online document platform you will ever need.
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
