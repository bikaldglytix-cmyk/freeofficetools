import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MousePointerClick, Upload, Download } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ToolCategory } from "@/lib/links";
import { WarmLink } from "@/components/sections/warm-link";
import { tools } from "@/lib/tools";
import { mediaTools } from "@/lib/media/tools";
import { officeTools } from "@/lib/office/tools";
import { buildMetadata, canonical, faqJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { TrustBar } from "@/components/sections/trust-bar";
import { Faq } from "@/components/sections/faq";
import { AppMockup } from "@/components/sections/app-mockup";

export const metadata: Metadata = buildMetadata({
  title: "FreeOfficeTools — Free PDF, Office & Media Tools Online",
  description:
    "Free online PDF, document and media tools that run in your browser. Merge, split, compress, convert PDFs, Word, Excel, PowerPoint, video and audio — no sign-up, no uploads, no watermarks.",
  path: "/",
  keywords: [
    "free pdf tools",
    "online pdf editor",
    "merge pdf",
    "compress pdf",
    "word to pdf",
    "video to mp3",
    "free office tools",
    "document converter",
    "pdf tools online",
    "audio converter",
  ],
});

interface TileItem {
  name: string;
  href: string;
  Icon: LucideIcon;
  category: ToolCategory;
  slug: string;
}

function ToolSection({
  id,
  title,
  blurb,
  viewAllHref,
  items,
}: {
  id: string;
  title: string;
  blurb: string;
  viewAllHref: string;
  items: TileItem[];
}) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id={id} className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {title}
          </h2>
          <Link
            href={viewAllHref}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all <ArrowRight className="size-4" />
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
      </div>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.href}>
            <WarmLink
              href={item.href}
              warmCategory={item.category}
              warmSlug={item.slug}
              className="group flex h-full items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.Icon className="size-[18px]" />
              </span>
              <span className="text-sm font-medium leading-tight text-foreground transition-colors group-hover:text-primary">
                {item.name}
              </span>
            </WarmLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

const howItWorks = [
  { Icon: MousePointerClick, title: "Select a tool", text: "Choose from our massive suite of PDF, Office, and media utilities." },
  { Icon: Upload, title: "Process locally", text: "Drag and drop your file. We process it directly in your browser for absolute privacy." },
  { Icon: Download, title: "Instant download", text: "Get your polished result instantly. No sign-up, no watermarks, no limits." },
];

const homeFaqs = [
  {
    q: "Is FreeOfficeTools really free?",
    a: "Yes. Every tool is free to use with no sign-up, no limits and no watermark on the result.",
  },
  {
    q: "Are my files private?",
    a: "Most tools (all PDF and media tools) process your files directly in your browser, so they're never uploaded to a server. Office document conversions run on a secure server and the file is deleted right after.",
  },
  {
    q: "What can I do with the PDF tools?",
    a: "You can merge, split, compress, rotate, reorder and watermark PDFs, plus convert between PDF and JPG images — all free and in your browser.",
  },
  {
    q: "Can I convert Word, Excel and PowerPoint to PDF?",
    a: "Yes. Convert Word (DOC/DOCX), Excel (XLS/XLSX) and PowerPoint (PPT/PPTX) files to PDF with the layout preserved.",
  },
  {
    q: "Can I convert video and audio files?",
    a: "Yes. Convert video to MP3, extract audio, change formats and compress video — all in your browser with nothing to install.",
  },
  {
    q: "Do I need to install anything or create an account?",
    a: "No. FreeOfficeTools runs in any modern browser. There's nothing to download and no account required.",
  },
];

