/**
 * Single source of truth for the SEO strings of static (non-registry) pages.
 *
 * Each page's `metadata` AND the /seo-audit report read from here, so the
 * audit can never drift from what actually ships — previously the audit
 * hardcoded its own copies of these strings and flagged phantom issues after
 * the real pages were edited.
 */

export interface StaticPageSeo {
  path: string;
  /** Raw title, pre-branding — lib/seo.ts `brandedTitle` appends the brand when it fits. */
  title: string;
  description: string;
  /** The query this page targets (surfaced in the /seo-audit report). */
  keyword: string;
  /** JSON-LD types the page renders (surfaced in the /seo-audit report). */
  schema: string;
}

export const staticPagesSeo: StaticPageSeo[] = [
  {
    path: "/",
    title: "FreeOfficeTools — Free PDF, Office & Media Tools Online",
    description:
      "Free online PDF, document and media tools in your browser. Merge, split, compress and convert PDFs, Word, Excel, video and audio — no sign-up, no uploads.",
    keyword: "free pdf, office & media tools",
    schema: "Organization, WebSite, ItemList, FAQ",
  },
  {
    path: "/pdf-tools",
    title: "All PDF Tools — Free & Private",
    description:
      "Every FreeOfficeTools PDF utility in one place: merge, split, compress, rotate, convert and watermark PDFs. Free, private and processed in your browser.",
    keyword: "free pdf tools",
    schema: "Breadcrumb, ItemList, FAQ",
  },
  {
    path: "/office-tools",
    title: "Free Office Tools — Convert Word, Excel & PowerPoint",
    description:
      "Free online office tools to convert Word, Excel and PowerPoint to PDF and back. Private, fast and no sign-up — every document converter in one place.",
    keyword: "office tools",
    schema: "Breadcrumb, ItemList, FAQ",
  },
  {
    path: "/media-tools",
    title: "Free Video, Audio & Image Tools — Private, In Your Browser",
    description:
      "Free video, audio and image tools in your browser: video to MP3, compress video, PNG to JPG, HEIC to JPG, metadata tools and more. No uploads, no sign-up.",
    keyword: "video, audio & image tools",
    schema: "Breadcrumb, ItemList, FAQ",
  },
  {
    path: "/guides",
    title: "Guides — Document & Media Tutorials",
    description:
      "Simple, practical guides for common tasks: how to merge PDFs, convert video to MP3, convert Word to PDF and more. Clear steps with free tools.",
    keyword: "pdf & media guides",
    schema: "Breadcrumb",
  },
  {
    path: "/security",
    title: "Security & Privacy Methodology",
    description:
      "Learn how FreeOfficeTools processes your files locally in your browser. We never upload, store, or see your data. Absolute privacy by design.",
    keyword: "freeofficetools security",
    schema: "Breadcrumb",
  },
  {
    path: "/about",
    title: "About FreeOfficeTools — The Ultimate Free Office Toolkit",
    description:
      "Learn about FreeOfficeTools: completely free, deeply private PDF and document tools that run in your browser — the one-stop solution for your office work.",
    keyword: "about freeofficetools",
    schema: "Breadcrumb",
  },
  {
    path: "/privacy",
    title: "Privacy Policy",
    description:
      "How FreeOfficeTools handles your data: files are processed in your browser and never uploaded. No accounts, no file storage, privacy-first analytics.",
    keyword: "freeofficetools privacy",
    schema: "Breadcrumb",
  },
];

const byPath = new Map(staticPagesSeo.map((p) => [p.path, p]));

/** Lookup that fails loudly at build time if a page references a missing entry. */
export function staticPageSeo(path: string): StaticPageSeo {
  const entry = byPath.get(path);
  if (!entry) throw new Error(`No static-page SEO entry for "${path}" — add it to lib/static-pages.ts`);
  return entry;
}
