/**
 * Live, HONEST SEO audit report, computed from the real page registries so it
 * can never drift from what ships. Returns Markdown. Excluded from crawling via
 * robots.ts. It reports the actual URLs and flags real issues (title length,
 * description length, tools without a guide) rather than asserting perfection.
 */
import { siteConfig } from "@/lib/site";
import { brandedTitle } from "@/lib/seo";
import { staticPagesSeo } from "@/lib/static-pages";
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

  // Read from the same registry the pages themselves use (lib/static-pages.ts),
  // so these rows can't drift from the shipped metadata.
  const staticRows: Row[] = staticPagesSeo.map((p) => row(p.path, p.keyword, p.title, p.description, p.schema));

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
