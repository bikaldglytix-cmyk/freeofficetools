import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";
import { tools } from "@/lib/tools";
import { mediaTools } from "@/lib/media/tools";
import { officeTools, officeCategories } from "@/lib/office/tools";
import { guides } from "@/lib/guides";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const base = siteConfig.url;

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pdf-tools`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/office-tools`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/media-tools`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...officeCategories.map((c) => ({
      url: `${base}/${c.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    { url: `${base}/guides`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const toolPages: MetadataRoute.Sitemap = tools.map((tool) => ({
    url: `${base}/pdf-tools/${tool.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const mediaToolPages: MetadataRoute.Sitemap = mediaTools.map((tool) => ({
    url: `${base}/${tool.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const officeToolPages: MetadataRoute.Sitemap = officeTools.map((tool) => ({
    url: `${base}/${tool.slug}`,
    lastModified: now,
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
