import type { LucideIcon } from "lucide-react";
import { FileText, FileSpreadsheet, Presentation, FileOutput, FileInput, FileDown } from "lucide-react";

import type { ToolStep, ToolFaq } from "@/lib/tools";

export type OfficeGroup = "word" | "excel" | "powerpoint";

/** Conversion engine id consumed by convertDocument() (see lib/office/convert.ts). */
export type DocumentEngine =
  | "word-to-pdf"
  | "pdf-to-word"
  | "excel-to-pdf"
  | "pdf-to-excel"
  | "powerpoint-to-pdf"
  | "pdf-to-powerpoint";

export interface OfficeToolDefinition {
  slug: string;
  name: string;
  category: "office";
  group: OfficeGroup;
  icon: LucideIcon;
  /** Where the conversion runs. Office conversions need server-grade fidelity. */
  processing: "client" | "server";
  engine: DocumentEngine;

  short: string;
  title: string;
  metaDescription: string;
  h1: string;
  heroSubtitle: string;
  keywords: string[];

  intro: string[];
  steps: ToolStep[];
  benefits: string[];
  faqs: ToolFaq[];
  /** Slugs of related tools across any category (resolved via lib/registry.ts). */
  related: string[];

  accept: string;
  acceptLabel: string;
  maxSizeMb: number;
  action: string;
  processingLabel: string;
  downloadLabel: string;
}

const DOCX_ACCEPT = "application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,.doc";
const XLSX_ACCEPT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,.xls,.csv";
const PPTX_ACCEPT = "application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx,.ppt";
const PDF_ACCEPT = "application/pdf,.pdf";

