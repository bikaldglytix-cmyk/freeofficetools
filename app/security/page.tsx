import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Cpu, HardDrive } from "lucide-react";

import { siteConfig } from "@/lib/site";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { staticPageSeo } from "@/lib/static-pages";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/sections/breadcrumbs";
import { Button } from "@/components/ui/button";

const seo = staticPageSeo("/security");
export const metadata: Metadata = buildMetadata({
  title: seo.title,
  description: seo.description,
  path: seo.path,
  keywords: ["security", "privacy", "local processing", "webassembly", "secure pdf tools", "secure converter"],
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Security", path: "/security" },
];

export default function SecurityPage() {
  return (
    <div className="container-page py-8 md:py-12">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <div className="mx-auto max-w-3xl space-y-10">
        <div className="space-y-6">
          <Breadcrumbs items={crumbs} />
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">How We Protect Your Data</h1>
          <p className="text-xl leading-relaxed text-muted-foreground">
            Most online document tools ask you to upload your files to their servers. We think that's a massive security risk. That's why we built {siteConfig.name} differently.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6">
            <ShieldCheck className="size-8 text-primary" />
            <h3 className="mt-4 font-semibold text-foreground">Zero Uploads</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your files never leave your device. We do not have servers that collect, store, or process your documents.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <Cpu className="size-8 text-primary" />
            <h3 className="mt-4 font-semibold text-foreground">Local Processing</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              We leverage modern WebAssembly to run complex conversions directly inside your browser's memory.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <HardDrive className="size-8 text-primary" />
            <h3 className="mt-4 font-semibold text-foreground">Instant Deletion</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Once a task is done, the data vanishes from your browser's memory. There is absolutely no footprint left behind.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight">Our Methodology: How It Works</h2>
          <div className="space-y-4 leading-relaxed text-muted-foreground">
            <p>
              When you use a tool on {siteConfig.name} — whether it's merging a PDF or extracting audio from a video — the actual processing engine is downloaded to your browser as a piece of compiled code called <strong>WebAssembly (WASM)</strong>.
            </p>
            <p>
              This is a massive paradigm shift. Instead of sending your sensitive medical records, legal contracts, or personal photos to a remote server to be processed, we send the <i>processor</i> to you. Your browser acts as a secure sandbox. The file is loaded into the browser's local memory, processed by the WebAssembly engine, and then immediately offered back to you as a download.
            </p>
            <p>
              Because the file is never transmitted over the internet, we physically cannot see it, steal it, or accidentally leak it. It is <strong>mathematically impossible</strong> for us to access your data. 
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight">Why This Matters</h2>
          <div className="space-y-4 leading-relaxed text-muted-foreground">
            <p>
              Data breaches are incredibly common. When you upload a file to a &quot;free&quot; service, you are trusting them with your data. Often, that data is stored indefinitely, scanned, or even sold.
            </p>
            <p>
              By running the tools directly in your browser, we eliminate that risk entirely. You get the convenience of a web app with the absolute security of desktop software. Plus, skipping the upload/download phase makes our tools <strong>significantly faster</strong>.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/pdf-tools">
              Try a Secure PDF Tool <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/privacy">
              Read our Privacy Policy
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
