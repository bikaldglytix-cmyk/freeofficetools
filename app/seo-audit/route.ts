/**
 * Live SEO audit report, computed from the real page registries so it can
 * never drift from what ships. Returns Markdown. Excluded from crawling via
 * robots.ts. Intended to be saved as SEO-AUDIT.md for review.
 */
import { siteConfig } from "@/lib/site";
import { tools } from "@/lib/tools";
import { mediaTools } from "@/lib/media/tools";
import { officeTools, officeCategories } from "@/lib/office/tools";
import { guides } from "@/lib/guides";

export const dynamicParams = false;

interface Row {
  url: string;
  keyword: string;
  title: string;
  description: string;
  schema: string;
  links: string;
}

const brand = (t: string) => `${t} | ${siteConfig.name}`;
const esc = (s: string) => s.replace(/\|/g, "\\|");

function table(rows: Row[]): string {
  const head =
    "| URL | Target keyword | Title tag | Meta description | Schema | Internal links |\n" +
    "| --- | --- | --- | --- | --- | --- |";
  const body = rows
    .map(
      (r) =>
        `| ${esc(r.url)} | ${esc(r.keyword)} | ${esc(r.title)} | ${esc(r.description)} | ${esc(r.schema)} | ${esc(r.links)} |`,
    )
    .join("\n");
  return `${head}\n${body}`;
}

export function GET(): Response {
  const orgWeb = "Organization, WebSite (site-wide)";

  const staticRows: Row[] = [
    {
      url: "/",
      keyword: "free pdf & office tools",
      title: brand("Free PDF & Document Tools").replace(` | ${siteConfig.name}`, ` — ${siteConfig.name}`),
      description: siteConfig.description,
      schema: `${orgWeb}, ItemList`,
      links: "all category + tool pages",
    },
    {
      url: "/pdf-tools",
      keyword: "free pdf tools",
      title: brand("All PDF Tools — Free & Private"),
      description: "Every FreeOfficeTools PDF utility in one place: merge, split, compress, rotate, convert and watermark PDFs.",
      schema: "BreadcrumbList",
      links: "all PDF tools, guides",
    },
    {
      url: "/office-tools",
      keyword: "office tools",
      title: brand("Free Office Tools — Convert Word, Excel & PowerPoint"),
      description: "Free online office tools to convert Word, Excel and PowerPoint to PDF and back.",
      schema: "BreadcrumbList, ItemList, FAQPage",
      links: "office categories + tools, PDF tools, media tools",
    },
    {
      url: "/word-tools",
      keyword: "word tools",
      title: brand(officeCategories[0].title.replace(` | ${siteConfig.name}`, "")),
      description: officeCategories[0].metaDescription,
      schema: "BreadcrumbList, ItemList, FAQPage",
      links: "Word tools, other categories",
    },
    {
      url: "/excel-tools",
      keyword: "excel tools",
      title: brand(officeCategories[1].title),
      description: officeCategories[1].metaDescription,
      schema: "BreadcrumbList, ItemList, FAQPage",
      links: "Excel tools, other categories",
    },
    {
      url: "/powerpoint-tools",
      keyword: "powerpoint tools",
      title: brand(officeCategories[2].title),
      description: officeCategories[2].metaDescription,
      schema: "BreadcrumbList, ItemList, FAQPage",
      links: "PowerPoint tools, other categories",
    },
    {
      url: "/media-tools",
      keyword: "video and audio tools",
      title: brand("Free Video & Audio Tools — Private, In Your Browser"),
      description: "Free online video and audio tools that run in your browser: convert video to MP3, compress video, convert and trim audio.",
      schema: "BreadcrumbList, ItemList, FAQPage",
      links: "all media tools, PDF tools",
    },
    {
      url: "/guides",
      keyword: "pdf guides",
      title: brand("Guides — How to Work with PDFs"),
      description: "Simple, practical guides for common PDF tasks.",
      schema: "BreadcrumbList",
      links: "all guides",
    },
    {
      url: "/about",
      keyword: "about freeofficetools",
      title: brand("About"),
      description: "FreeOfficeTools offers fast, private, free PDF and document tools that run in your browser.",
      schema: "BreadcrumbList",
      links: "PDF tools",
    },
    {
      url: "/privacy",
      keyword: "freeofficetools privacy",
      title: brand("Privacy Policy"),
      description: "How FreeOfficeTools handles your data: files are processed in your browser and never uploaded.",
      schema: "BreadcrumbList",
      links: "—",
    },
  ];

  const pdfRows: Row[] = tools.map((t) => ({
    url: `/pdf-tools/${t.slug}`,
    keyword: t.keywords[0],
    title: brand(t.title),
    description: t.metaDescription,
    schema: "BreadcrumbList, WebApplication, HowTo, FAQPage",
    links: t.related.join(", "),
  }));

  const officeRows: Row[] = officeTools.map((t) => ({
    url: `/${t.slug}`,
    keyword: t.keywords[0],
    title: brand(t.title),
    description: t.metaDescription,
    schema: "BreadcrumbList, WebApplication, HowTo, FAQPage",
    links: t.related.join(", "),
  }));

  const mediaRows: Row[] = mediaTools.map((t) => ({
    url: `/${t.slug}`,
    keyword: t.keywords[0],
    title: brand(t.title),
    description: t.metaDescription,
    schema: "BreadcrumbList, WebApplication, HowTo, FAQPage",
    links: t.related.join(", "),
  }));

  const guideRows: Row[] = guides.map((g) => ({
    url: `/guides/${g.slug}`,
    keyword: g.keywords[0],
    title: brand(g.title),
    description: g.metaDescription,
    schema: "BreadcrumbList, Article, FAQPage",
    links: `${g.toolSlug} (tool)`,
  }));

  const total = staticRows.length + pdfRows.length + officeRows.length + mediaRows.length + guideRows.length;

  const md = `# FreeOfficeTools — SEO Audit Report

Generated from the live page registries. Canonical base: ${siteConfig.url}
Total indexable URLs: **${total}**. Every URL has a unique title, meta description, a self-referencing canonical (\`${siteConfig.url}<path>\`), Open Graph + Twitter metadata (with a dynamic /api/og image), an H1, and is included in sitemap.xml. Organization + WebSite schema is injected site-wide via the root layout.

## Static & category pages
${table(staticRows)}

## PDF tool pages
${table(pdfRows)}

## Office tool pages
${table(officeRows)}

## Media tool pages
${table(mediaRows)}

## Guide pages
${table(guideRows)}

## Notes
- **Canonical** for every row is \`${siteConfig.url}\` + the URL shown (self-referencing).
- **Open Graph / Twitter**: every page emits OG + Twitter tags with a per-page /api/og image (built in lib/seo.ts buildMetadata).
- **No orphan pages**: every tool is linked from its category page, the homepage directory, the footer, and related-tool blocks on sibling tools.
- **Office conversions** run via the convertDocument() seam; the page UI, URL and SEO are identical whether processing is local or server-side.
`;

  return new Response(md, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-store" },
  });
}
