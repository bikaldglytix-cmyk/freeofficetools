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
  { title: "PDF tools", href: "/pdf-tools" },
  { title: "Office tools", href: "/office-tools" },
  { title: "Media tools", href: "/media-tools" },
  { title: "Guides", href: "/guides" },
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
    { title: "Video to MP3", href: "/video-to-mp3" },
    { title: "MP4 to MP3", href: "/mp4-to-mp3" },
    { title: "Audio Converter", href: "/audio-converter" },
    { title: "Video Compressor", href: "/video-compressor" },
    { title: "All media tools", href: "/media-tools" },
  ],
  office: [
    { title: "Word to PDF", href: "/word-to-pdf" },
    { title: "PDF to Word", href: "/pdf-to-word" },
    { title: "Excel to PDF", href: "/excel-to-pdf" },
    { title: "PowerPoint to PDF", href: "/powerpoint-to-pdf" },
    { title: "All office tools", href: "/office-tools" },
  ],
  company: [
    { title: "About", href: "/about" },
    { title: "Privacy", href: "/privacy" },
    { title: "Guides", href: "/guides" },
  ],
} as const;
