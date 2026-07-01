import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";
import { tools } from "@/lib/tools";
import { mediaTools } from "@/lib/media/tools";
import { officeTools } from "@/lib/office/tools";
import { guides } from "@/lib/guides";

// Bump when tool/page content meaningfully changes. A stable date keeps
// <lastmod> honest — using `new Date()` would claim every page changed on every
// deploy, which erodes the value of the signal.
const SITE_UPDATED = new Date("2026-07-02");

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = SITE_UPDATED;
  const base = siteConfig.url;

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: updated, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pdf-tools`, lastModified: updated, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/office-tools`, lastModified: updated, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/media-tools`, lastModified: updated, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/guides`, lastModified: updated, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/security`, lastModified: updated, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/about`, lastModified: updated, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/privacy`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
  ];

  const toolPages: MetadataRoute.Sitemap = tools.map((tool) => ({
    url: `${base}/pdf-tools/${tool.slug}`,
    lastModified: updated,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const mediaToolPages: MetadataRoute.Sitemap = mediaTools.map((tool) => ({
    url: `${base}/media-tools/${tool.slug}`,
    lastModified: updated,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const officeToolPages: MetadataRoute.Sitemap = officeTools.map((tool) => ({
    url: `${base}/office-tools/${tool.slug}`,
    lastModified: updated,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const guidePages: MetadataRoute.Sitemap = guides.map((guide) => ({
    url: `${base}/guides/${guide.slug}`,
    lastModified: new Date(guide.updated),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticPages, ...toolPages, ...mediaToolPages, ...officeToolPages, ...guidePages];
}
