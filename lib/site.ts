/**
 * Global, environment-agnostic site configuration.
 * The canonical site URL is read from NEXT_PUBLIC_SITE_URL so the same build
 * works on Vercel, a preview deployment, or a future VPS without code changes.
 */

const rawUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

export const siteConfig = {
  name: "FreeOfficeTools",
  shortName: "FreeOfficeTools",
  domain: "freeofficetools.com",
  // Always an absolute origin with no trailing slash.
  url: (rawUrl && rawUrl.length > 0 ? rawUrl : "https://freeofficetools.com").replace(/\/$/, ""),
  tagline: "Free, private, fast document tools",
  description:
    "Free online PDF and document tools that run right in your browser. Merge, split, compress, convert and edit PDFs privately — no sign-up, no uploads, no limits.",
  locale: "en_US",
  twitter: "@freeofficetool",
  // Optional analytics / verification — env overrides the baked-in default.
  plausibleDomain: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim() || "",
  googleSiteVerification:
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() ||
    "AqWPlH1SiMkzHUd6GJxXrBr6AjdxiUrvf2mEjCHtjGE",
} as const;

export const mainNav = [
  { title: "PDF Tools", href: "/pdf-tools" },
  { title: "Media Tools", href: "/media-tools" },
  { title: "Office Tools", href: "/office-tools" },
  { title: "Guides", href: "/guides" },
  { title: "Security", href: "/security" },
  { title: "About", href: "/about" },
] as const;

export const footerNav = {
  pdf: [
    { title: "Merge PDF", href: "/pdf-tools/merge-pdf" },
    { title: "Split PDF", href: "/pdf-tools/split-pdf" },
    { title: "Compress PDF", href: "/pdf-tools/compress-pdf" },
    { title: "JPG to PDF", href: "/pdf-tools/jpg-to-pdf" },
    { title: "All PDF tools", href: "/pdf-tools" },
  ],
  media: [
    { title: "Video to MP3", href: "/media-tools/video-to-mp3" },
    { title: "MP4 to MP3", href: "/media-tools/mp4-to-mp3" },
    { title: "MOV to MP4", href: "/media-tools/mov-to-mp4" },
    { title: "PNG to JPG", href: "/media-tools/png-to-jpg" },
    { title: "JPG to PNG", href: "/media-tools/jpg-to-png" },
    { title: "Image Compressor", href: "/media-tools/image-compressor" },
    { title: "HEIC to JPG", href: "/media-tools/heic-to-jpg" },
    { title: "HEIC to PNG", href: "/media-tools/heic-to-png" },
    { title: "Metadata Checker", href: "/media-tools/metadata-checker" },
    { title: "Metadata Editor", href: "/media-tools/metadata-editor" },
    { title: "AI Metadata Remover", href: "/media-tools/ai-metadata-remover" },
    { title: "All media tools", href: "/media-tools" },
  ],
  office: [
    { title: "Word to PDF", href: "/office-tools/word-to-pdf" },
    { title: "PDF to Word", href: "/office-tools/pdf-to-word" },
    { title: "Excel to PDF", href: "/office-tools/excel-to-pdf" },
    { title: "PowerPoint to PDF", href: "/office-tools/powerpoint-to-pdf" },
    { title: "All office tools", href: "/office-tools" },
  ],
  company: [
    { title: "About", href: "/about" },
    { title: "Security", href: "/security" },
    { title: "Privacy", href: "/privacy" },
    { title: "Guides", href: "/guides" },
  ],
} as const;
