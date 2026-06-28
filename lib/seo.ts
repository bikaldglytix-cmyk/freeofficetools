import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";
import type { ToolDefinition, ToolStep } from "@/lib/tools";
import type { MediaToolDefinition } from "@/lib/media/tools";
import type { OfficeToolDefinition } from "@/lib/office/tools";

interface BuildMetadataInput {
  title: string;
  description: string;
  /** Absolute path beginning with "/" used for the canonical URL. */
  path: string;
  keywords?: string[];
  ogImage?: string;
  /** Set false for pages that should not be indexed (e.g. thin/utility pages). */
  index?: boolean;
}

/** Dynamic, per-page Open Graph image rendered by the /api/og route. */
function ogImageFor(title: string): string {
  return `/api/og?title=${encodeURIComponent(title)}`;
}

/** Google truncates titles around here; keep the rendered <title> under it. */
const TITLE_MAX = 60;

/**
 * Append the brand only when it still fits under the SERP truncation limit.
 * Longer, keyword-rich titles render on their own (the brand would only get cut
 * off anyway), and a title that already contains the brand is never doubled.
 * Returned as `{ absolute }` so Next never re-applies the layout title template.
 */
export function brandedTitle(title: string): string {
  const branded = `${title} | ${siteConfig.name}`;
  if (title.includes(siteConfig.name)) return title;
  return branded.length <= TITLE_MAX ? branded : title;
}

/** Single source of truth for page metadata: canonical, Open Graph and Twitter. */
export function buildMetadata({
  title,
  description,
  path,
  keywords,
  ogImage,
  index = true,
}: BuildMetadataInput): Metadata {
  const url = canonical(path);
  const image = ogImage ?? ogImageFor(title);
  return {
    title: { absolute: brandedTitle(title) },
    description,
    keywords: keywords && keywords.length ? keywords : undefined,
    alternates: { canonical: url },
    robots: index
      ? { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 }
      : { index: false, follow: true },
    openGraph: {
      type: "website",
      url,
      siteName: siteConfig.name,
      title,
      description,
      locale: siteConfig.locale,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
      site: siteConfig.twitter,
    },
  };
}

/** Absolute canonical URL for a path. */
export function canonical(path: string): string {
  if (path === "/") return siteConfig.url;
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/* ---------------------------------------------------------------------------
 * Structured data (JSON-LD)
 * ------------------------------------------------------------------------- */

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: `${siteConfig.url}/icon.svg`,
    description: siteConfig.description,
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    inLanguage: "en",
    publisher: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
  };
}

export function webApplicationJsonLd(tool: ToolDefinition) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${tool.name} — ${siteConfig.name}`,
    url: canonical(`/pdf-tools/${tool.slug}`),
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires a modern web browser with JavaScript enabled.",
    description: tool.metaDescription,
    inLanguage: "en",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

export function mediaApplicationJsonLd(tool: MediaToolDefinition) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${tool.name} — ${siteConfig.name}`,
    url: canonical(`/media-tools/${tool.slug}`),
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires a modern web browser with JavaScript enabled.",
    description: tool.metaDescription,
    inLanguage: "en",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

export function faqJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function officeApplicationJsonLd(tool: OfficeToolDefinition) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${tool.name} — ${siteConfig.name}`,
    url: canonical(`/office-tools/${tool.slug}`),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires a modern web browser with JavaScript enabled.",
    description: tool.metaDescription,
    inLanguage: "en",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

export function howToJsonLd(tool: { name: string; metaDescription: string; steps: ToolStep[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to ${tool.name.toLowerCase()}`,
    description: tool.metaDescription,
    step: tool.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title,
      text: s.text,
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: canonical(item.path),
    })),
  };
}
