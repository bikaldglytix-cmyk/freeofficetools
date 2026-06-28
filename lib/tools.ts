import type { LucideIcon } from "lucide-react";
import {
  Combine,
  Scissors,
  Shrink,
  RotateCw,
  FileX2,
  FileOutput,
  ListOrdered,
  Images,
  Image as ImageIcon,
  Stamp,
  FilePenLine,
} from "lucide-react";

export type ProcessingLocation = "client" | "server";

export interface ToolStep {
  title: string;
  text: string;
}

export interface ToolFaq {
  q: string;
  a: string;
}

export interface ToolDefinition {
  /** URL-safe identifier, also the last URL segment. */
  slug: string;
  /** Display name used in cards, nav and breadcrumbs. */
  name: string;
  category: "pdf";
  icon: LucideIcon;
  /** Where the work happens today. The UI never changes if this moves to "server" later. */
  processing: ProcessingLocation;

  /** Short, card-friendly description. */
  short: string;
  /** SEO <title> without brand; buildMetadata() appends the brand only when it fits. */
  title: string;
  metaDescription: string;
  h1: string;
  heroSubtitle: string;
  keywords: string[];

  /** Long-form, intent-matching copy. Each string is a paragraph. */
  intro: string[];
  steps: ToolStep[];
  faqs: ToolFaq[];
  related: string[];

  /** Input handling for the interactive widget. */
  accept: string;
  acceptLabel: string;
  multiple: boolean;
}

