/**
 * Data-driven guides. Each guide is a structured document rendered by a single
 * template. This is a lean content pipeline: adding a guide means adding one
 * object here — no MDX build config, no per-page boilerplate, consistent SEO.
 */

export interface GuideSection {
  heading: string;
  /** Paragraphs of body copy. */
  body: string[];
  /** Optional ordered steps rendered as a numbered list. */
  steps?: string[];
}

export interface GuideDefinition {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  intro: string[];
  keywords: string[];
  updated: string; // ISO date
  /** Primary tool this guide points readers to. */
  toolSlug: string;
  /** Base route path for the tool: "pdf-tools", "media-tools" or "office-tools". */
  toolCategory: "pdf-tools" | "media-tools" | "office-tools";
  sections: GuideSection[];
  faqs: { q: string; a: string }[];
}

export const guides: GuideDefinition[] = [
  /* =========================================================================
   * PDF TOOL GUIDES
   * ======================================================================= */
  {
    slug: "how-to-merge-pdf-files",
    title: "How to Merge PDF Files (Free, No Software)",
    metaDescription:
      "Learn how to merge PDF files for free without installing software. A simple, private, step-by-step guide to combining multiple PDFs into one document.",
    h1: "How to merge PDF files",
    keywords: ["how to merge pdf", "combine pdf files", "merge pdf without software", "join pdfs"],
    updated: "2026-06-24",
    toolSlug: "merge-pdf",
    toolCategory: "pdf-tools",
    intro: [
      "Merging PDFs combines several documents into one file that's easier to send, print and store. You might join scanned receipts for an expense report, stitch chapters into a single book, or combine signed pages back into a contract.",
      "This guide shows the fastest way to merge PDFs for free — entirely in your browser, with nothing to install and no files uploaded to a server.",
    ],
    sections: [
      {
        heading: "Merge PDFs in your browser (recommended)",
        body: [
          "The simplest method needs no software and keeps your files private, because the work happens on your own device.",
        ],
        steps: [
          "Open the free Merge PDF tool.",
          "Drag in the PDF files you want to combine, or click to browse for them.",
          "Drag the files up or down to set the page order.",
          "Click Merge PDF and download your single combined document.",
        ],
      },
      {
        heading: "Tips for a clean merge",
        body: [
          "Name your files in the order you want them (for example 01-cover, 02-body) so they're easy to arrange.",
          "If a file has pages you don't need, remove them first with the Delete PDF Pages tool, then merge.",
          "For very large documents, merge in smaller batches to keep things fast on lower-powered devices.",
        ],
      },
      {
        heading: "Is it safe to merge PDFs online?",
        body: [
          "It depends on the tool. Many online services upload your files to their servers. FreeOfficeTools runs the merge locally in your browser, so your documents never leave your computer — which matters for contracts, IDs and anything confidential.",
        ],
      },
    ],
    faqs: [
      { q: "Can I merge PDFs for free?", a: "Yes. The Merge PDF tool is free with no page limits, no sign-up and no watermark." },
      { q: "Do I need to install anything?", a: "No. Merging works in any modern browser with nothing to download or install." },
      { q: "Will my files be uploaded?", a: "No. The merge runs in your browser, so your PDFs stay on your device." },
    ],
  },
  {
    slug: "how-to-reduce-pdf-file-size",
    title: "How to Reduce PDF File Size (Free & Private)",
    metaDescription:
      "Learn how to reduce PDF file size for free so it fits email and upload limits. A clear guide to compressing PDFs in your browser without losing readability.",
    h1: "How to reduce PDF file size",
    keywords: ["reduce pdf file size", "compress pdf", "make pdf smaller", "shrink pdf for email"],
    updated: "2026-06-24",
    toolSlug: "compress-pdf",
    toolCategory: "pdf-tools",
    intro: [
      "A PDF that's too large can bounce back from email or stall on upload. Reducing its file size makes it easy to share, while keeping the document readable.",
      "This guide explains what makes PDFs large, how compression works, and how to shrink a PDF for free in your browser.",
    ],
    sections: [
      {
        heading: "Why PDFs get large",
        body: [
          "Most oversized PDFs are heavy because of images — scanned pages, photos and screenshots store a lot of data. Text, by contrast, is tiny. That's why scanned documents compress far more than text-only files.",
        ],
      },
      {
        heading: "Compress a PDF in your browser",
        body: ["The fastest free method runs entirely on your device and lets you choose the quality."],
        steps: [
          "Open the Compress PDF tool.",
          "Drag in your PDF or click to select it.",
          "Choose a quality level — Recommended balances size and clarity.",
          "Download the smaller file and check the before/after size.",
        ],
      },
      {
        heading: "Get the smallest size without ruining quality",
        body: [
          "Start with the Recommended setting and only move to a stronger level if you still need a smaller file.",
          "If your PDF is mostly text, it's already small — expect modest savings.",
          "For emailing, aim to stay under your provider's attachment limit (often 20–25 MB).",
        ],
      },
    ],
    faqs: [
      { q: "How small can I make a PDF?", a: "Scanned and image-heavy PDFs often shrink by 50–90%. Text-only PDFs are already compact and shrink less." },
      { q: "Will compressing lower the quality?", a: "Compression optimizes images, so very strong settings soften them. The Recommended level keeps documents clearly readable." },
      { q: "Is it private?", a: "Yes. Compression happens in your browser, so your file is never uploaded." },
    ],
  },
  {
    slug: "how-to-convert-jpg-to-pdf",
    title: "How to Convert JPG to PDF (Free, In Your Browser)",
    metaDescription:
      "Learn how to convert JPG and PNG images to PDF for free. A step-by-step guide to combining photos and scans into one tidy PDF, privately in your browser.",
    h1: "How to convert JPG to PDF",
    keywords: ["convert jpg to pdf", "jpg to pdf", "images to pdf", "png to pdf", "photo to pdf"],
    updated: "2026-06-24",
    toolSlug: "jpg-to-pdf",
    toolCategory: "pdf-tools",
    intro: [
      "Turning images into a PDF makes them easy to share and print as a single file. It's the simplest way to send a set of photographed documents, receipts or scanned pages.",
      "This guide shows how to convert JPG or PNG images to a PDF for free, with control over page size and order — all in your browser.",
    ],
    sections: [
      {
        heading: "Convert images to a PDF",
        body: ["No software needed — add your images, arrange them, and download a single PDF."],
        steps: [
          "Open the JPG to PDF tool.",
          "Drag in your JPG or PNG images, or click to select them.",
          "Drag images into the order you want and pick a page size.",
          "Click Convert and download your PDF.",
        ],
      },
      {
        heading: "Get the best-looking result",
        body: [
          "Use the highest-quality versions of your images for sharp pages.",
          "Choose A4 or US Letter for documents you plan to print.",
          "Crop or straighten photographed documents before converting for a cleaner look.",
        ],
      },
    ],
    faqs: [
      { q: "Can I combine several images into one PDF?", a: "Yes. Add as many JPG or PNG images as you like; each becomes a page in a single PDF." },
      { q: "Is converting JPG to PDF free?", a: "Yes. It's free with no sign-up, no limits and no watermark." },
      { q: "Are my images uploaded?", a: "No. The conversion happens in your browser, so your images stay private." },
    ],
  },
  {
    slug: "how-to-split-a-pdf",
    title: "How to Split a PDF Into Separate Files (Free Online)",
    metaDescription:
      "Learn how to split a PDF into separate files for free. Extract page ranges or break a document into single pages, right in your browser with no software needed.",
    h1: "How to split a PDF",
    keywords: ["split pdf", "separate pdf pages", "divide pdf", "split pdf into pages", "extract pdf pages online"],
    updated: "2026-06-29",
    toolSlug: "split-pdf",
    toolCategory: "pdf-tools",
    intro: [
      "Splitting a PDF lets you break a large document into smaller, focused files — one per chapter, section or page range. It's useful when you only need to send part of a contract, isolate a single form, or turn a long scan into individual pages.",
      "This guide walks you through splitting PDFs for free in your browser, with nothing to install and nothing uploaded to a server.",
    ],
    sections: [
      {
        heading: "Split a PDF in your browser",
        body: ["The quickest method keeps your files private and needs no software."],
        steps: [
          "Open the Split PDF tool.",
          "Drop your PDF into the box or click to select it.",
          "Enter page ranges (e.g. 1-3, 5, 8-10) or choose to split every page.",
          "Download your split files — they come bundled in a ZIP when there's more than one.",
        ],
      },
      {
        heading: "Common ways to split",
        body: [
          "Split by page range — enter ranges like 1-5, 6-10 to create separate documents for each section.",
          "Split every page — each page becomes its own PDF file, ideal for scanned batches.",
          "Extract a single page — enter just one page number to pull out exactly the page you need.",
        ],
      },
      {
        heading: "Tips for splitting",
        body: [
          "Check the page count and preview thumbnails before splitting so you choose the right ranges.",
          "After splitting, use Merge PDF if you need to recombine any of the pieces.",
          "Splitting doesn't alter the content — each resulting PDF has the same quality as the original.",
        ],
      },
    ],
    faqs: [
      { q: "Can I split a PDF for free?", a: "Yes. The Split PDF tool is completely free with no page limits, no sign-up and no watermark." },
      { q: "Will my file be uploaded?", a: "No. Splitting runs in your browser, so your document stays on your device." },
      { q: "What format do I get the split files in?", a: "Each piece is a standard PDF. When there are multiple files, they're packaged into a ZIP for easy download." },
    ],
  },
  {
    slug: "how-to-rotate-pdf-pages",
    title: "How to Rotate PDF Pages (Free, Permanent Fix)",
    metaDescription:
      "Learn how to rotate PDF pages and save them the right way up. Fix sideways or upside-down scans for free in your browser — no software needed.",
    h1: "How to rotate PDF pages",
    keywords: ["rotate pdf", "rotate pdf pages", "fix pdf orientation", "turn pdf pages", "rotate pdf and save"],
    updated: "2026-06-29",
    toolSlug: "rotate-pdf",
    toolCategory: "pdf-tools",
    intro: [
      "Scanned pages often come out sideways or upside down, and some PDF viewers only let you rotate for viewing — not permanently. This guide shows how to rotate pages and save the corrected orientation into the file itself.",
      "The fix runs in your browser, takes seconds, and the rotated PDF works correctly in every viewer and printer.",
    ],
    sections: [
      {
        heading: "Rotate and save PDF pages",
        body: ["Fix page orientation permanently with no software to install."],
        steps: [
          "Open the Rotate PDF tool.",
          "Drop your PDF into the box or click to select it.",
          "Choose to rotate all pages or select individual pages that need fixing.",
          "Click the rotation buttons (90°, 180°, 270°) until the pages are upright.",
          "Download the corrected PDF with the orientation saved permanently.",
        ],
      },
      {
        heading: "When to rotate",
        body: [
          "After scanning — many scanners mix portrait and landscape pages.",
          "Before printing — rotated pages avoid paper jams and wasted prints.",
          "Before merging — fix individual files so the combined document reads naturally.",
        ],
      },
    ],
    faqs: [
      { q: "Is the rotation saved permanently?", a: "Yes. The corrected orientation is written into the PDF, so it looks right in every viewer and when printed." },
      { q: "Can I rotate just some pages?", a: "Yes. Select individual pages that need fixing and leave the rest untouched." },
      { q: "Does rotating reduce quality?", a: "No. Rotation only changes orientation metadata — your content and resolution stay identical." },
    ],
  },
  {
    slug: "how-to-delete-pdf-pages",
    title: "How to Delete Pages From a PDF (Free & Private)",
    metaDescription:
      "Learn how to delete pages from a PDF for free. Remove blank, duplicate or unwanted pages in your browser and download the trimmed file. No sign-up required.",
    h1: "How to delete pages from a PDF",
    keywords: ["delete pdf pages", "remove pages from pdf", "remove pdf pages free", "delete pages pdf online"],
    updated: "2026-06-29",
    toolSlug: "delete-pdf-pages",
    toolCategory: "pdf-tools",
    intro: [
      "Sometimes a PDF contains pages you don't need — a blank page after a scan, an old cover sheet, or a duplicate. Deleting them tidies the document before you share or archive it.",
      "This guide shows how to remove unwanted pages from a PDF for free, directly in your browser.",
    ],
    sections: [
      {
        heading: "Remove pages from a PDF",
        body: ["Select the pages to delete and download a clean file with everything else intact."],
        steps: [
          "Open the Delete PDF Pages tool.",
          "Drop your PDF or click to select it.",
          "Click the pages you want to remove, or type page numbers like 2, 5, 9.",
          "Download the new PDF with the selected pages removed.",
        ],
      },
      {
        heading: "Tips",
        body: [
          "Your original file is never changed — the tool creates a new PDF with the pages you chose removed.",
          "If you'd rather keep specific pages and drop everything else, use the Extract PDF Pages tool instead.",
          "After deleting, consider compressing the result to save even more space.",
        ],
      },
    ],
    faqs: [
      { q: "Can I delete pages for free?", a: "Yes. It's free with no page limits, no sign-up and no watermark." },
      { q: "Will deleting pages change my original file?", a: "No. A new PDF is created; your original stays untouched." },
      { q: "Is it private?", a: "Yes. Page removal runs in your browser — nothing is uploaded." },
    ],
  },
  {
    slug: "how-to-extract-pdf-pages",
    title: "How to Extract Pages From a PDF (Free Online)",
    metaDescription:
      "Learn how to extract pages from a PDF for free. Select the pages you need and save them as a new PDF in your browser — no sign-up, fully private.",
    h1: "How to extract pages from a PDF",
    keywords: ["extract pdf pages", "save specific pdf pages", "extract pages from pdf", "pdf page extractor"],
    updated: "2026-06-29",
    toolSlug: "extract-pdf-pages",
    toolCategory: "pdf-tools",
    intro: [
      "Extracting pages is the opposite of deleting: you choose the pages you want to keep and everything else is left behind. It's perfect for pulling a receipt, a single form or a chapter out of a larger document.",
      "This guide explains how to extract pages from a PDF for free, with no software and no uploads.",
    ],
    sections: [
      {
        heading: "Extract pages into a new PDF",
        body: ["Pick the pages you need and download them as a fresh PDF."],
        steps: [
          "Open the Extract PDF Pages tool.",
          "Drop your PDF or click to browse.",
          "Click the page thumbnails you want, or type ranges like 1-3, 7, 10.",
          "Download your new PDF containing only the selected pages.",
        ],
      },
      {
        heading: "Extract vs. split vs. delete",
        body: [
          "Extract — keep only the pages you pick; everything else is dropped.",
          "Split — divide the whole document into multiple files by range.",
          "Delete — remove specific pages and keep the rest.",
          "Choose the one that best fits your task.",
        ],
      },
    ],
    faqs: [
      { q: "Is extracting pages free?", a: "Yes. The tool is free with no limits, no account and no watermark." },
      { q: "Are my files uploaded?", a: "No. Extraction runs entirely in your browser, so your document stays private." },
      { q: "Can I reorder the extracted pages?", a: "Pages keep their original order. To rearrange, use the Reorder PDF Pages tool afterward." },
    ],
  },
  {
    slug: "how-to-reorder-pdf-pages",
    title: "How to Reorder PDF Pages (Free, Drag & Drop)",
    metaDescription:
      "Learn how to reorder PDF pages for free. Drag page thumbnails to rearrange your PDF and download the new order — in your browser, no sign-up required.",
    h1: "How to reorder PDF pages",
    keywords: ["reorder pdf pages", "rearrange pdf", "sort pdf pages", "move pdf pages", "organize pdf"],
    updated: "2026-06-29",
    toolSlug: "reorder-pdf-pages",
    toolCategory: "pdf-tools",
    intro: [
      "When pages end up out of sequence after a scan, a merge or an export, reordering puts them right. This guide shows how to drag pages into the correct order and save the rearranged PDF.",
      "The process runs in your browser with no quality loss, no upload and no software to install.",
    ],
    sections: [
      {
        heading: "Rearrange pages by dragging",
        body: ["A visual drag-and-drop interface makes it easy to get the order right."],
        steps: [
          "Open the Reorder PDF Pages tool.",
          "Drop your PDF or click to select it.",
          "Drag the page thumbnails into the order you want.",
          "Download the PDF with its new page order.",
        ],
      },
      {
        heading: "Tips for reordering",
        body: [
          "Use page thumbnails to quickly identify which pages are out of place.",
          "If you also need to remove pages, reorder first, then use Delete PDF Pages.",
          "Reordering does not re-render the pages — content and resolution stay identical.",
        ],
      },
    ],
    faqs: [
      { q: "Is reordering free?", a: "Yes. The tool is completely free with no limits, no sign-up and no watermark." },
      { q: "Does reordering reduce quality?", a: "No. Pages are only rearranged, not re-rendered, so quality stays identical." },
      { q: "Is it private?", a: "Yes. Reordering runs locally in your browser — nothing is uploaded." },
    ],
  },
  {
    slug: "how-to-convert-pdf-to-jpg",
    title: "How to Convert PDF to JPG (Free, High Quality)",
    metaDescription:
      "Learn how to convert PDF pages to JPG images for free. Turn each page into a high-quality image in your browser and download them as a ZIP. No sign-up needed.",
    h1: "How to convert PDF to JPG",
    keywords: ["pdf to jpg", "convert pdf to jpg", "pdf to image", "pdf to jpeg", "export pdf as images"],
    updated: "2026-06-29",
    toolSlug: "pdf-to-jpg",
    toolCategory: "pdf-tools",
    intro: [
      "Converting a PDF to JPG gives you an image of each page that you can post on social media, embed in a presentation, or open without a PDF reader.",
      "This guide shows how to turn PDF pages into high-quality JPG images for free, entirely in your browser.",
    ],
    sections: [
      {
        heading: "Convert PDF pages to JPG images",
        body: ["Each page becomes a crisp JPG, bundled into a ZIP for easy download."],
        steps: [
          "Open the PDF to JPG tool.",
          "Drop your PDF into the box or click to select it.",
          "Choose the image resolution — higher for print, lower for the web.",
          "Download a ZIP containing one JPG per page.",
        ],
      },
      {
        heading: "Choosing the right resolution",
        body: [
          "For sharing online or embedding in slides, a medium resolution keeps files small.",
          "For printing, choose the highest resolution for crisp, detailed images.",
          "Higher resolution means larger file sizes — pick the balance that suits your use case.",
        ],
      },
    ],
    faqs: [
      { q: "Is converting PDF to JPG free?", a: "Yes. It's free with no page limits, no sign-up and no watermark." },
      { q: "Is my PDF uploaded?", a: "No. Pages are rendered to images in your browser — your document stays private." },
      { q: "Can I convert just one page?", a: "Yes. Convert the whole document or pick specific pages to export." },
    ],
  },
  {
    slug: "how-to-watermark-a-pdf",
    title: "How to Add a Watermark to a PDF (Free Online)",
    metaDescription:
      "Learn how to add a text watermark to a PDF for free. Stamp CONFIDENTIAL, DRAFT or any text across every page in your browser — no sign-up needed.",
    h1: "How to add a watermark to a PDF",
    keywords: ["watermark pdf", "add watermark to pdf", "pdf watermark online", "stamp pdf", "draft watermark pdf"],
    updated: "2026-06-29",
    toolSlug: "watermark-pdf",
    toolCategory: "pdf-tools",
    intro: [
      "A watermark labels your document and discourages unauthorized reuse. Whether you're marking a draft, stamping CONFIDENTIAL, or branding with your company name, a watermark makes the status clear at a glance.",
      "This guide shows how to add a text watermark to every page of a PDF for free, with full control over appearance.",
    ],
    sections: [
      {
        heading: "Add a watermark to your PDF",
        body: ["Customize the text, size, opacity and rotation, then stamp it across every page."],
        steps: [
          "Open the Watermark PDF tool.",
          "Drop your PDF or click to select it.",
          "Type your watermark text (e.g. CONFIDENTIAL, DRAFT).",
          "Adjust font size, opacity, color and rotation angle.",
          "Download the watermarked PDF.",
        ],
      },
      {
        heading: "Best practices",
        body: [
          "Keep opacity between 15–30% so the watermark is visible but doesn't hide your content.",
          "Use a diagonal angle (typically 45°) for maximum coverage across each page.",
          "For official documents, use clear, professional text like CONFIDENTIAL or DO NOT DISTRIBUTE.",
        ],
      },
    ],
    faqs: [
      { q: "Is it free?", a: "Yes. Watermarking is free with no limits, no sign-up and no watermark added by the tool itself." },
      { q: "Can I control the watermark appearance?", a: "Yes. Adjust text, size, opacity, color and angle to suit your needs." },
      { q: "Is my PDF uploaded?", a: "No. The watermark is applied in your browser — your document stays private." },
    ],
  },
  {
    slug: "how-to-edit-a-pdf",
    title: "How to Edit a PDF Online (Free, No Sign-up)",
    metaDescription:
      "Learn how to edit a PDF for free. Change text, highlight, draw, sign and annotate PDFs in your browser — no uploads, no sign-up, no watermarks.",
    h1: "How to edit a PDF",
    keywords: ["edit pdf", "edit pdf online", "pdf editor free", "annotate pdf", "sign pdf", "edit pdf text"],
    updated: "2026-06-29",
    toolSlug: "edit-pdf",
    toolCategory: "pdf-tools",
    intro: [
      "Sometimes you need to fix a typo, add a note, highlight a section or sign a document without printing it. A PDF editor lets you do all of this directly in your browser.",
      "This guide shows how to edit PDFs for free — including text editing, highlighting, drawing, shapes, comments, signatures and stamps.",
    ],
    sections: [
      {
        heading: "Edit a PDF in your browser",
        body: ["A full editor with text, drawing, shapes, comments, signatures and more."],
        steps: [
          "Open the Edit PDF tool.",
          "Drop your PDF or click to select it.",
          "Pick a tool: edit text, highlight, draw, add shapes, comment, sign or stamp.",
          "Make your edits — use undo/redo anytime.",
          "Download the finished PDF with all edits baked in.",
        ],
      },
      {
        heading: "What you can do",
        body: [
          "Edit text — click existing text to change it, or add new text boxes anywhere.",
          "Highlight — mark passages with a transparent color overlay.",
          "Draw — freehand drawing for annotations, circles, arrows and more.",
          "Sign — type or draw your signature and place it on any page.",
          "Comment — add sticky notes and text comments for review.",
        ],
      },
      {
        heading: "Tips for editing",
        body: [
          "Use Ctrl/⌘+Z to undo and Ctrl/⌘+Shift+Z to redo.",
          "Zoom in for precise positioning of text and signatures.",
          "All edits are flattened into the PDF when you download — what you see is what you get.",
        ],
      },
    ],
    faqs: [
      { q: "Is the PDF editor free?", a: "Yes. Editing is completely free with no sign-up and no watermark on the output." },
      { q: "Can I edit existing text?", a: "Yes. Click any text block to edit it in place, or add new text anywhere on the page." },
      { q: "Is my PDF uploaded?", a: "No. Editing happens entirely in your browser — your document never leaves your device." },
      { q: "Can I sign a PDF?", a: "Yes. Type or draw your signature and place it on any page." },
    ],
  },

  /* =========================================================================
   * MEDIA TOOL GUIDES
   * ======================================================================= */
  {
    slug: "how-to-convert-video-to-mp3",
    title: "How to Convert Video to MP3 (Free, In Your Browser)",
    metaDescription:
      "Learn how to convert video to MP3 for free. Extract audio from any video file in your browser — no uploads, no software, no sign-up required.",
    h1: "How to convert video to MP3",
    keywords: ["video to mp3", "convert video to mp3", "extract audio from video", "video to mp3 converter", "video audio extractor"],
    updated: "2026-06-29",
    toolSlug: "video-to-mp3",
    toolCategory: "media-tools",
    intro: [
      "Sometimes you want the audio from a video — a song, a lecture, a podcast recording, or an interview — without the picture. Converting video to MP3 gives you a small, portable audio file that plays on any device.",
      "This guide shows how to extract audio from video for free, entirely in your browser with nothing to install.",
    ],
    sections: [
      {
        heading: "Extract audio from a video",
        body: ["The conversion runs on your own device using WebAssembly — your video is never uploaded."],
        steps: [
          "Open the Video to MP3 tool.",
          "Drag your video file into the box, or click to browse.",
          "Choose the audio quality — High (192 kbps) is recommended for most uses.",
          "Click Convert to MP3 and download the audio file.",
        ],
      },
      {
        heading: "Choosing the right quality",
        body: [
          "128 kbps (Standard) — smallest file, good for speech and podcasts.",
          "192 kbps (High) — recommended balance of quality and size for music.",
          "320 kbps (Best) — highest quality, largest file, ideal for archiving.",
        ],
      },
      {
        heading: "Supported formats",
        body: [
          "The tool accepts most video formats including MP4, MOV, AVI, MKV, WEBM, M4V, WMV and FLV. The output is always MP3.",
        ],
      },
    ],
    faqs: [
      { q: "Is converting video to MP3 free?", a: "Yes. It's completely free with no sign-up, no limits and no watermark." },
      { q: "Is my video uploaded?", a: "No. The conversion runs in your browser using WebAssembly, so your video stays on your device." },
      { q: "What video formats are supported?", a: "MP4, MOV, AVI, MKV, WEBM, M4V, WMV, FLV and more." },
    ],
  },
  {
    slug: "how-to-convert-mp4-to-mp3",
    title: "How to Convert MP4 to MP3 (Free & Private)",
    metaDescription:
      "Learn how to convert MP4 to MP3 for free. Extract the audio from MP4 video files in your browser — no uploads, no software, no sign-up required.",
    h1: "How to convert MP4 to MP3",
    keywords: ["mp4 to mp3", "convert mp4 to mp3", "mp4 to mp3 converter", "extract audio mp4", "mp4 audio"],
    updated: "2026-06-29",
    toolSlug: "mp4-to-mp3",
    toolCategory: "media-tools",
    intro: [
      "MP4 files carry both video and audio. When you only need the sound — a song, a talk, a voice memo — converting the MP4 to MP3 gives you a small audio file that plays everywhere.",
      "This guide walks you through converting MP4 to MP3 for free in your browser, with nothing uploaded to any server.",
    ],
    sections: [
      {
        heading: "Convert MP4 to MP3",
        body: ["A simple three-step process that runs entirely on your device."],
        steps: [
          "Open the MP4 to MP3 tool.",
          "Drop your MP4 file or click to select it.",
          "Choose the MP3 quality and click Convert to MP3.",
          "Download your MP3 file.",
        ],
      },
      {
        heading: "MP4 to MP3 vs. Video to MP3",
        body: [
          "The MP4 to MP3 tool is optimized for MP4 files specifically. If you have other video formats (MOV, AVI, MKV, etc.), use the Video to MP3 tool instead, which accepts a wider range of formats.",
        ],
      },
    ],
    faqs: [
      { q: "Is it free?", a: "Yes. The MP4 to MP3 converter is free with no sign-up, no limits and no watermark." },
      { q: "Will I lose audio quality?", a: "The MP3 is encoded from the original audio track. Choosing 192 kbps (High) preserves good quality while keeping the file compact." },
      { q: "Is my file uploaded?", a: "No. Conversion runs in your browser — your MP4 stays on your device." },
    ],
  },
  {
    slug: "how-to-convert-audio-files",
    title: "How to Convert Audio Files Between Formats (Free)",
    metaDescription:
      "Learn how to convert audio files between MP3, WAV, M4A, OGG and FLAC for free. Change audio formats in your browser — no uploads, no sign-up required.",
    h1: "How to convert audio files",
    keywords: ["audio converter", "convert audio", "wav to mp3", "m4a to mp3", "audio format converter", "change audio format"],
    updated: "2026-06-29",
    toolSlug: "audio-converter",
    toolCategory: "media-tools",
    intro: [
      "Different devices and apps prefer different audio formats. An audio converter lets you switch between them — MP3 for universal playback, WAV or FLAC for lossless quality, M4A for Apple devices.",
      "This guide shows how to convert between audio formats for free, entirely in your browser.",
    ],
    sections: [
      {
        heading: "Convert audio to any format",
        body: ["Pick your source file and target format, and the conversion runs on your device."],
        steps: [
          "Open the Audio Converter tool.",
          "Drop your audio file (or even a video file to extract its audio).",
          "Choose the output format: MP3, WAV, M4A, OGG, FLAC or AAC.",
          "Set the quality level for compressed formats.",
          "Click Convert and download your file in the new format.",
        ],
      },
      {
        heading: "Format guide",
        body: [
          "MP3 — universal, plays everywhere, good balance of size and quality.",
          "WAV — uncompressed, lossless, large files, ideal for editing.",
          "FLAC — compressed but lossless, smaller than WAV with no quality loss.",
          "M4A/AAC — compact, good quality, preferred on Apple devices.",
          "OGG — open-source, efficient, used in games and web apps.",
        ],
      },
    ],
    faqs: [
      { q: "Which formats can I convert between?", a: "MP3, WAV, M4A, AAC, OGG and FLAC. You can also extract audio from video files." },
      { q: "Is it lossless?", a: "WAV and FLAC are lossless targets. MP3, M4A, AAC and OGG are lossy — use a higher bitrate for better quality." },
      { q: "Is it free and private?", a: "Yes. Conversion runs in your browser with no uploads, no sign-up and no limits." },
    ],
  },
  {
    slug: "how-to-convert-to-mp3",
    title: "How to Convert Any File to MP3 (Free Online)",
    metaDescription:
      "Learn how to convert audio and video files to MP3 for free. Use our browser-based MP3 converter — no uploads, no software, no sign-up required.",
    h1: "How to convert to MP3",
    keywords: ["mp3 converter", "convert to mp3", "audio to mp3", "wav to mp3", "free mp3 converter", "online mp3 converter"],
    updated: "2026-06-29",
    toolSlug: "mp3-converter",
    toolCategory: "media-tools",
    intro: [
      "MP3 is the most widely supported audio format — it plays on every phone, computer, car stereo and music app. Converting your files to MP3 makes them universally playable.",
      "This guide shows how to convert any audio or video file to MP3 for free in your browser.",
    ],
    sections: [
      {
        heading: "Convert any file to MP3",
        body: ["Drop in an audio or video file and get a clean MP3 in seconds."],
        steps: [
          "Open the MP3 Converter tool.",
          "Drop your audio or video file, or click to select one.",
          "Choose the MP3 quality: Standard (128 kbps), High (192 kbps) or Best (320 kbps).",
          "Click Convert to MP3 and download your file.",
        ],
      },
      {
        heading: "When to use the MP3 Converter",
        body: [
          "When you need MP3 specifically — this tool always outputs MP3 with a simple quality choice.",
          "If you need to convert to other formats like WAV, FLAC or M4A, use the Audio Converter instead.",
        ],
      },
    ],
    faqs: [
      { q: "What can I convert to MP3?", a: "Most audio formats (WAV, M4A, AAC, OGG, FLAC) and common video formats (MP4, MOV, AVI, MKV, etc.)." },
      { q: "Is it free?", a: "Yes. The MP3 converter is completely free with no sign-up and no limits." },
      { q: "Are my files uploaded?", a: "No. Conversion runs in your browser, so your files stay private." },
    ],
  },
  {
    slug: "how-to-compress-a-video",
    title: "How to Compress a Video (Free, No Upload Needed)",
    metaDescription:
      "Learn how to compress video files for free. Reduce video size for email, upload and sharing in your browser — no uploads to a server, no sign-up required.",
    h1: "How to compress a video",
    keywords: ["compress video", "reduce video size", "make video smaller", "video compressor", "shrink video", "compress mp4"],
    updated: "2026-06-29",
    toolSlug: "video-compressor",
    toolCategory: "media-tools",
    intro: [
      "Large video files are awkward to email, slow to upload and quick to fill up storage. Compressing a video re-encodes it more efficiently, cutting the file size while keeping it watchable.",
      "This guide shows how to compress videos for free, entirely in your browser with nothing uploaded.",
    ],
    sections: [
      {
        heading: "Compress a video in your browser",
        body: ["Choose how hard to compress and download a smaller MP4 in minutes."],
        steps: [
          "Open the Video Compressor tool.",
          "Drop your video into the box or click to select it.",
          "Choose a compression level: Light, Balanced (recommended) or Strong.",
          "Click Compress video and download the smaller file when it's done.",
        ],
      },
      {
        heading: "Choosing the right compression level",
        body: [
          "Light — barely changes quality, modest size reduction. Best for high-quality archiving.",
          "Balanced — recommended for most sharing. Good quality with a meaningful size cut.",
          "Strong — smallest file, more visible compression. Good when size matters most.",
        ],
      },
      {
        heading: "Tips",
        body: [
          "Phone recordings and screen captures compress the most, since they're often recorded at unnecessarily high bitrates.",
          "Already-compressed videos (from YouTube downloads, etc.) won't shrink as much.",
          "Compression can take a minute or two for longer videos — a progress bar keeps you informed.",
        ],
      },
    ],
    faqs: [
      { q: "How much smaller will my video get?", a: "It depends on the source. High-bitrate recordings often shrink by 50–80%. Already-compressed videos save less." },
      { q: "Will quality drop?", a: "Some quality is traded for size. Light barely changes it; Balanced is the best tradeoff for most uses." },
      { q: "Is my video uploaded?", a: "No. Compression runs entirely in your browser using WebAssembly, so your video stays private." },
    ],
  },
  {
    slug: "how-to-trim-audio",
    title: "How to Trim Audio (Free, Cut Any Audio File Online)",
    metaDescription:
      "Learn how to trim audio files for free. Cut a clip by start and end time in your browser — no uploads, no software, no sign-up required.",
    h1: "How to trim audio",
    keywords: ["trim audio", "cut audio", "audio trimmer", "trim mp3", "cut mp3 online", "audio cutter"],
    updated: "2026-06-29",
    toolSlug: "audio-trimmer",
    toolCategory: "media-tools",
    intro: [
      "Sometimes you only need a piece of an audio file — a ringtone, a quote, the best part of a recording. An audio trimmer lets you keep just that section and drop the rest.",
      "This guide shows how to trim audio for free in your browser, with nothing to install and nothing uploaded.",
    ],
    sections: [
      {
        heading: "Cut a clip from an audio file",
        body: ["Set start and end times and download your trimmed clip as an MP3."],
        steps: [
          "Open the Audio Trimmer tool.",
          "Drop your audio or video file, or click to select one.",
          "Enter the start and end times (in seconds or MM:SS format).",
          "Click Trim audio and download your clip.",
        ],
      },
      {
        heading: "Time format tips",
        body: [
          "Use whole seconds (e.g. 45) or a MM:SS timestamp (e.g. 1:30).",
          "Leave the end time blank to trim from your start point to the end of the file.",
          "For long files, use HH:MM:SS format (e.g. 1:05:30).",
        ],
      },
      {
        heading: "Works with video too",
        body: [
          "Drop in a video file and the trimmer will extract the audio between your chosen times. The output is always an MP3.",
        ],
      },
    ],
    faqs: [
      { q: "Is audio trimming free?", a: "Yes. It's free with no sign-up, no limits and no watermark." },
      { q: "What format is the output?", a: "The trimmed clip is saved as an MP3, which plays on virtually any device." },
      { q: "Can I trim audio from a video?", a: "Yes. Drop in a video and the trimmer extracts the audio between your start and end times." },
    ],
  },

  {
    slug: "how-to-convert-mov-to-mp4",
    title: "How to Convert MOV to MP4 (Free, No Upload)",
    metaDescription:
      "Learn how to convert MOV videos to MP4 for free in your browser. Make iPhone and Mac recordings play on Windows, Android and TVs — no uploads, no software.",
    h1: "How to convert MOV to MP4",
    keywords: ["convert mov to mp4", "mov to mp4", "mov won't play on windows", "iphone video to mp4"],
    updated: "2026-07-02",
    toolSlug: "mov-to-mp4",
    toolCategory: "media-tools",
    intro: [
      "MOV is the format iPhones, iPads and Macs use for screen recordings and camera footage. It plays perfectly inside the Apple ecosystem — and then refuses to open on a Windows laptop, an Android phone or the TV you want to show it on.",
      "The fix is converting to MP4, the one video format practically every device, browser and editing app understands. This guide shows how to do it for free in your browser, without installing a converter or uploading your video anywhere.",
    ],
    sections: [
      {
        heading: "Convert MOV to MP4 in your browser",
        body: [
          "The conversion runs on your own device using WebAssembly, so even long personal videos never leave your computer.",
        ],
        steps: [
          "Open the free MOV to MP4 tool.",
          "Drag your .mov file into the box, or click to browse for it.",
          "Click Convert to MP4 and wait a few seconds while it processes.",
          "Download the MP4 and play or share it anywhere.",
        ],
      },
      {
        heading: "Why the quality doesn't drop",
        body: [
          "MOV and MP4 are containers — boxes that hold the actual video and audio streams. In most cases the video inside a MOV is already encoded with H.264, which MP4 supports natively, so converting mostly repackages the same streams into a new box rather than re-compressing the picture.",
          "That's why the converted file looks identical to the original and finishes quickly: nothing about the image itself is being degraded.",
        ],
      },
      {
        heading: "When to convert (and when not to)",
        body: [
          "Convert when you need to send a clip to a Windows or Android user, upload it to a site that rejects MOV, or archive footage in the most future-proof format.",
          "If the video only ever lives on your Apple devices, you can leave it as MOV — the formats store the same content, so there's no quality reason to convert until compatibility forces it.",
        ],
      },
    ],
    faqs: [
      { q: "Is converting MOV to MP4 free?", a: "Yes. The converter is free with no watermark, no sign-up and no file limit beyond your device's memory." },
      { q: "Does my video get uploaded?", a: "No. The conversion runs entirely in your browser, so the video never leaves your device — there's nothing to upload or wait for." },
      { q: "Will the MP4 look worse than the MOV?", a: "No. The video stream is typically repackaged rather than re-encoded, so the picture quality is unchanged." },
      { q: "Can I convert large videos?", a: "Yes — files up to about 1 GB work well. Very long videos simply take a little longer to process." },
    ],
  },
  {
    slug: "how-to-remove-metadata-from-photos",
    title: "How to Remove Metadata From Photos (EXIF, GPS, AI Tags)",
    metaDescription:
      "Photos carry hidden EXIF data: GPS location, device details, even AI prompts. Learn how to strip photo metadata for free in your browser before you share.",
    h1: "How to remove metadata from photos",
    keywords: ["remove metadata from photos", "remove exif data", "strip gps from photos", "remove ai metadata"],
    updated: "2026-07-02",
    toolSlug: "ai-metadata-remover",
    toolCategory: "media-tools",
    intro: [
      "Every photo you take carries an invisible passenger: metadata. A single JPEG can reveal where it was taken (GPS coordinates), when, on which phone or camera, with what settings — and if the image came from an AI generator, often the exact prompt used to create it.",
      "Before you post a photo publicly, sell an image, or share AI work without its prompt attached, it's worth stripping that data out. This guide shows how to remove all of it for free, privately, in your browser.",
    ],
    sections: [
      {
        heading: "What's actually hidden in your photos",
        body: [
          "Camera photos embed EXIF blocks: device model, timestamps, exposure settings and — if location was on — precise GPS coordinates that can map to your home or workplace.",
          "AI-generated images add XMP blocks where tools like Stable Diffusion and Midjourney record prompts, seeds and model versions. IPTC blocks may carry author and copyright fields added by editing software.",
        ],
      },
      {
        heading: "Strip the metadata in your browser",
        body: [
          "The remover works by extracting only the visible pixels and saving them as a brand-new file, so every hidden block is left behind by construction — nothing to configure, nothing to miss.",
        ],
        steps: [
          "Open the free AI Metadata Remover.",
          "Drag in your JPG, PNG or WebP photo.",
          "Click Remove Metadata — the clean copy is generated instantly.",
          "Download the scrubbed image and share it safely.",
        ],
      },
      {
        heading: "Don't social networks already strip EXIF?",
        body: [
          "Most big platforms remove EXIF from displayed images, but that protects viewers, not you — the platform itself still receives the original with location intact. Files you share directly (email, messaging apps, cloud links, marketplaces) usually keep every byte of metadata.",
          "Scrubbing before the file leaves your device is the only version of this you fully control. Because this tool runs locally, even the scrubbing step exposes nothing.",
        ],
      },
    ],
    faqs: [
      { q: "Does removing metadata change how the photo looks?", a: "No. The pixels are copied exactly as they appear; only the invisible data blocks are discarded." },
      { q: "Can it remove AI prompts from Midjourney or Stable Diffusion images?", a: "Yes. Prompts live in XMP/EXIF blocks, and the tool discards all of them — the output contains only pixels." },
      { q: "How can I verify the metadata is really gone?", a: "Run the cleaned file through the Metadata Checker tool. It should come back showing no EXIF, XMP or IPTC data." },
      { q: "Is my photo uploaded during cleaning?", a: "No. The entire process runs in your browser, so the original never leaves your device." },
    ],
  },
  {
    slug: "how-to-check-image-metadata",
    title: "How to Check a Photo's Metadata (EXIF, GPS & AI Tags)",
    metaDescription:
      "See exactly what a photo reveals about you. Learn how to check EXIF data, GPS location and hidden AI prompts in any image — free and private, in your browser.",
    h1: "How to check a photo's metadata",
    keywords: ["check image metadata", "view exif data", "exif viewer", "see photo location data", "check ai image prompts"],
    updated: "2026-07-02",
    toolSlug: "metadata-checker",
    toolCategory: "media-tools",
    intro: [
      "Wondering what a photo says about you — or where a photo someone sent you was really taken? The answers sit in the image's metadata: structured data blocks written into the file by cameras, phones, editors and AI generators.",
      "This guide shows how to read all of it in seconds, free and in your browser, and how to interpret what you find.",
    ],
    sections: [
      {
        heading: "View the metadata in your browser",
        body: [
          "The checker parses the file's EXIF, XMP and IPTC headers locally and lists every tag it finds — nothing is uploaded, so it's safe to inspect even sensitive photos.",
        ],
        steps: [
          "Open the free Metadata Checker.",
          "Drag in a JPG, PNG, WebP, TIFF or HEIC image.",
          "Read the extracted tags — device, timestamps, GPS, software and more.",
          "Check the XMP section for AI-generation prompts if the image may be AI-made.",
        ],
      },
      {
        heading: "How to read what you find",
        body: [
          "GPS latitude/longitude means the photo pinpoints a real place — treat it as sensitive before sharing. Device and software tags tell you what captured or last edited the file.",
          "For suspected AI images, prompts, seeds or model names in XMP are a strong signal — though their absence proves nothing, since metadata is easy to strip.",
        ],
      },
      {
        heading: "If a photo shows no metadata",
        body: [
          "An empty result usually means the file was already scrubbed, or passed through a platform that strips EXIF on download (most social networks do). Screenshots also start life with almost no metadata.",
          "If you're checking your own photo before posting and it still shows GPS or device data, run it through the AI Metadata Remover and check it again.",
        ],
      },
    ],
    faqs: [
      { q: "Can I see where a photo was taken?", a: "If the camera saved GPS data and it hasn't been stripped, yes — the checker shows the embedded coordinates." },
      { q: "Can it tell me whether an image is AI-generated?", a: "It can reveal AI prompts and model tags when they're present, which is strong evidence. But stripped metadata doesn't prove an image is real." },
      { q: "Is the photo uploaded to check it?", a: "No. The file is parsed entirely in your browser, so it never leaves your device." },
      { q: "Which formats can I inspect?", a: "JPG, PNG, WebP, TIFF and HEIC images are supported." },
    ],
  },
  {
    slug: "how-to-edit-exif-data",
    title: "How to Edit EXIF Data (Add Author & Copyright to Photos)",
    metaDescription:
      "Learn how to edit a photo's EXIF metadata for free: add your name as author, embed a copyright notice or fix the description — privately, in your browser.",
    h1: "How to edit EXIF data in a photo",
    keywords: ["edit exif data", "add copyright to photo", "change image metadata", "exif editor online"],
    updated: "2026-07-02",
    toolSlug: "metadata-editor",
    toolCategory: "media-tools",
    intro: [
      "EXIF metadata isn't only something to remove — used deliberately, it's how photographers travel with their name attached. An embedded author and copyright field rides inside the file itself, surviving downloads, renames and reposts in a way a watermark caption can't.",
      "This guide shows how to write your own metadata into an image for free: add an author, a copyright line or a description, directly in your browser.",
    ],
    sections: [
      {
        heading: "Edit the tags in your browser",
        body: [
          "The editor rewrites the image's EXIF header on your device, so unpublished work never touches a server.",
        ],
        steps: [
          "Open the free Metadata Editor.",
          "Drag in your image — JPEG works natively; PNG and WebP are converted to high-quality JPEG so tags can be embedded.",
          "Fill in the fields you want: Author, Copyright, Description.",
          "Click Edit Metadata and download the tagged copy.",
        ],
      },
      {
        heading: "What to put in each field",
        body: [
          "Author is your name or studio. Copyright follows the pattern “© 2026 Your Name — all rights reserved”, though any wording works. Description is free text — useful for captions, licensing contacts or a portfolio URL.",
          "Embedded credits matter in practice: buyers, editors and stock platforms read these fields, and they're your evidence trail if an image is reused without permission.",
        ],
      },
      {
        heading: "Limits worth knowing",
        body: [
          "Metadata is durable but not tamper-proof — anyone can strip or rewrite it with tools like this one. Treat it as attribution and provenance, not as copy protection.",
          "Some platforms remove metadata on upload, so keep your tagged originals; they remain the authoritative copies.",
        ],
      },
    ],
    faqs: [
      { q: "Which fields can I edit?", a: "Author, copyright and description tags in the image's EXIF header." },
      { q: "Does editing metadata change image quality?", a: "JPEG input keeps its pixels untouched — only the header is rewritten. PNG and WebP inputs are converted to high-quality JPEG first." },
      { q: "Will my copyright survive if someone screenshots the photo?", a: "No — screenshots create a new image with fresh metadata. Embedded tags survive normal downloading and sharing of the file itself." },
      { q: "Is my image uploaded while editing?", a: "No. The EXIF header is rewritten entirely in your browser." },
    ],
  },
  {
    slug: "how-to-convert-png-to-jpg",
    title: "How to Convert PNG to JPG (Free, Smaller Files)",
    metaDescription:
      "Learn how to convert PNG images to JPG for free in your browser. Cut screenshot and photo file sizes by 50–80% for email and uploads — no software, no uploads.",
    h1: "How to convert PNG to JPG",
    keywords: ["convert png to jpg", "png to jpg", "png too large", "png to jpeg free"],
    updated: "2026-07-02",
    toolSlug: "png-to-jpg",
    toolCategory: "media-tools",
    intro: [
      "PNG stores every pixel losslessly, which is why a simple screenshot can weigh several megabytes and get rejected by an upload form that a visually identical JPG would sail through.",
      "Converting PNG to JPG is usually the single fastest way to shrink an image without touching its dimensions. Here's how to do it free in your browser, and how to know when you shouldn't.",
    ],
    sections: [
      {
        heading: "Convert in your browser",
        body: [
          "The image is redrawn and re-encoded on your own device — no upload, no queue, no watermark.",
        ],
        steps: [
          "Open the free PNG to JPG converter.",
          "Drag in your PNG, or click to browse for it.",
          "The tool re-encodes it as a JPG instantly.",
          "Download the smaller file — typically 50–80% lighter.",
        ],
      },
      {
        heading: "When JPG is the right choice — and when it isn't",
        body: [
          "Convert photos, screenshots of pages or apps, and anything destined for email, forms or chat: JPG's compression is invisible at normal viewing sizes and universally supported.",
          "Keep the PNG when the image has transparency (JPG flattens it onto white), or when it's crisp line art, a logo or text-heavy UI that must stay pixel-perfect — JPG can soften hard edges.",
        ],
      },
      {
        heading: "Need a specific file size instead?",
        body: [
          "If a form demands “under 1 MB” rather than just “JPG”, use the Image Compressor's target-size mode after (or instead of) converting — it finds the highest quality that fits under your exact limit.",
        ],
      },
    ],
    faqs: [
      { q: "How much smaller will the JPG be?", a: "Photos and screenshots typically shrink by 50–80% compared with the same image as a PNG." },
      { q: "Will I see a quality difference?", a: "At normal viewing sizes, no — the encoder uses a high quality setting. Fine text and sharp line art are the exception; keep those as PNG." },
      { q: "What happens to transparent backgrounds?", a: "JPG has no transparency, so transparent areas are flattened onto white during conversion." },
      { q: "Are my images uploaded?", a: "No. The conversion runs entirely in your browser." },
    ],
  },
  {
    slug: "how-to-convert-jpg-to-png",
    title: "How to Convert JPG to PNG (Free, Lossless Copy)",
    metaDescription:
      "Learn how to convert JPG images to PNG for free in your browser. Get a lossless copy that survives editing and re-saving without compounding compression damage.",
    h1: "How to convert JPG to PNG",
    keywords: ["convert jpg to png", "jpg to png", "jpeg to png free", "lossless image copy"],
    updated: "2026-07-02",
    toolSlug: "jpg-to-png",
    toolCategory: "media-tools",
    intro: [
      "Every time a JPG is edited and re-saved as JPG, it's compressed again, and the artifacts stack — the digital equivalent of photocopying a photocopy. Converting to PNG first stops that decay: PNG is lossless, so from then on the image survives any number of edit-save cycles untouched.",
      "This guide covers how to convert JPG to PNG free in your browser, and what the conversion can and cannot do.",
    ],
    sections: [
      {
        heading: "Convert in your browser",
        body: ["The JPG is decoded once and re-saved as a lossless PNG on your own device."],
        steps: [
          "Open the free JPG to PNG converter.",
          "Drag in your JPG, or click to browse for it.",
          "The tool saves it as a PNG instantly.",
          "Download the PNG and edit it as much as you like.",
        ],
      },
      {
        heading: "What conversion can't do",
        body: [
          "PNG can't restore detail the JPG already threw away — compression artifacts that exist now are preserved exactly, not healed. The gain is entirely about the future: no further loss from here on.",
          "Expect a bigger file, too. Lossless storage of a photo costs several times the size of its JPG; that's the trade for editing safety.",
        ],
      },
      {
        heading: "Why editors prefer PNG",
        body: [
          "Beyond losslessness, PNG supports transparency — so once converted, you can cut out a background in any editor and export a clean composite. It's the natural working format for logos, diagrams, UI mockups and any image headed into a design tool or document.",
        ],
      },
    ],
    faqs: [
      { q: "Does converting to PNG improve quality?", a: "No — existing JPG artifacts are kept as-is. What PNG gives you is zero additional loss on every future edit and save." },
      { q: "Why is the PNG so much bigger than the JPG?", a: "PNG stores every pixel exactly. Photos compress poorly losslessly, so the file grows — that's normal." },
      { q: "Can I make the background transparent?", a: "The converted image is still opaque, but PNG supports transparency, so you can erase the background afterwards in any editor." },
      { q: "Is anything uploaded?", a: "No. The conversion happens entirely in your browser." },
    ],
  },
  {
    slug: "how-to-convert-heic-to-jpg",
    title: "How to Convert HEIC to JPG (Open iPhone Photos Anywhere)",
    metaDescription:
      "iPhone photos saved as HEIC won't open on many Windows PCs and websites. Learn how to convert HEIC to JPG for free in your browser — private, no app needed.",
    h1: "How to convert HEIC to JPG",
    keywords: ["convert heic to jpg", "heic to jpg", "open heic on windows", "iphone photos won't open"],
    updated: "2026-07-02",
    toolSlug: "heic-to-jpg",
    toolCategory: "media-tools",
    intro: [
      "You AirDrop or copy photos off an iPhone, try to open them on a Windows PC — and get an unsupported-format error. Since iOS 11, iPhones save photos as HEIC, a space-efficient Apple-first format that much of the non-Apple world still can't read.",
      "Converting to JPG solves it once and for all: the photo opens on any device, attaches to any email and uploads to any form. Here's how to do it free, in your browser, without installing anything.",
    ],
    sections: [
      {
        heading: "Convert HEIC to JPG in your browser",
        body: [
          "The HEIC file is decoded and re-encoded on your own device — personal photos never touch a server.",
        ],
        steps: [
          "Open the free HEIC to JPG converter.",
          "Drag in the .heic photo, or click to browse for it.",
          "The photo is decoded and saved as a high-quality JPG.",
          "Download a copy that opens everywhere.",
        ],
      },
      {
        heading: "Stop the problem at the source (optional)",
        body: [
          "If you constantly share photos with non-Apple users, you can make your iPhone shoot JPG directly: Settings → Camera → Formats → Most Compatible. The trade-off is larger files on your phone, which is exactly why Apple defaults to HEIC.",
          "Many people keep HEIC for its storage savings and just convert the occasional photo they need to share — which is where this tool fits.",
        ],
      },
      {
        heading: "JPG or PNG?",
        body: [
          "JPG is the right target for photos you want to share: small, universal, visually identical at high quality. Choose HEIC to PNG instead when you need a lossless copy for serious editing — expect a much larger file in exchange.",
        ],
      },
    ],
    faqs: [
      { q: "Why can't Windows open my iPhone photos?", a: "They're saved in Apple's HEIC format, which older Windows and Android versions can't decode without extra codecs. Converting to JPG removes the dependency entirely." },
      { q: "Does converting lose quality?", a: "The JPG is encoded at high quality — the difference from the HEIC original isn't visible at normal viewing sizes." },
      { q: "Are my photos uploaded?", a: "No. Decoding and conversion run entirely in your browser, so photos stay on your device." },
      { q: "Can I convert Live Photos?", a: "The still image converts normally; the short video component of a Live Photo isn't part of the HEIC still and isn't included." },
    ],
  },
  {
    slug: "how-to-convert-heic-to-png",
    title: "How to Convert HEIC to PNG (Lossless iPhone Photos)",
    metaDescription:
      "Learn how to convert iPhone HEIC photos to lossless PNG for free in your browser. The right choice for editing and design work — private, no app, no upload.",
    h1: "How to convert HEIC to PNG",
    keywords: ["convert heic to png", "heic to png", "iphone photo to png", "lossless iphone photo"],
    updated: "2026-07-02",
    toolSlug: "heic-to-png",
    toolCategory: "media-tools",
    intro: [
      "Sometimes compatibility isn't enough — you need the cleanest possible copy of an iPhone photo. Maybe it's headed into a design tool, a print layout, or heavy retouching where you'll save the file many times over.",
      "Converting HEIC to PNG gives you exactly that: a lossless, universally supported copy that never degrades no matter how often it's edited and re-saved. Here's how to do it free in your browser.",
    ],
    sections: [
      {
        heading: "Convert HEIC to PNG in your browser",
        body: ["The photo is decoded and re-saved losslessly on your own device — nothing is uploaded."],
        steps: [
          "Open the free HEIC to PNG converter.",
          "Drag in your .heic photo, or click to browse for it.",
          "The photo is decoded and written out as a lossless PNG.",
          "Download the PNG, ready for editing or placement.",
        ],
      },
      {
        heading: "Why choose PNG over JPG here",
        body: [
          "A JPG re-compresses the photo, and each subsequent save in an editor compresses it again. PNG holds every pixel exactly as decoded from the HEIC, so your working copy stays pristine through any number of edits.",
          "PNG also supports transparency — relevant the moment you cut a subject out of its background.",
        ],
      },
      {
        heading: "Mind the file size",
        body: [
          "Lossless photos are big: a 2 MB HEIC can easily become a 15–25 MB PNG. That's expected — HEIC's efficiency is what you're trading away for editing safety. For photos you only want to view or share, HEIC to JPG produces far smaller files.",
        ],
      },
    ],
    faqs: [
      { q: "Is HEIC to PNG really lossless?", a: "The PNG stores every pixel exactly as decoded from your HEIC — no further compression is applied at any point." },
      { q: "Why did my file get so much bigger?", a: "PNG's lossless storage is far less space-efficient for photos than HEIC's modern compression. The size increase is the cost of a perfect copy." },
      { q: "When should I use JPG instead?", a: "For sharing, emailing or posting: JPG looks the same at a fraction of the size. Reserve PNG for editing and design work." },
      { q: "Are my photos uploaded?", a: "No. The entire conversion runs in your browser." },
    ],
  },
  {
    slug: "how-to-compress-images",
    title: "How to Compress an Image to a Specific Size (Free)",
    metaDescription:
      "Form says 'image must be under 1 MB'? Learn how to compress a JPG, PNG or HEIC to an exact file size for free in your browser — no uploads, no watermark.",
    h1: "How to compress an image to a specific size",
    keywords: ["compress image to 1mb", "compress image to specific size", "reduce image file size", "compress jpg online"],
    updated: "2026-07-02",
    toolSlug: "image-compressor",
    toolCategory: "media-tools",
    intro: [
      "“Image must be smaller than 1 MB.” Every visa application, job portal and CMS seems to have its own limit, and photos straight off a phone camera are usually 3–10× over it.",
      "This guide shows two free ways to hit any limit in your browser: a quick quality preset when you just need “smaller”, and a target-size mode when you need to land under an exact number.",
    ],
    sections: [
      {
        heading: "Compress to an exact size (target mode)",
        body: [
          "Target mode does the trial-and-error for you: it searches quality levels — scaling dimensions down only if needed — until the file lands just under your limit at the best possible quality.",
        ],
        steps: [
          "Open the free Image Compressor.",
          "Drag in your JPG, PNG, WebP or HEIC image.",
          "Switch to target-size mode and type the limit — for example 1 MB or 0.2 MB for 200 KB.",
          "Download the result, guaranteed under your limit.",
        ],
      },
      {
        heading: "Or just pick a quality level",
        body: [
          "No hard limit to meet? Choose a quality preset instead. Recommended keeps photos visually indistinguishable while typically cutting 70–90% off camera images; stronger levels trade a little softness for even smaller files.",
        ],
      },
      {
        heading: "Getting the most out of compression",
        body: [
          "Format matters: photos compress smallest as JPG or WebP, while PNG stays large because it's lossless — the compressor re-encodes efficiently for you.",
          "Dimensions matter more than anything: a 4000-pixel-wide photo shown in a 800-pixel slot wastes most of its bytes. Target mode scales oversized images automatically when quality alone can't reach your limit.",
          "Compress a copy, keep the original. You can always make a smaller file from the original; you can't recover detail from a compressed one.",
        ],
      },
    ],
    faqs: [
      { q: "How do I compress an image to under 1 MB?", a: "Use target-size mode: enter 1 MB and the tool finds the best quality that fits just below it, scaling dimensions only if necessary." },
      { q: "Can I compress to 200 KB or other small limits?", a: "Yes — enter 0.2 MB. Very small targets on large photos will visibly soften detail; that's the physics of the limit, not the tool." },
      { q: "Which formats can I compress?", a: "JPG, PNG, WebP and HEIC. Photos come out smallest as JPG or WebP; transparency is preserved when the output supports it." },
      { q: "Is there a batch or size limit?", a: "Files up to 50 MB each, with no daily caps, watermarks or sign-up." },
      { q: "Are my images uploaded?", a: "No. Compression runs entirely in your browser, so images never leave your device." },
    ],
  },

  /* =========================================================================
   * OFFICE TOOL GUIDES
   * ======================================================================= */
  {
    slug: "how-to-convert-word-to-pdf",
    title: "How to Convert Word to PDF (Free, Formatting Preserved)",
    metaDescription:
      "Learn how to convert Word documents to PDF for free. Turn DOC and DOCX files into polished PDFs with fonts and layout preserved. No sign-up required.",
    h1: "How to convert Word to PDF",
    keywords: ["word to pdf", "convert word to pdf", "docx to pdf", "doc to pdf", "word to pdf converter"],
    updated: "2026-06-29",
    toolSlug: "word-to-pdf",
    toolCategory: "office-tools",
    intro: [
      "Converting a Word document to PDF locks in its layout so it looks identical on every device — no shifted text, swapped fonts or broken images. PDF is the expected format for résumés, reports, invoices and contracts.",
      "This guide shows how to convert Word files to PDF for free, with formatting perfectly preserved.",
    ],
    sections: [
      {
        heading: "Convert Word to PDF",
        body: ["Your document's fonts, images and layout are preserved exactly."],
        steps: [
          "Open the Word to PDF tool.",
          "Drop your DOC or DOCX file, or click to select it.",
          "Click Convert to PDF.",
          "Download the finished PDF, ready to share, print or sign.",
        ],
      },
      {
        heading: "Why convert to PDF?",
        body: [
          "PDFs look the same on every device and operating system — no reformatting surprises.",
          "They're harder to accidentally edit, which matters for contracts and official documents.",
          "Most email clients and web portals expect PDF for attachments and uploads.",
        ],
      },
    ],
    faqs: [
      { q: "Is it free?", a: "Yes. Converting Word to PDF is free with no sign-up, no limits and no watermark." },
      { q: "Will my formatting be preserved?", a: "Yes. Fonts, images, tables and layout are reproduced accurately in the PDF." },
      { q: "Which Word formats are supported?", a: "Both modern .docx and older .doc files are supported." },
      { q: "Is my document private?", a: "Yes. Your file is processed securely and never stored." },
    ],
  },
  {
    slug: "how-to-convert-pdf-to-word",
    title: "How to Convert PDF to Word (Free, Editable DOCX)",
    metaDescription:
      "Learn how to convert PDF to Word for free. Turn PDF files into editable DOCX documents with text and layout preserved. No sign-up required.",
    h1: "How to convert PDF to Word",
    keywords: ["pdf to word", "convert pdf to word", "pdf to docx", "pdf to word converter", "edit pdf in word"],
    updated: "2026-06-29",
    toolSlug: "pdf-to-word",
    toolCategory: "office-tools",
    intro: [
      "When you receive a PDF but need to edit it — fix a typo, update a figure, reuse a paragraph — converting it to Word gives you editable text without retyping.",
      "This guide shows how to convert PDF to an editable Word document for free.",
    ],
    sections: [
      {
        heading: "Convert PDF to editable Word",
        body: ["Get an editable DOCX you can open in Word, Google Docs or any word processor."],
        steps: [
          "Open the PDF to Word tool.",
          "Drop your PDF or click to select it.",
          "Click Convert to Word.",
          "Download the DOCX file and edit it however you like.",
        ],
      },
      {
        heading: "What to expect",
        body: [
          "Text-based PDFs convert best — paragraphs, headings and basic structure are preserved.",
          "Scanned (image-only) PDFs need OCR to recognise text, which is on our roadmap.",
          "Complex layouts with many columns or graphics may need minor formatting adjustments.",
        ],
      },
    ],
    faqs: [
      { q: "Is it free?", a: "Yes. PDF to Word conversion is free with no sign-up and no watermark." },
      { q: "Can I edit the result?", a: "Yes. The output is a standard DOCX you can edit in Word, Google Docs or any word processor." },
      { q: "Does it work on scanned PDFs?", a: "Text-based PDFs work best. Scanned PDFs need OCR, which is on our roadmap." },
      { q: "Is my PDF private?", a: "Yes. Your file is processed securely and never stored." },
    ],
  },
  {
    slug: "how-to-convert-excel-to-pdf",
    title: "How to Convert Excel to PDF (Free, Layout Preserved)",
    metaDescription:
      "Learn how to convert Excel spreadsheets to PDF for free. Turn XLS and XLSX files into clean, shareable PDFs with rows and columns intact. No sign-up required.",
    h1: "How to convert Excel to PDF",
    keywords: ["excel to pdf", "convert excel to pdf", "xlsx to pdf", "spreadsheet to pdf", "xls to pdf"],
    updated: "2026-06-29",
    toolSlug: "excel-to-pdf",
    toolCategory: "office-tools",
    intro: [
      "Spreadsheets are awkward to share — columns get cut off, formatting changes, and not everyone has Excel. Converting to PDF freezes the layout into clean pages anyone can open and print.",
      "This guide shows how to convert Excel files to PDF for free, with your rows, columns and formatting preserved.",
    ],
    sections: [
      {
        heading: "Convert Excel to PDF",
        body: ["Your spreadsheet's formatting, rows and columns stay intact in the PDF."],
        steps: [
          "Open the Excel to PDF tool.",
          "Drop your XLS, XLSX or CSV file, or click to select it.",
          "Click Convert to PDF.",
          "Download a PDF that's easy to share, view and print.",
        ],
      },
      {
        heading: "Tips for the best result",
        body: [
          "Set your print area in Excel before converting if you only want specific ranges.",
          "Workbooks with multiple sheets become multi-page PDFs.",
          "Wide spreadsheets may be scaled to fit — consider landscape orientation before converting.",
        ],
      },
    ],
    faqs: [
      { q: "Is it free?", a: "Yes. Excel to PDF conversion is free with no sign-up, no limits and no watermark." },
      { q: "Will my columns be preserved?", a: "Yes. Rows, columns, fonts and cell formatting are preserved in the PDF." },
      { q: "Can I convert multiple sheets?", a: "Yes. A workbook with several sheets becomes a multi-page PDF." },
      { q: "Is my file private?", a: "Yes. Your spreadsheet is processed securely and never stored." },
    ],
  },
  {
    slug: "how-to-convert-pdf-to-excel",
    title: "How to Convert PDF to Excel (Free, Extract Tables)",
    metaDescription:
      "Learn how to convert PDF to Excel for free. Extract tables and data from PDF files into editable XLSX spreadsheets. No sign-up required.",
    h1: "How to convert PDF to Excel",
    keywords: ["pdf to excel", "convert pdf to excel", "extract table from pdf", "pdf to xlsx", "pdf to spreadsheet"],
    updated: "2026-06-29",
    toolSlug: "pdf-to-excel",
    toolCategory: "office-tools",
    intro: [
      "Retyping numbers from a PDF is slow and error-prone. Converting a PDF to Excel pulls the tabular data into a spreadsheet you can sort, total and analyse.",
      "This guide shows how to extract tables from PDFs into editable Excel files for free.",
    ],
    sections: [
      {
        heading: "Extract tables from PDF to Excel",
        body: ["Tables are detected and rebuilt as spreadsheet cells you can work with."],
        steps: [
          "Open the PDF to Excel tool.",
          "Drop your PDF or click to select it.",
          "Click Convert to Excel.",
          "Download the XLSX and work with your data in Excel or Google Sheets.",
        ],
      },
      {
        heading: "What converts best",
        body: [
          "Well-structured tables in text-based PDFs convert most accurately.",
          "PDFs generated from spreadsheets typically extract perfectly.",
          "Scanned or image-based PDFs need OCR to read the text first — this is on our roadmap.",
        ],
      },
    ],
    faqs: [
      { q: "Is it free?", a: "Yes. PDF to Excel conversion is free with no sign-up and no watermark." },
      { q: "Will my tables be accurate?", a: "Well-structured tables in text-based PDFs map rows and columns into spreadsheet cells accurately." },
      { q: "Does it work on scanned PDFs?", a: "Text-based PDFs work best. Scanned PDFs need OCR, which is on our roadmap." },
      { q: "Is my file private?", a: "Yes. Your PDF is processed securely and never stored." },
    ],
  },
  {
    slug: "how-to-convert-powerpoint-to-pdf",
    title: "How to Convert PowerPoint to PDF (Free, One Slide Per Page)",
    metaDescription:
      "Learn how to convert PowerPoint to PDF for free. Turn PPT and PPTX slides into a clean PDF with layout and fonts preserved. No sign-up required.",
    h1: "How to convert PowerPoint to PDF",
    keywords: ["powerpoint to pdf", "convert powerpoint to pdf", "pptx to pdf", "ppt to pdf", "slides to pdf"],
    updated: "2026-06-29",
    toolSlug: "powerpoint-to-pdf",
    toolCategory: "office-tools",
    intro: [
      "Sharing a PowerPoint file means hoping the recipient has the right software and your fonts survive. Converting to PDF gives you a document that opens perfectly anywhere — ideal for handouts, email attachments and printing.",
      "This guide shows how to convert PowerPoint presentations to PDF for free, with layout and fonts preserved.",
    ],
    sections: [
      {
        heading: "Convert PowerPoint to PDF",
        body: ["Each slide becomes a clean page in the PDF, exactly as designed."],
        steps: [
          "Open the PowerPoint to PDF tool.",
          "Drop your PPT or PPTX file, or click to select it.",
          "Click Convert to PDF.",
          "Download a PDF with one slide per page.",
        ],
      },
      {
        heading: "Why PDF for presentations?",
        body: [
          "PDFs open on any device without PowerPoint installed.",
          "Fonts and layout stay exactly as you designed them.",
          "Perfect for printing handouts — one clean slide per page.",
          "Smaller file size than the original PPTX in many cases.",
        ],
      },
    ],
    faqs: [
      { q: "Is it free?", a: "Yes. PowerPoint to PDF conversion is free with no sign-up, no limits and no watermark." },
      { q: "Is one slide one page?", a: "Yes. Each slide becomes a single page in the PDF, in the original order." },
      { q: "Are fonts preserved?", a: "Yes. Slides are rendered with their fonts, colours and layout intact." },
      { q: "Is my presentation private?", a: "Yes. Your file is processed securely and never stored." },
    ],
  },
  {
    slug: "how-to-convert-pdf-to-powerpoint",
    title: "How to Convert PDF to PowerPoint (Free, Editable Slides)",
    metaDescription:
      "Learn how to convert PDF to PowerPoint for free. Turn PDF pages into editable PPTX slides for your next presentation. No sign-up required.",
    h1: "How to convert PDF to PowerPoint",
    keywords: ["pdf to powerpoint", "convert pdf to powerpoint", "pdf to pptx", "pdf to slides", "pdf to ppt"],
    updated: "2026-06-29",
    toolSlug: "pdf-to-powerpoint",
    toolCategory: "office-tools",
    intro: [
      "Need to present a document or reuse a PDF in a slide deck? Converting a PDF to PowerPoint turns each page into a slide you can edit, annotate and build on.",
      "This guide shows how to convert PDFs into editable PowerPoint slides for free.",
    ],
    sections: [
      {
        heading: "Convert PDF to editable slides",
        body: ["Each page becomes a slide you can open in PowerPoint, Keynote or Google Slides."],
        steps: [
          "Open the PDF to PowerPoint tool.",
          "Drop your PDF or click to select it.",
          "Click Convert to PowerPoint.",
          "Download the PPTX and edit it in your presentation app.",
        ],
      },
      {
        heading: "How pages map to slides",
        body: [
          "Each PDF page becomes one slide, in the original order.",
          "Text and images are placed on the slide for editing.",
          "Complex layouts may need minor adjustments in your slide editor.",
        ],
      },
    ],
    faqs: [
      { q: "Is it free?", a: "Yes. PDF to PowerPoint conversion is free with no sign-up and no watermark." },
      { q: "Can I edit the slides?", a: "Yes. The output is a standard PPTX you can edit in PowerPoint, Keynote or Google Slides." },
      { q: "How are pages mapped?", a: "Each PDF page becomes one slide, in the original order." },
      { q: "Is my PDF private?", a: "Yes. Your file is processed securely and never stored." },
    ],
  },
];

const guideBySlug = new Map(guides.map((g) => [g.slug, g]));

export function getGuide(slug: string): GuideDefinition | undefined {
  return guideBySlug.get(slug);
}

export const guideSlugs = guides.map((g) => g.slug);