export const officeTools: OfficeToolDefinition[] = [
  {
    slug: "word-to-pdf",
    name: "Word to PDF",
    category: "office",
    group: "word",
    icon: FileText,
    processing: "server",
    engine: "word-to-pdf",
    short: "Convert Word documents to PDF with the layout preserved.",
    title: "Word to PDF — Free DOCX to PDF Converter",
    metaDescription:
      "Convert Word to PDF online for free. Turn DOC and DOCX files into polished PDFs with fonts, images and layout preserved. Fast, private and no sign-up.",
    h1: "Word to PDF Converter",
    heroSubtitle: "Turn DOC and DOCX files into clean, shareable PDFs with the formatting intact.",
    keywords: ["word to pdf", "docx to pdf", "convert word to pdf", "doc to pdf", "word to pdf converter"],
    intro: [
      "Converting a Word document to PDF locks in its layout so it looks the same on every device — no shifted text, swapped fonts or broken images. PDF is the format people expect for résumés, reports, invoices and anything you send to be printed or signed.",
      "This converter renders your DOC or DOCX exactly as Word would, then saves it as a PDF that's ready to share. Your document is handled securely and never stored.",
    ],
    steps: [
      { title: "Add your Word file", text: "Drag your DOC or DOCX into the box, or click to choose it from your device." },
      { title: "Convert to PDF", text: "Click Convert and the document is rendered to PDF with its formatting preserved." },
      { title: "Download your PDF", text: "Download the finished PDF, ready to print, send or sign." },
    ],
    benefits: [
      "Layout, fonts and images stay exactly as designed.",
      "PDFs open and print the same way everywhere.",
      "No watermark and no sign-up required.",
      "Files are processed securely and never stored.",
    ],
    faqs: [
      { q: "How do I convert Word to PDF?", a: "Add your DOC or DOCX file and click Convert. The document is rendered to PDF with its fonts, images and layout preserved, then downloads automatically." },
      { q: "Will my formatting be preserved?", a: "Yes. The conversion reproduces your document's layout, fonts and images so the PDF matches the original Word file." },
      { q: "Is it free and private?", a: "Yes. Converting is free with no sign-up, and your file is processed securely and never stored or shared." },
      { q: "Which Word formats are supported?", a: "Modern .docx files and older .doc files are both supported." },
    ],
    related: ["pdf-to-word", "excel-to-pdf", "powerpoint-to-pdf", "merge-pdf", "compress-pdf"],
    accept: DOCX_ACCEPT,
    acceptLabel: "Word documents (.doc, .docx)",
    maxSizeMb: 100,
    action: "Convert to PDF",
    processingLabel: "Converting to PDF…",
    downloadLabel: "Download PDF",
  },
  {
    slug: "pdf-to-word",
    name: "PDF to Word",
    category: "office",
    group: "word",
    icon: FileInput,
    processing: "server",
    engine: "pdf-to-word",
    short: "Convert PDFs into editable Word documents.",
    title: "PDF to Word — Free PDF to DOCX Converter",
    metaDescription:
      "Convert PDF to Word online for free. Turn PDF files into editable DOCX documents with text and layout preserved. Private, fast and no sign-up required.",
    h1: "PDF to Word Converter",
    heroSubtitle: "Turn PDF files into editable Word documents you can change and reuse.",
    keywords: ["pdf to word", "pdf to docx", "convert pdf to word", "pdf to word converter", "edit pdf in word"],
    intro: [
      "Sometimes you receive a PDF but need to edit it — fix a typo, update a figure, reuse a paragraph. Converting the PDF to an editable Word document gives you back text you can change, without retyping anything.",
      "This converter extracts the text and structure from your PDF and rebuilds it as a DOCX you can open in Word, Google Docs or any word processor. Your file is processed securely and never stored.",
    ],
    steps: [
      { title: "Add your PDF", text: "Drag your PDF into the box, or click to select it from your device." },
      { title: "Convert to Word", text: "Click Convert and the PDF is rebuilt as an editable DOCX document." },
      { title: "Download your DOCX", text: "Open the Word file and edit it however you like." },
    ],
    benefits: [
      "Get editable text back without retyping.",
      "Opens in Word, Google Docs and more.",
      "Keeps paragraphs and basic structure.",
      "Free, private and no sign-up.",
    ],
    faqs: [
      { q: "How do I convert PDF to Word?", a: "Add your PDF and click Convert. The text and layout are rebuilt into an editable DOCX file that downloads automatically." },
      { q: "Will the Word file be fully editable?", a: "Yes. The output is a standard DOCX you can edit in Word, Google Docs or any word processor." },
      { q: "Does it work on scanned PDFs?", a: "Text-based PDFs convert best. Scanned (image-only) PDFs need OCR to recognise the text, which is on our roadmap." },
      { q: "Is my PDF kept private?", a: "Yes. Your file is processed securely for the conversion and is never stored or shared." },
    ],
    related: ["word-to-pdf", "pdf-to-excel", "pdf-to-powerpoint", "compress-pdf", "merge-pdf"],
    accept: PDF_ACCEPT,
    acceptLabel: "a PDF file",
    maxSizeMb: 100,
    action: "Convert to Word",
    processingLabel: "Converting to Word…",
    downloadLabel: "Download DOCX",
  },
  {
    slug: "excel-to-pdf",
    name: "Excel to PDF",
    category: "office",
    group: "excel",
    icon: FileSpreadsheet,
    processing: "server",
    engine: "excel-to-pdf",
    short: "Convert Excel spreadsheets to clean, shareable PDFs.",
    title: "Excel to PDF — Free XLSX to PDF Converter",
    metaDescription:
      "Convert Excel to PDF online for free. Turn XLSX and XLS spreadsheets into tidy PDFs with rows, columns and formatting preserved. Private, fast, no sign-up.",
    h1: "Excel to PDF Converter",
    heroSubtitle: "Turn XLS and XLSX spreadsheets into tidy PDFs that are easy to share and print.",
    keywords: ["excel to pdf", "xlsx to pdf", "convert excel to pdf", "spreadsheet to pdf", "xls to pdf"],
    intro: [
      "Spreadsheets are awkward to share — columns get cut off, formatting changes, and not everyone has Excel. Converting an Excel file to PDF freezes the layout into a clean page that anyone can open, view and print exactly as intended.",
      "This converter renders your sheets to PDF with their rows, columns and formatting preserved. Your file is processed securely and never stored.",
    ],
    steps: [
      { title: "Add your Excel file", text: "Drag your XLS or XLSX into the box, or click to choose it from your device." },
      { title: "Convert to PDF", text: "Click Convert and your spreadsheet is rendered to a clean PDF." },
      { title: "Download your PDF", text: "Download a PDF that's easy to share, view and print." },
    ],
    benefits: [
      "Columns and formatting stay intact.",
      "Anyone can open it — no Excel needed.",
      "Prints cleanly, every time.",
      "Free, private and no sign-up.",
    ],
    faqs: [
      { q: "How do I convert Excel to PDF?", a: "Add your XLS or XLSX file and click Convert. Your sheets are rendered to a PDF with their layout preserved, then downloaded." },
      { q: "Will my columns and formatting be kept?", a: "Yes. Rows, columns, fonts and cell formatting are preserved so the PDF matches your spreadsheet." },
      { q: "Can I convert multiple sheets?", a: "Yes. A workbook with several sheets is converted into a multi-page PDF." },
      { q: "Is it free and private?", a: "Yes. It's free with no sign-up, and your file is processed securely and never stored." },
    ],
    related: ["pdf-to-excel", "word-to-pdf", "powerpoint-to-pdf", "merge-pdf", "compress-pdf"],
    accept: XLSX_ACCEPT,
    acceptLabel: "Excel files (.xls, .xlsx, .csv)",
    maxSizeMb: 100,
    action: "Convert to PDF",
    processingLabel: "Converting to PDF…",
    downloadLabel: "Download PDF",
  },
  {
    slug: "pdf-to-excel",
    name: "PDF to Excel",
    category: "office",
    group: "excel",
    icon: FileOutput,
    processing: "server",
    engine: "pdf-to-excel",
    short: "Extract tables from PDFs into editable Excel spreadsheets.",
    title: "PDF to Excel — Free PDF to XLSX Converter",
    metaDescription:
      "Convert PDF to Excel online for free. Extract tables and data from PDF files into editable XLSX spreadsheets. Private, fast and no sign-up required.",
    h1: "PDF to Excel Converter",
    heroSubtitle: "Pull tables and data out of PDFs into editable Excel spreadsheets.",
    keywords: ["pdf to excel", "pdf to xlsx", "convert pdf to excel", "extract table from pdf", "pdf to spreadsheet"],
    intro: [
      "Re-typing numbers out of a PDF is slow and error-prone. Converting a PDF to Excel pulls the tables and data straight into a spreadsheet, so you can sort, total and analyse them right away.",
      "This converter detects the tabular data in your PDF and rebuilds it as an editable XLSX file. Your document is processed securely and never stored.",
    ],
    steps: [
      { title: "Add your PDF", text: "Drag your PDF into the box, or click to select it from your device." },
      { title: "Convert to Excel", text: "Click Convert and the tables are extracted into a spreadsheet." },
      { title: "Download your XLSX", text: "Open the Excel file and work with your data directly." },
    ],
    benefits: [
      "Turn locked PDF tables into editable data.",
      "Stop re-typing rows and columns.",
      "Opens in Excel, Google Sheets and more.",
      "Free, private and no sign-up.",
    ],
    faqs: [
      { q: "How do I convert PDF to Excel?", a: "Add your PDF and click Convert. Tables and data are extracted into an editable XLSX file that downloads automatically." },
      { q: "Does it keep my tables intact?", a: "Well-structured tables in text-based PDFs convert best, mapping rows and columns into spreadsheet cells." },
      { q: "Will it work on scanned PDFs?", a: "Text-based PDFs work best. Scanned PDFs need OCR to read the numbers, which is on our roadmap." },
      { q: "Is my file private?", a: "Yes. Your PDF is processed securely for the conversion and is never stored or shared." },
    ],
    related: ["excel-to-pdf", "pdf-to-word", "pdf-to-powerpoint", "compress-pdf", "merge-pdf"],
    accept: PDF_ACCEPT,
    acceptLabel: "a PDF file",
    maxSizeMb: 100,
    action: "Convert to Excel",
    processingLabel: "Converting to Excel…",
    downloadLabel: "Download XLSX",
  },
  {
    slug: "powerpoint-to-pdf",
    name: "PowerPoint to PDF",
    category: "office",
    group: "powerpoint",
    icon: Presentation,
    processing: "server",
    engine: "powerpoint-to-pdf",
    short: "Convert PowerPoint slides to a shareable PDF.",
    title: "PowerPoint to PDF — Free PPTX Converter",
    metaDescription:
      "Convert PowerPoint to PDF online for free. Turn PPT and PPTX slides into a clean PDF with layout and fonts preserved. Private, fast and no sign-up required.",
    h1: "PowerPoint to PDF Converter",
    heroSubtitle: "Turn PPT and PPTX presentations into a clean PDF, one slide per page.",
    keywords: ["powerpoint to pdf", "pptx to pdf", "convert powerpoint to pdf", "ppt to pdf", "slides to pdf"],
    intro: [
      "Sharing a PowerPoint file means hoping the recipient has PowerPoint and that your fonts and animations survive. Converting it to PDF turns each slide into a page that opens perfectly anywhere — ideal for handouts, attachments and printing.",
      "This converter renders every slide to PDF with its layout and fonts preserved. Your presentation is processed securely and never stored.",
    ],
    steps: [
      { title: "Add your presentation", text: "Drag your PPT or PPTX into the box, or click to choose it from your device." },
      { title: "Convert to PDF", text: "Click Convert and each slide is rendered onto its own PDF page." },
      { title: "Download your PDF", text: "Download a PDF that's perfect for sharing, printing and handouts." },
    ],
    benefits: [
      "Every slide becomes a clean PDF page.",
      "Fonts and layout look the same everywhere.",
      "No PowerPoint needed to open it.",
      "Free, private and no sign-up.",
    ],
    faqs: [
      { q: "How do I convert PowerPoint to PDF?", a: "Add your PPT or PPTX file and click Convert. Each slide is rendered onto a PDF page, then the PDF downloads automatically." },
      { q: "Is one slide one page?", a: "Yes. Each slide becomes a single page in the PDF, in the original order." },
      { q: "Are fonts and layout preserved?", a: "Yes. Slides are rendered with their fonts, colours and layout so the PDF matches your presentation." },
      { q: "Is it free and private?", a: "Yes. It's free with no sign-up, and your file is processed securely and never stored." },
    ],
    related: ["pdf-to-powerpoint", "word-to-pdf", "excel-to-pdf", "merge-pdf", "compress-pdf"],
    accept: PPTX_ACCEPT,
    acceptLabel: "PowerPoint files (.ppt, .pptx)",
    maxSizeMb: 150,
    action: "Convert to PDF",
    processingLabel: "Converting to PDF…",
    downloadLabel: "Download PDF",
  },
  {
    slug: "pdf-to-powerpoint",
    name: "PDF to PowerPoint",
    category: "office",
    group: "powerpoint",
    icon: FileDown,
    processing: "server",
    engine: "pdf-to-powerpoint",
    short: "Convert PDF pages into editable PowerPoint slides.",
    title: "PDF to PowerPoint — Free PPTX Converter",
    metaDescription:
      "Convert PDF to PowerPoint online for free. Turn PDF pages into editable PPTX slides for your presentation. Private, fast and no sign-up required.",
    h1: "PDF to PowerPoint Converter",
    heroSubtitle: "Turn PDF pages into editable PowerPoint slides for your next presentation.",
    keywords: ["pdf to powerpoint", "pdf to pptx", "convert pdf to powerpoint", "pdf to ppt", "pdf to slides"],
    intro: [
      "Need to present a document or reuse a PDF in a deck? Converting a PDF to PowerPoint turns each page into a slide you can drop into your presentation, annotate and build on.",
      "This converter rebuilds your PDF pages as PPTX slides you can open and edit in PowerPoint, Keynote or Google Slides. Your file is processed securely and never stored.",
    ],
    steps: [
      { title: "Add your PDF", text: "Drag your PDF into the box, or click to select it from your device." },
      { title: "Convert to PowerPoint", text: "Click Convert and each page becomes a slide in a PPTX file." },
      { title: "Download your PPTX", text: "Open it in PowerPoint and build your presentation." },
    ],
    benefits: [
      "Reuse PDF content in your slides.",
      "One page becomes one slide.",
      "Opens in PowerPoint, Keynote and Google Slides.",
      "Free, private and no sign-up.",
    ],
    faqs: [
      { q: "How do I convert PDF to PowerPoint?", a: "Add your PDF and click Convert. Each page is turned into a slide in an editable PPTX file that downloads automatically." },
      { q: "Will the slides be editable?", a: "Yes. The output is a standard PPTX you can open and edit in PowerPoint, Keynote or Google Slides." },
      { q: "How are pages mapped to slides?", a: "Each PDF page becomes one slide, in the original order." },
      { q: "Is my PDF kept private?", a: "Yes. Your file is processed securely for the conversion and is never stored or shared." },
    ],
    related: ["powerpoint-to-pdf", "pdf-to-word", "pdf-to-excel", "compress-pdf", "merge-pdf"],
    accept: PDF_ACCEPT,
    acceptLabel: "a PDF file",
    maxSizeMb: 100,
    action: "Convert to PowerPoint",
    processingLabel: "Converting to PowerPoint…",
    downloadLabel: "Download PPTX",
  },
];

const officeBySlug = new Map(officeTools.map((t) => [t.slug, t]));

export function getOfficeTool(slug: string): OfficeToolDefinition | undefined {
  return officeBySlug.get(slug);
}

export const officeToolSlugs = officeTools.map((t) => t.slug);



export function getOfficeToolsByGroup(group: OfficeGroup): OfficeToolDefinition[] {
  return officeTools.filter((t) => t.group === group);
}