export const tools: ToolDefinition[] = [
  {
    slug: "merge-pdf",
    name: "Merge PDF",
    category: "pdf",
    icon: Combine,
    processing: "client",
    short: "Combine multiple PDF files into one, in the order you choose.",
    title: "Merge PDF — Combine PDF Files Online Free",
    metaDescription:
      "Merge PDF files online for free. Combine multiple PDFs into a single document in any order, right in your browser. No sign-up, no uploads, no watermarks.",
    h1: "Merge PDF files",
    heroSubtitle: "Combine several PDFs into one tidy document. Drag to reorder, then download in seconds.",
    keywords: ["merge pdf", "combine pdf", "join pdf files", "merge pdf online", "pdf merger free"],
    intro: [
      "Merging PDFs is the fastest way to turn scattered files — invoices, scans, chapters, signed contracts — into one document that is easy to share and print. This tool combines any number of PDFs into a single file and lets you set the exact page order before you download.",
      "Everything runs locally in your browser, so your files never leave your device. There is nothing to install, no account to create, and no watermark added to the result.",
    ],
    steps: [
      { title: "Add your PDFs", text: "Drag and drop your PDF files into the box, or click to browse and select them." },
      { title: "Set the order", text: "Drag files up or down so the pages end up in the sequence you want." },
      { title: "Merge and download", text: "Click Merge PDF and your combined document downloads instantly." },
    ],
    faqs: [
      { q: "Is merging PDFs free?", a: "Yes. Merging is completely free with no page limits, no sign-up and no watermark on the output." },
      { q: "Are my files uploaded to a server?", a: "No. The merge happens entirely in your browser using your device's own processing, so your documents stay private." },
      { q: "How many PDFs can I combine at once?", a: "You can merge as many files as your device's memory allows. For very large jobs, merge in smaller batches for the best performance." },
      { q: "Will the quality or formatting change?", a: "No. Pages are copied exactly as they are, so text stays sharp and selectable and the layout is preserved." },
      { q: "Can I change the order of the files?", a: "Yes. Drag any file up or down in the list before merging to control the final page order." },
    ],
    related: ["split-pdf", "reorder-pdf-pages", "delete-pdf-pages", "compress-pdf"],
    accept: "application/pdf,.pdf",
    acceptLabel: "PDF files",
    multiple: true,
  },
  {
    slug: "split-pdf",
    name: "Split PDF",
    category: "pdf",
    icon: Scissors,
    processing: "client",
    short: "Split a PDF into separate files by page ranges.",
    title: "Split PDF — Separate PDF Pages Online Free",
    metaDescription:
      "Split PDF files online for free. Extract page ranges or break a PDF into single pages in your browser. Private, fast, no sign-up and no watermark.",
    h1: "Split a PDF",
    heroSubtitle: "Break one PDF into several files by page range, or split every page into its own file.",
    keywords: ["split pdf", "separate pdf pages", "split pdf online", "divide pdf", "break pdf into pages"],
    intro: [
      "Splitting a PDF lets you pull out just the pages you need or break a long document into smaller, more manageable files. Use it to separate a chapter, isolate a single form, or turn a 100-page scan into one file per page.",
      "The whole process happens in your browser, so even confidential documents stay on your computer. No installs, no account, and no quality loss.",
    ],
    steps: [
      { title: "Upload your PDF", text: "Drop your PDF into the box or click to choose it from your device." },
      { title: "Choose how to split", text: "Enter page ranges like 1-3, 5, 8-10, or split every page into its own file." },
      { title: "Download your files", text: "Get your split PDFs instantly — bundled in a ZIP when there is more than one." },
    ],
    faqs: [
      { q: "How do I split specific pages?", a: "Type the ranges you want, for example 1-3, 7, 10-12. Each range becomes part of the output, and you can also create one file per page." },
      { q: "Is there a page limit?", a: "No. You can split PDFs of any length, limited only by your device's available memory." },
      { q: "Do my files stay private?", a: "Yes. Splitting runs locally in your browser, so nothing is uploaded to any server." },
      { q: "What do I get when splitting into many files?", a: "When the result is more than one PDF, the files are packaged into a single ZIP for a one-click download." },
    ],
    related: ["merge-pdf", "extract-pdf-pages", "delete-pdf-pages", "pdf-to-jpg"],
    accept: "application/pdf,.pdf",
    acceptLabel: "a PDF file",
    multiple: false,
  },
  {
    slug: "compress-pdf",
    name: "Compress PDF",
    category: "pdf",
    icon: Shrink,
    processing: "client",
    short: "Reduce PDF file size while keeping readable quality.",
    title: "Compress PDF — Reduce PDF File Size Free",
    metaDescription:
      "Compress PDF files online for free to make them smaller for email and uploads. Reduce PDF size in your browser with adjustable quality. Private and fast.",
    h1: "Compress a PDF",
    heroSubtitle: "Shrink large PDFs so they're easy to email and upload — you choose the quality.",
    keywords: ["compress pdf", "reduce pdf size", "make pdf smaller", "pdf compressor", "shrink pdf online"],
    intro: [
      "Large PDFs are hard to email and slow to upload. Compressing a PDF reduces its file size — often dramatically for scanned or image-heavy documents — so it fits within attachment limits and uploads quickly.",
      "This tool optimizes the images inside your PDF in the browser and lets you pick the balance between smaller size and higher quality. Your file is never uploaded to a server.",
    ],
    steps: [
      { title: "Upload your PDF", text: "Drag your PDF into the box or click to select it." },
      { title: "Pick a quality level", text: "Choose Recommended for a balanced result, or High and Strong to trade quality for size." },
      { title: "Compress and download", text: "Download the smaller PDF and compare the new size before and after." },
    ],
    faqs: [
      { q: "How much smaller will my PDF get?", a: "It depends on the content. Scanned and image-heavy PDFs often shrink by 50–90%, while files that are mostly text see smaller gains." },
      { q: "Will compression reduce quality?", a: "Compression optimizes images, so very strong settings can soften them. The Recommended setting keeps documents clearly readable while saving space." },
      { q: "Is it really free and private?", a: "Yes. There are no limits, no sign-up, and compression happens locally in your browser so your file stays on your device." },
      { q: "Which PDFs compress best?", a: "Scanned documents, photos and image-rich exports benefit most. Pure-text PDFs are already compact and shrink less." },
    ],
    related: ["merge-pdf", "split-pdf", "pdf-to-jpg", "jpg-to-pdf"],
    accept: "application/pdf,.pdf",
    acceptLabel: "a PDF file",
    multiple: false,
  },
  {
    slug: "rotate-pdf",
    name: "Rotate PDF",
    category: "pdf",
    icon: RotateCw,
    processing: "client",
    short: "Rotate PDF pages and save them the right way up.",
    title: "Rotate PDF — Turn PDF Pages Online Free",
    metaDescription:
      "Rotate PDF pages online for free. Turn pages 90, 180 or 270 degrees and save them permanently the right way up. Runs in your browser, no sign-up needed.",
    h1: "Rotate PDF pages",
    heroSubtitle: "Fix sideways or upside-down pages and save the correct orientation permanently.",
    keywords: ["rotate pdf", "turn pdf pages", "rotate pdf online", "fix pdf orientation", "rotate pdf and save"],
    intro: [
      "Scanned pages often come out sideways or upside down. This tool rotates pages in 90-degree steps and saves the new orientation into the file, so it looks correct everywhere — not just in your current viewer.",
      "Rotate every page at once or just the ones that need fixing. It all happens in your browser, with no upload and no quality loss.",
    ],
    steps: [
      { title: "Upload your PDF", text: "Drop your PDF into the box or click to choose it." },
      { title: "Choose a rotation", text: "Rotate all pages, or select individual pages and turn them left or right." },
      { title: "Save and download", text: "Download the corrected PDF with the new orientation baked in." },
    ],
    faqs: [
      { q: "Does the rotation save permanently?", a: "Yes. The new orientation is written into the file, so the pages stay correct in any PDF viewer." },
      { q: "Can I rotate only some pages?", a: "Yes. Apply a rotation to every page at once, or pick specific pages and rotate just those." },
      { q: "Will rotating reduce quality?", a: "No. Rotation only changes page orientation; the content and resolution are untouched." },
      { q: "Is it private?", a: "Yes. Pages are rotated locally in your browser, so the document never leaves your device." },
    ],
    related: ["merge-pdf", "delete-pdf-pages", "reorder-pdf-pages", "compress-pdf"],
    accept: "application/pdf,.pdf",
    acceptLabel: "a PDF file",
    multiple: false,
  },
  {
    slug: "delete-pdf-pages",
    name: "Delete PDF Pages",
    category: "pdf",
    icon: FileX2,
    processing: "client",
    short: "Remove unwanted pages from a PDF.",
    title: "Delete PDF Pages — Remove Pages Online Free",
    metaDescription:
      "Delete pages from a PDF online for free. Remove blank, duplicate or unwanted pages in your browser and download the trimmed file. No sign-up, fully private.",
    h1: "Delete pages from a PDF",
    heroSubtitle: "Remove blank, duplicate or unwanted pages and keep only what matters.",
    keywords: ["delete pdf pages", "remove pages from pdf", "delete pages pdf online", "remove pdf pages free"],
    intro: [
      "Sometimes a PDF has pages you simply don't need — a blank scan, a cover sheet, a duplicate. This tool lets you select and remove those pages, then download a clean file with the rest left exactly as they were.",
      "Pages are removed in your browser, so nothing is uploaded and the remaining pages keep their original quality.",
    ],
    steps: [
      { title: "Upload your PDF", text: "Drag your PDF in or click to select it from your device." },
      { title: "Select pages to remove", text: "Click the page thumbnails you want to delete, or type page numbers like 2, 5, 9." },
      { title: "Download the result", text: "Get a new PDF with the selected pages removed." },
    ],
    faqs: [
      { q: "Will the original file change?", a: "No. Your original stays untouched. The tool creates a new PDF without the pages you removed." },
      { q: "Can I delete several pages at once?", a: "Yes. Select any number of pages by clicking thumbnails or entering a list like 1, 4-6, 9." },
      { q: "Is it private and free?", a: "Yes. Page removal runs locally in your browser with no sign-up and no limits." },
      { q: "Do the remaining pages keep their quality?", a: "Yes. The pages you keep are copied exactly, with no loss of quality." },
    ],
    related: ["extract-pdf-pages", "split-pdf", "reorder-pdf-pages", "merge-pdf"],
    accept: "application/pdf,.pdf",
    acceptLabel: "a PDF file",
    multiple: false,
  },
  {
    slug: "extract-pdf-pages",
    name: "Extract PDF Pages",
    category: "pdf",
    icon: FileOutput,
    processing: "client",
    short: "Pull selected pages out into a new PDF.",
    title: "Extract PDF Pages — Save Pages as New PDF Free",
    metaDescription:
      "Extract pages from a PDF online for free. Select the pages you need and save them as a new PDF in your browser. Private, fast, no sign-up and no watermark.",
    h1: "Extract pages from a PDF",
    heroSubtitle: "Keep only the pages you need and save them as a brand-new PDF.",
    keywords: ["extract pdf pages", "save pdf pages", "extract pages from pdf", "pdf page extractor", "get pages from pdf"],
    intro: [
      "Extracting pages is the opposite of deleting them: you choose the pages you want to keep, and everything else is left behind. It's perfect for pulling a single section, form or receipt out of a larger document.",
      "Select pages by clicking thumbnails or by typing page numbers, then download them as a new PDF. The work happens in your browser, so your file stays private.",
    ],
    steps: [
      { title: "Upload your PDF", text: "Drop the PDF into the box or click to browse for it." },
      { title: "Pick the pages to keep", text: "Click the thumbnails you want, or enter ranges such as 1-3, 7, 10." },
      { title: "Extract and download", text: "Download a new PDF containing only your selected pages." },
    ],
    faqs: [
      { q: "What's the difference between extracting and splitting?", a: "Extracting builds one new PDF from the pages you select. Splitting divides a document into several files by range." },
      { q: "Can I reorder the extracted pages?", a: "The extracted pages keep their original order. To rearrange them, use the Reorder PDF Pages tool afterward." },
      { q: "Is my document uploaded anywhere?", a: "No. Extraction runs entirely in your browser, so your file never leaves your device." },
      { q: "Is there a limit on how many pages I can extract?", a: "No. Select as many or as few pages as you like, with no limits and no sign-up." },
    ],
    related: ["delete-pdf-pages", "split-pdf", "merge-pdf", "reorder-pdf-pages"],
    accept: "application/pdf,.pdf",
    acceptLabel: "a PDF file",
    multiple: false,
  },
  {
    slug: "reorder-pdf-pages",
    name: "Reorder PDF Pages",
    category: "pdf",
    icon: ListOrdered,
    processing: "client",
    short: "Rearrange the page order in a PDF by dragging.",
    title: "Reorder PDF Pages — Rearrange PDF Online Free",
    metaDescription:
      "Reorder PDF pages online for free. Drag page thumbnails to rearrange a PDF and download the new order in your browser. No sign-up, no uploads, fully private.",
    h1: "Reorder PDF pages",
    heroSubtitle: "Drag page thumbnails into the perfect order, then save the rearranged PDF.",
    keywords: ["reorder pdf pages", "rearrange pdf", "sort pdf pages", "move pdf pages", "organize pdf"],
    intro: [
      "When pages end up out of sequence — after a scan, a merge, or an export — reordering puts them right. Drag the page thumbnails into the order you want and download a perfectly arranged PDF.",
      "Reordering happens in your browser with no quality loss and no upload, so even sensitive documents stay on your device.",
    ],
    steps: [
      { title: "Upload your PDF", text: "Drag your PDF in or click to select it." },
      { title: "Drag pages into order", text: "Move the page thumbnails around until the sequence is exactly right." },
      { title: "Save and download", text: "Download the PDF with its new page order." },
    ],
    faqs: [
      { q: "How do I move a page?", a: "Drag its thumbnail to a new position. The other pages shift to make room, and you can fine-tune as much as you like." },
      { q: "Does reordering change quality?", a: "No. Pages are only rearranged, never re-rendered, so content and resolution stay identical." },
      { q: "Is it private?", a: "Yes. Reordering runs locally in your browser, so nothing is uploaded to a server." },
      { q: "Can I also delete pages while reordering?", a: "Use this tool to rearrange pages, then the Delete PDF Pages tool to remove any you don't need." },
    ],
    related: ["merge-pdf", "delete-pdf-pages", "extract-pdf-pages", "rotate-pdf"],
    accept: "application/pdf,.pdf",
    acceptLabel: "a PDF file",
    multiple: false,
  },
  {
    slug: "jpg-to-pdf",
    name: "JPG to PDF",
    category: "pdf",
    icon: Images,
    processing: "client",
    short: "Convert JPG and PNG images into a single PDF.",
    title: "JPG to PDF — Convert Images to PDF Free",
    metaDescription:
      "Convert JPG and PNG images to PDF online for free. Combine photos and scans into one PDF in your browser, choose page size and order. No sign-up, fully private.",
    h1: "Convert JPG to PDF",
    heroSubtitle: "Turn photos and scans into a clean PDF — set the order, size and margins.",
    keywords: ["jpg to pdf", "image to pdf", "png to pdf", "convert jpg to pdf", "photos to pdf"],
    intro: [
      "Turning images into a PDF makes them easy to share, print and archive as one file. Add JPG or PNG photos, receipts, or scanned pages, arrange them in order, and download a single PDF.",
      "You choose the page size and margins, and the conversion happens in your browser — so your images are never uploaded anywhere.",
    ],
    steps: [
      { title: "Add your images", text: "Drag in your JPG or PNG files, or click to select them. Add as many as you need." },
      { title: "Arrange and adjust", text: "Drag images into order and choose page size, orientation and margins." },
      { title: "Create your PDF", text: "Click Convert and download a single PDF containing every image." },
    ],
    faqs: [
      { q: "Which image formats are supported?", a: "JPG/JPEG and PNG images are supported. Each image becomes one page in the PDF." },
      { q: "Can I put several images on one PDF?", a: "Yes. Add as many images as you like; they're combined into a single multi-page PDF in the order you set." },
      { q: "Will my images stay private?", a: "Yes. The conversion runs entirely in your browser, so your photos never leave your device." },
      { q: "Can I choose the page size?", a: "Yes. Pick A4, US Letter or fit-to-image, plus orientation and margins, before you convert." },
    ],
    related: ["pdf-to-jpg", "merge-pdf", "compress-pdf", "watermark-pdf"],
    accept: "image/jpeg,image/png,.jpg,.jpeg,.png",
    acceptLabel: "JPG or PNG images",
    multiple: true,
  },
  {
    slug: "pdf-to-jpg",
    name: "PDF to JPG",
    category: "pdf",
    icon: ImageIcon,
    processing: "client",
    short: "Convert each PDF page into a JPG image.",
    title: "PDF to JPG — Convert PDF Pages to Images Free",
    metaDescription:
      "Convert PDF to JPG online for free. Turn each PDF page into a high-quality image and download them as a ZIP — no sign-up, no uploads, fully private.",
    h1: "Convert PDF to JPG",
    heroSubtitle: "Turn every PDF page into a high-quality JPG image, ready to download.",
    keywords: ["pdf to jpg", "pdf to image", "convert pdf to jpg", "pdf to jpeg", "export pdf pages as images"],
    intro: [
      "Converting a PDF to JPG gives you an image of each page that you can post, embed, or open anywhere — no PDF reader required. It's ideal for sharing a single page on social media or dropping a page into a slide.",
      "Each page is rendered into a crisp JPG in your browser and bundled into a ZIP for download. Your PDF is never uploaded to a server.",
    ],
    steps: [
      { title: "Upload your PDF", text: "Drag your PDF into the box or click to choose it." },
      { title: "Choose the quality", text: "Pick the image resolution that fits your needs — higher for print, lower for the web." },
      { title: "Download your images", text: "Get a JPG for every page, packaged in a single ZIP file." },
    ],
    faqs: [
      { q: "What resolution will the images be?", a: "You choose. Select a higher resolution for printing or a lower one for smaller, web-friendly files." },
      { q: "How are multiple pages delivered?", a: "Each page becomes its own JPG, and all of them are bundled into one ZIP file for a single download." },
      { q: "Is my PDF uploaded?", a: "No. Pages are rendered to images directly in your browser, so your document stays private." },
      { q: "Can I convert just one page?", a: "Yes. Convert the whole document or pick specific pages to export as images." },
    ],
    related: ["jpg-to-pdf", "split-pdf", "compress-pdf", "extract-pdf-pages"],
    accept: "application/pdf,.pdf",
    acceptLabel: "a PDF file",
    multiple: false,
  },
  {
    slug: "watermark-pdf",
    name: "Watermark PDF",
    category: "pdf",
    icon: Stamp,
    processing: "client",
    short: "Add a text watermark across every PDF page.",
    title: "Watermark PDF — Add Text Watermark Free",
    metaDescription:
      "Add a watermark to a PDF free. Stamp text like CONFIDENTIAL or DRAFT across every page, with adjustable size and opacity — in your browser, fully private.",
    h1: "Add a watermark to a PDF",
    heroSubtitle: "Stamp text like CONFIDENTIAL or DRAFT across your pages, with control over size and opacity.",
    keywords: ["watermark pdf", "add watermark to pdf", "pdf watermark online", "stamp pdf", "draft watermark pdf"],
    intro: [
      "A watermark labels your document and discourages unauthorized reuse. Add text such as CONFIDENTIAL, DRAFT or your company name diagonally across every page, with full control over size, opacity and angle.",
      "The watermark is applied to your PDF in the browser, so the file is never uploaded and the original text stays selectable underneath.",
    ],
    steps: [
      { title: "Upload your PDF", text: "Drop your PDF into the box or click to select it." },
      { title: "Set your watermark", text: "Type your text and adjust size, opacity, color and rotation to taste." },
      { title: "Apply and download", text: "Download the watermarked PDF with the stamp on every page." },
    ],
    faqs: [
      { q: "Can I control how the watermark looks?", a: "Yes. Set the text, font size, opacity, color and angle so the watermark is visible without hiding your content." },
      { q: "Is the watermark added to every page?", a: "Yes. By default the watermark is stamped on all pages, giving consistent labeling throughout the document." },
      { q: "Can I add an image watermark?", a: "This tool adds text watermarks. For a logo, convert it to a PDF page and overlay separately, or check back as we expand the toolset." },
      { q: "Does it stay private?", a: "Yes. The watermark is applied locally in your browser, so your document never leaves your device." },
    ],
    related: ["merge-pdf", "compress-pdf", "jpg-to-pdf", "rotate-pdf"],
    accept: "application/pdf,.pdf",
    acceptLabel: "a PDF file",
    multiple: false,
  },
  {
    slug: "edit-pdf",
    name: "Edit PDF",
    category: "pdf",
    icon: FilePenLine,
    processing: "client",
    short: "Edit text, highlight, draw, sign and annotate a PDF, then download it.",
    title: "Free Online PDF Editor — Edit PDF Online Free",
    metaDescription:
      "Free online PDF editor. Edit text, highlight, draw, add shapes, signatures and annotations in your browser. Fully private — no watermarks, no sign-up.",
    h1: "Free Online PDF Editor",
    heroSubtitle: "A powerful free PDF editor online. Edit text, sign, draw, and annotate your PDF instantly — everything stays on your device.",
    keywords: ["free online pdf editor", "free pdf editor online", "edit pdf", "pdf editor", "edit pdf text", "annotate pdf", "sign pdf", "free pdf editor"],
    intro: [
      "A full PDF editor that runs entirely in your browser. Edit existing text in place or add new text boxes, highlight passages, draw freehand, add rectangles, circles, lines and arrows, drop comments and sticky notes, sign the document and stamp it — then download a finished PDF with every change flattened into the page.",
      "Everything happens on your device. Your PDF is never uploaded, there is no account to create, and there is no watermark. Zoom, pan, search the full text and jump between pages from the thumbnail sidebar while you work, with unlimited undo and redo.",
    ],
    steps: [
      { title: "Open your PDF", text: "Drag your PDF into the box or click to choose it from your device." },
      { title: "Make your edits", text: "Pick a tool to edit text, highlight, draw, add shapes, comment, sign or stamp anywhere on the page." },
      { title: "Download the result", text: "Click Download to save a new PDF with all of your edits baked in — ready to share or print." },
    ],
    faqs: [
      { q: "Is my PDF uploaded anywhere?", a: "No. The document is opened, edited and exported entirely in your browser, so it never leaves your device." },
      { q: "Can I edit the existing text in a PDF?", a: "Yes. Switch on the text tool and click any text block to edit it in place, or add a new text box anywhere on the page." },
      { q: "What can I add to a PDF?", a: "Highlights, freehand drawing, rectangles, circles, lines, arrows, comments, sticky notes, typed signatures and stamps — each can be moved, resized and deleted." },
      { q: "How do I save my edits?", a: "Click the Download button in the toolbar. Your edits are flattened onto the pages and a new PDF is downloaded — no watermark and no sign-up." },
      { q: "Can I undo a change?", a: "Yes. Use the undo and redo buttons or Ctrl/⌘+Z and Ctrl/⌘+Shift+Z to step backward and forward through your edits." },
      { q: "Does it work with large PDFs?", a: "Yes. Pages are rendered only as you scroll to them (virtualization), so even long documents stay responsive." },
    ],
    related: ["merge-pdf", "watermark-pdf", "compress-pdf", "rotate-pdf"],
    accept: "application/pdf,.pdf",
    acceptLabel: "a PDF file",
    multiple: false,
  },
];

const toolBySlug = new Map(tools.map((t) => [t.slug, t]));

export function getTool(slug: string): ToolDefinition | undefined {
  return toolBySlug.get(slug);
}

export function getRelatedTools(slug: string): ToolDefinition[] {
  const tool = getTool(slug);
  if (!tool) return [];
  return tool.related
    .map((s) => toolBySlug.get(s))
    .filter((t): t is ToolDefinition => Boolean(t));
}

export const toolSlugs = tools.map((t) => t.slug);
