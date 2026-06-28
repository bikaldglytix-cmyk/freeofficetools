/**
 * Live, HONEST SEO audit report, computed from the real page registries so it
 * can never drift from what ships. Returns Markdown. Excluded from crawling via
 * robots.ts. It reports the actual URLs and flags real issues (title length,
 * description length, tools without a guide) rather than asserting perfection.
 */
import { siteConfig } from "@/lib/site";
import { brandedTitle } from "@/lib/seo";
import { tools } from "@/lib/tools";
import { mediaTools } from "@/lib/media/tools";
import { officeTools } from "@/lib/office/tools";
import { guides } from "@/lib/guides";

export const dynamicParams = false;

interface Row {
  url: string;
  keyword: string;
  title: string;
  titleLen: number;
  descLen: number;
  schema: string;
}

const esc = (s: string) => s.replace(/\|/g, "\\|");
const TITLE_MAX = 60;
const DESC_MIN = 70;
const DESC_MAX = 160;

function table(rows: Row[]): string {
  const head =
    "| URL | Target keyword | Title (rendered) | Title len | Desc len | Schema |\n" +
    "| --- | --- | --- | --- | --- | --- |";
  const body = rows
    .map((r) => {
      const t = r.titleLen > TITLE_MAX ? `**${r.titleLen}**` : `${r.titleLen}`;
      const d = r.descLen > DESC_MAX || r.descLen < DESC_MIN ? `**${r.descLen}**` : `${r.descLen}`;
      return `| ${esc(r.url)} | ${esc(r.keyword)} | ${esc(r.title)} | ${t} | ${d} | ${esc(r.schema)} |`;
    })
    .join("\n");
  return `${head}\n${body}`;
}

export function GET(): Response {
  const toolSchema = "Breadcrumb, WebApplication, HowTo, FAQ";

  const staticRows: Row[] = [
    row("/", "free pdf, office & media tools", "FreeOfficeTools — Free PDF, Office & Media Tools Online", siteConfig.description, "Organization, WebSite, ItemList, FAQ"),
    row("/pdf-tools", "free pdf tools", "All PDF Tools — Free & Private", "Every FreeOfficeTools PDF utility in one place: merge, split, compress, rotate, convert and watermark PDFs.", "Breadcrumb, ItemList, FAQ"),
    row("/office-tools", "office tools", "Free Office Tools — Convert Word, Excel & PowerPoint", "Free online office tools to convert Word, Excel and PowerPoint to PDF and back.", "Breadcrumb, ItemList, FAQ"),
    row("/media-tools", "video, audio & image tools", "Free Video, Audio & Image Tools — Private, In Your Browser", "Free online video, audio and image tools that run in your browser.", "Breadcrumb, ItemList, FAQ"),
    row("/guides", "pdf & media guides", "Guides — Document & Media Tutorials", "Simple, practical guides for common PDF, document and media tasks.", "Breadcrumb"),
    row("/security", "freeofficetools security", "Security & Privacy Methodology", "How FreeOfficeTools processes files privately in your browser.", "Breadcrumb"),
    row("/about", "about freeofficetools", "About", "FreeOfficeTools offers fast, private, free PDF and document tools that run in your browser.", "Breadcrumb"),
    row("/privacy", "freeofficetools privacy", "Privacy Policy", "How FreeOfficeTools handles your data: files are processed in your browser and never uploaded.", "Breadcrumb"),
  ];

  const pdfRows = tools.map((t) => row(`/pdf-tools/${t.slug}`, t.keywords[0], t.title, t.metaDescription, toolSchema));
  const officeRows = officeTools.map((t) => row(`/office-tools/${t.slug}`, t.keywords[0], t.title, t.metaDescription, toolSchema));
  const mediaRows = mediaTools.map((t) => row(`/media-tools/${t.slug}`, t.keywords[0], t.title, t.metaDescription, toolSchema));
  const guideRows = guides.map((g) => row(`/guides/${g.slug}`, g.keywords[0], g.title, g.metaDescription, "Breadcrumb, Article, FAQ"));

  const all = [...staticRows, ...pdfRows, ...officeRows, ...mediaRows, ...guideRows];
  const longTitles = all.filter((r) => r.titleLen > TITLE_MAX);
  const badDesc = all.filter((r) => r.descLen > DESC_MAX || r.descLen < DESC_MIN);

  // Tools whose how-to guide is missing (an internal-linking / content opportunity).
  const guideSlugs = new Set(guides.map((g) => g.toolSlug));
  const toolsWithoutGuide = [
    ...tools.map((t) => `/pdf-tools/${t.slug}`).filter((_, i) => !guideSlugs.has(tools[i].slug)),
    ...officeTools.map((t) => `/office-tools/${t.slug}`).filter((_, i) => !guideSlugs.has(officeTools[i].slug)),
    ...mediaTools.map((t) => `/media-tools/${t.slug}`).filter((_, i) => !guideSlugs.has(mediaTools[i].slug)),
  ];

  const warnings: string[] = [];
  if (longTitles.length) warnings.push(`- ${longTitles.length} rendered title(s) over ${TITLE_MAX} chars: ${longTitles.map((r) => r.url).join(", ")}`);
  if (badDesc.length) warnings.push(`- ${badDesc.length} meta description(s) outside ${DESC_MIN}–${DESC_MAX} chars: ${badDesc.map((r) => r.url).join(", ")}`);
  if (toolsWithoutGuide.length) warnings.push(`- ${toolsWithoutGuide.length} tool(s) without a how-to guide (opportunity): ${toolsWithoutGuide.join(", ")}`);
  const warningsBlock = warnings.length ? warnings.join("\n") : "- None detected. ✅";

  const md = `# FreeOfficeTools — SEO Audit (auto-generated)

Canonical base: ${siteConfig.url}
Total indexable URLs: **${all.length}** — ${tools.length} PDF, ${officeTools.length} office, ${mediaTools.length} media tools, ${guides.length} guides, ${staticRows.length} static.

Each URL has a unique title, meta description, a self-referencing canonical, Open Graph + Twitter tags (dynamic /api/og image), one H1, and is in sitemap.xml. The brand is appended to the title only when it keeps the tag under ${TITLE_MAX} chars (see lib/seo.ts \`brandedTitle\`). **Title len** / **Desc len** below are the rendered character counts; bold = out of the recommended range.

## ⚠️ Issues & opportunities (computed)
${warningsBlock}

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

## Known limitations (not auto-detectable here)
- Image tool depth varies; the JPG/PNG/HEIC converters were expanded but remain shorter than the PDF pages.
- \`lastmod\` in sitemap.xml uses a single maintained date (lib/sitemap.ts \`SITE_UPDATED\`), not per-page change tracking.
- Core Web Vitals are not measured here — verify with field data (CrUX) / Lighthouse.
`;

  return new Response(md, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function row(url: string, keyword: string, rawTitle: string, description: string, schema: string): Row {
  const title = brandedTitle(rawTitle);
  return { url, keyword, title, titleLen: title.length, descLen: description.length, schema };
}