export default function HomePage() {
  const directory = [
    ...tools.map((t) => ({ name: t.name, url: canonical(`/pdf-tools/${t.slug}`) })),
    ...officeTools.map((t) => ({ name: t.name, url: canonical(`/office-tools/${t.slug}`) })),
    ...mediaTools.map((t) => ({ name: t.name, url: canonical(`/media-tools/${t.slug}`) })),
  ];
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: directory.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: item.url,
    })),
  };

  const pdfItems: TileItem[] = tools.map((t) => ({ name: t.name, href: `/pdf-tools/${t.slug}`, Icon: t.icon, category: "pdf", slug: t.slug }));
  const officeItems: TileItem[] = officeTools.map((t) => ({ name: t.name, href: `/office-tools/${t.slug}`, Icon: t.icon, category: "office", slug: t.slug }));
  const mediaItems: TileItem[] = mediaTools.map((t) => ({ name: t.name, href: `/media-tools/${t.slug}`, Icon: t.icon, category: "media", slug: t.slug }));

  return (
    <div className="mx-auto max-w-5xl space-y-16 px-4 pb-24 pt-8 sm:px-6 md:space-y-24 md:pt-16">
      <JsonLd data={[itemList, faqJsonLd(homeFaqs)]} />

      {/* Hero */}
      <section className="text-center">
        <h1 className="text-balance text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl md:text-7xl">
          Free PDF, Office &amp; Media Tools
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:mt-6 sm:text-xl">
          The one-stop solution for all your office work — edit PDFs, convert documents, and process
          media files directly in your browser. <span className="font-semibold text-foreground">Zero server uploads. Zero sign-ups. 100% free forever.</span>
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/pdf-tools"
            className="flex h-12 w-full items-center justify-center rounded-lg bg-foreground px-8 text-[15px] font-medium text-background shadow-lift transition-transform hover:scale-[1.02] sm:w-auto"
          >
            Explore Tools <ArrowRight className="ml-2 size-4" />
          </Link>
          <Link
            href="/pdf-tools/edit-pdf"
            className="flex h-12 w-full items-center justify-center rounded-lg border border-border/60 bg-card px-8 text-[15px] font-medium text-foreground hover:bg-muted/50 sm:w-auto"
          >
            Try Free PDF Editor
          </Link>
        </div>

        <AppMockup />
      </section>

      {/* Tools directory */}
      <div className="space-y-12">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Every tool you need, in one place
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
            Pick a tool below to get started — no setup, no sign-up.
          </p>
        </div>

        <ToolSection
          id="home-pdf-heading"
          title="PDF tools"
          blurb="Merge, split, compress, convert and edit PDF files."
          viewAllHref="/pdf-tools"
          items={pdfItems}
        />
        <ToolSection
          id="home-office-heading"
          title="Office & document converters"
          blurb="Convert Word, Excel and PowerPoint to and from PDF."
          viewAllHref="/office-tools"
          items={officeItems}
        />
        <ToolSection
          id="home-media-heading"
          title="Video, Audio & Image tools"
          blurb="Convert, compress and edit video, audio and images natively in your browser."
          viewAllHref="/media-tools"
          items={mediaItems}
        />
      </div>

      {/* How it works */}
      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          How it works
        </h2>
        <ol className="mt-8 grid gap-5 sm:grid-cols-3">
          {howItWorks.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-border/50 bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.Icon className="size-5" />
                </span>
                <span className="text-sm font-semibold text-muted-foreground">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold text-foreground">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Why */}
      <section aria-labelledby="why-heading" className="rounded-3xl border border-border/40 bg-muted/10 p-8 text-center md:p-12">
        <h2 id="why-heading" className="mb-8 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Built for speed and privacy
        </h2>
        <TrustBar />
      </section>

      {/* FAQ */}
      <section aria-labelledby="home-faq-heading" className="mx-auto max-w-3xl">
        <h2 id="home-faq-heading" className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Frequently asked questions
        </h2>
        <div className="mt-6">
          <Faq faqs={homeFaqs} title="" />
        </div>
      </section>

      {/* SEO content */}
      <section className="mx-auto max-w-3xl text-center">
        <p className="text-sm leading-relaxed text-muted-foreground">
          FreeOfficeTools is a free online toolkit for PDFs and documents. Merge, split, compress and
          convert PDF files, turn Word, Excel and PowerPoint into PDF, and convert video and audio —
          all in your browser, with no sign-up, no installs and no watermarks.
        </p>
      </section>
    </div>
  );
}
