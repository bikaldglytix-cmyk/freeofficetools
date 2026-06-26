/**
 * Data-driven guides. Each guide is a structured document rendered by a single
 * template. This is a lean content pipeline: adding a guide means adding one
 * object here — no MDX build config, no per-page boilerplate, consistent SEO.
 */

export interface GuideSection {
  heading: string;
  /** Paragraphs of body copy. */
  body: string[];
  /** Optional ordered steps rendered as a numbered list. */
  steps?: string[];
}

export interface GuideDefinition {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  intro: string[];
  keywords: string[];
  updated: string; // ISO date
  /** Primary tool this guide points readers to. */
  toolSlug: string;
  sections: GuideSection[];
  faqs: { q: string; a: string }[];
}

export const guides: GuideDefinition[] = [
  {
    slug: "how-to-merge-pdf-files",
    title: "How to Merge PDF Files (Free, No Software)",
    metaDescription:
      "Learn how to merge PDF files for free without installing software. A simple, private, step-by-step guide to combining multiple PDFs into one document.",
    h1: "How to merge PDF files",
    keywords: ["how to merge pdf", "combine pdf files", "merge pdf without software", "join pdfs"],
    updated: "2026-06-24",
    toolSlug: "merge-pdf",
    intro: [
      "Merging PDFs combines several documents into one file that's easier to send, print and store. You might join scanned receipts for an expense report, stitch chapters into a single book, or combine signed pages back into a contract.",
      "This guide shows the fastest way to merge PDFs for free — entirely in your browser, with nothing to install and no files uploaded to a server.",
    ],
    sections: [
      {
        heading: "Merge PDFs in your browser (recommended)",
        body: [
          "The simplest method needs no software and keeps your files private, because the work happens on your own device.",
        ],
        steps: [
          "Open the free Merge PDF tool.",
          "Drag in the PDF files you want to combine, or click to browse for them.",
          "Drag the files up or down to set the page order.",
          "Click Merge PDF and download your single combined document.",
        ],
      },
      {
        heading: "Tips for a clean merge",
        body: [
          "Name your files in the order you want them (for example 01-cover, 02-body) so they're easy to arrange.",
          "If a file has pages you don't need, remove them first with the Delete PDF Pages tool, then merge.",
          "For very large documents, merge in smaller batches to keep things fast on lower-powered devices.",
        ],
      },
      {
        heading: "Is it safe to merge PDFs online?",
        body: [
          "It depends on the tool. Many online services upload your files to their servers. FreeOfficeTools runs the merge locally in your browser, so your documents never leave your computer — which matters for contracts, IDs and anything confidential.",
        ],
      },
    ],
    faqs: [
      { q: "Can I merge PDFs for free?", a: "Yes. The Merge PDF tool is free with no page limits, no sign-up and no watermark." },
      { q: "Do I need to install anything?", a: "No. Merging works in any modern browser with nothing to download or install." },
      { q: "Will my files be uploaded?", a: "No. The merge runs in your browser, so your PDFs stay on your device." },
    ],
  },
  {
    slug: "how-to-reduce-pdf-file-size",
    title: "How to Reduce PDF File Size (Free & Private)",
    metaDescription:
      "Learn how to reduce PDF file size for free so it fits email and upload limits. A clear guide to compressing PDFs in your browser without losing readability.",
    h1: "How to reduce PDF file size",
    keywords: ["reduce pdf file size", "compress pdf", "make pdf smaller", "shrink pdf for email"],
    updated: "2026-06-24",
    toolSlug: "compress-pdf",
    intro: [
      "A PDF that's too large can bounce back from email or stall on upload. Reducing its file size makes it easy to share, while keeping the document readable.",
      "This guide explains what makes PDFs large, how compression works, and how to shrink a PDF for free in your browser.",
    ],
    sections: [
      {
        heading: "Why PDFs get large",
        body: [
          "Most oversized PDFs are heavy because of images — scanned pages, photos and screenshots store a lot of data. Text, by contrast, is tiny. That's why scanned documents compress far more than text-only files.",
        ],
      },
      {
        heading: "Compress a PDF in your browser",
        body: ["The fastest free method runs entirely on your device and lets you choose the quality."],
        steps: [
          "Open the Compress PDF tool.",
          "Drag in your PDF or click to select it.",
          "Choose a quality level — Recommended balances size and clarity.",
          "Download the smaller file and check the before/after size.",
        ],
      },
      {
        heading: "Get the smallest size without ruining quality",
        body: [
          "Start with the Recommended setting and only move to a stronger level if you still need a smaller file.",
          "If your PDF is mostly text, it's already small — expect modest savings.",
          "For emailing, aim to stay under your provider's attachment limit (often 20–25 MB).",
        ],
      },
    ],
    faqs: [
      { q: "How small can I make a PDF?", a: "Scanned and image-heavy PDFs often shrink by 50–90%. Text-only PDFs are already compact and shrink less." },
      { q: "Will compressing lower the quality?", a: "Compression optimizes images, so very strong settings soften them. The Recommended level keeps documents clearly readable." },
      { q: "Is it private?", a: "Yes. Compression happens in your browser, so your file is never uploaded." },
    ],
  },
  {
    slug: "how-to-convert-jpg-to-pdf",
    title: "How to Convert JPG to PDF (Free, In Your Browser)",
    metaDescription:
      "Learn how to convert JPG and PNG images to PDF for free. A step-by-step guide to combining photos and scans into one tidy PDF, privately in your browser.",
    h1: "How to convert JPG to PDF",
    keywords: ["convert jpg to pdf", "jpg to pdf", "images to pdf", "png to pdf", "photo to pdf"],
    updated: "2026-06-24",
    toolSlug: "jpg-to-pdf",
    intro: [
      "Turning images into a PDF makes them easy to share and print as a single file. It's the simplest way to send a set of photographed documents, receipts or scanned pages.",
      "This guide shows how to convert JPG or PNG images to a PDF for free, with control over page size and order — all in your browser.",
    ],
    sections: [
      {
        heading: "Convert images to a PDF",
        body: ["No software needed — add your images, arrange them, and download a single PDF."],
        steps: [
          "Open the JPG to PDF tool.",
          "Drag in your JPG or PNG images, or click to select them.",
          "Drag images into the order you want and pick a page size.",
          "Click Convert and download your PDF.",
        ],
      },
      {
        heading: "Get the best-looking result",
        body: [
          "Use the highest-quality versions of your images for sharp pages.",
          "Choose A4 or US Letter for documents you plan to print.",
          "Crop or straighten photographed documents before converting for a cleaner look.",
        ],
      },
    ],
    faqs: [
      { q: "Can I combine several images into one PDF?", a: "Yes. Add as many JPG or PNG images as you like; each becomes a page in a single PDF." },
      { q: "Is converting JPG to PDF free?", a: "Yes. It's free with no sign-up, no limits and no watermark." },
      { q: "Are my images uploaded?", a: "No. The conversion happens in your browser, so your images stay private." },
    ],
  },
];

const guideBySlug = new Map(guides.map((g) => [g.slug, g]));

export function getGuide(slug: string): GuideDefinition | undefined {
  return guideBySlug.get(slug);
}

export const guideSlugs = guides.map((g) => g.slug);
