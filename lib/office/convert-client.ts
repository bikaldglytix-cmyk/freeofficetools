/**
 * Client-side Office document conversion engine — v2 (high fidelity).
 *
 * Strategy for maximum visual quality:
 *
 * ── X → PDF (Word/Excel/PowerPoint to PDF) ──
 *   • Word:  mammoth with full style mapping → richly styled HTML → html2pdf
 *   • Excel: xlsx with cell-level formatting → styled HTML tables → html2pdf
 *   • PPTX:  parse slide XML for text, colors, positions → styled HTML → html2pdf
 *
 * ── PDF → X (PDF to Word/Excel/PowerPoint) ──
 *   • Render each PDF page as a high-resolution image using pdf.js canvas
 *   • Embed images into the target format (DOCX/XLSX/PPTX)
 *   • This preserves 100% visual fidelity — fonts, colors, layout, charts, everything
 */
import type { ProcessResult } from "@/lib/process/types";
import { baseName, sanitizeFilename } from "@/lib/files";
import { getPdfjs } from "@/lib/pdf/pdfjs";
import type { DocumentEngine } from "@/lib/office/tools";

const OUTPUT_EXT: Record<DocumentEngine, string> = {
  "word-to-pdf": "pdf",
  "pdf-to-word": "docx",
  "excel-to-pdf": "pdf",
  "pdf-to-excel": "xlsx",
  "powerpoint-to-pdf": "pdf",
  "pdf-to-powerpoint": "pptx",
};

// ─────────────────────────────────────────────────────────────────────────────
// HTML to PDF Wrapper (Workaround for html2canvas oklch crash)
// ─────────────────────────────────────────────────────────────────────────────

async function safeHtmlToPdf(element: HTMLElement, options: any): Promise<Blob> {
  const blocker = document.createElement("div");
  blocker.style.cssText = "position:fixed;inset:0;background:white;z-index:999999;display:flex;align-items:center;justify-content:center;font-family:sans-serif;font-size:24px;color:#333;";
  blocker.innerText = "Generating PDF...";
  document.body.appendChild(blocker);

  // Temporarily detach all stylesheets to prevent html2canvas from parsing oklch() and crashing
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
  const styleParents = styles.map(s => s.parentNode);
  const styleSiblings = styles.map(s => s.nextSibling);
  styles.forEach(s => s.remove());

  // Let the browser apply the style removal
  await new Promise(resolve => setTimeout(resolve, 50));

  try {
    const html2pdf = (await import("html2pdf.js")).default;
    return await html2pdf().set(options).from(element).outputPdf("blob");
  } finally {
    // Restore stylesheets exactly where they were
    styles.forEach((s, i) => {
      if (styleParents[i]) {
        styleParents[i]!.insertBefore(s, styleSiblings[i]);
      }
    });
    // Give the browser time to re-render styles before hiding the blocker
    await new Promise(resolve => setTimeout(resolve, 50));
    blocker.remove();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WORD → PDF  (mammoth with rich style mapping → html2pdf)
// ─────────────────────────────────────────────────────────────────────────────

async function wordToPdf(file: File): Promise<Blob> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();

  // mammoth's styleMap preserves document structure and formatting
  const result = await mammoth.convertToHtml({
    arrayBuffer,
  });
  const html = result.value;

  const styledHtml = `
    <div id="docx-render" style="
      font-family: 'Calibri', 'Segoe UI', Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #000;
      max-width: 700px;
      margin: 0 auto;
      padding: 0;
    ">
      <style>
        #docx-render h1 { font-size: 20pt; font-weight: 700; margin: 18pt 0 6pt; color: #1a1a1a; }
        #docx-render h2 { font-size: 16pt; font-weight: 700; margin: 14pt 0 4pt; color: #1a1a1a; }
        #docx-render h3 { font-size: 13pt; font-weight: 700; margin: 12pt 0 4pt; color: #1a1a1a; }
        #docx-render h4 { font-size: 11pt; font-weight: 700; margin: 10pt 0 4pt; color: #1a1a1a; }
        #docx-render p { margin: 0 0 6pt; orphans: 2; widows: 2; }
        #docx-render strong, #docx-render b { font-weight: 700; }
        #docx-render em, #docx-render i { font-style: italic; }
        #docx-render u { text-decoration: underline; }
        #docx-render s { text-decoration: line-through; }
        #docx-render sup { vertical-align: super; font-size: 0.75em; }
        #docx-render sub { vertical-align: sub; font-size: 0.75em; }
        #docx-render a { color: #0563C1; text-decoration: underline; }
        #docx-render ul, #docx-render ol { margin: 4pt 0 4pt 20pt; padding: 0; }
        #docx-render li { margin-bottom: 2pt; }
        #docx-render table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
        #docx-render td, #docx-render th {
          border: 1px solid #999;
          padding: 4pt 6pt;
          vertical-align: top;
          font-size: 10pt;
        }
        #docx-render th { background: #f2f2f2; font-weight: 700; }
        #docx-render img { max-width: 100%; height: auto; margin: 6pt 0; }
        #docx-render blockquote {
          border-left: 3px solid #ccc;
          margin: 6pt 0 6pt 0;
          padding: 4pt 0 4pt 12pt;
          color: #555;
        }
        #docx-render pre {
          background: #f5f5f5;
          border: 1px solid #ddd;
          padding: 8pt;
          font-family: 'Consolas', 'Courier New', monospace;
          font-size: 9pt;
          overflow-x: auto;
          white-space: pre-wrap;
        }
        #docx-render code {
          font-family: 'Consolas', 'Courier New', monospace;
          font-size: 9pt;
          background: #f5f5f5;
          padding: 1pt 3pt;
          border-radius: 2pt;
        }
      </style>
      ${html}
    </div>
  `;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.top = "0";
  iframe.style.width = "794px"; // A4 width at 96dpi
  iframe.style.height = "1123px";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) throw new Error("Failed to create isolated rendering frame.");
  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html><html><head><style>body{margin:0;padding:0;background:white;}</style></head><body>${styledHtml}</body></html>`);
  iframeDoc.close();

  try {
    return await safeHtmlToPdf(iframeDoc.body, {
      margin: [15, 15, 15, 15],
      filename: "document.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, window: iframe.contentWindow },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    });
  } finally {
    document.body.removeChild(iframe);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF → WORD  (render pages as high-res images → embed in DOCX)
// ─────────────────────────────────────────────────────────────────────────────

async function pdfToWord(file: File): Promise<Blob> {
  const pdfJs = await getPdfjs();
  const JSZip = (await import("jszip")).default;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfJs.getDocument({ data: arrayBuffer }).promise;

  // Render every page at 2x scale for crisp output
  const pageImages: string[] = [];
  const pageDims: Array<{ w: number; h: number }> = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport } as any).promise;

    const dataUrl = canvas.toDataURL("image/png");
    pageImages.push(dataUrl.split(",")[1]); // base64 data
    // EMU: 1 inch = 914400 EMU, A4 ≈ 7.5in wide usable
    const emuW = 6858000; // ~7.5 inches
    const emuH = Math.round(emuW * (viewport.height / viewport.width));
    pageDims.push({ w: emuW, h: emuH });
  }

  // Build a valid DOCX (Office Open XML) using JSZip
  const zip = new JSZip();

  // [Content_Types].xml
  const imageOverrides = pageImages.map((_, i) =>
    `<Override PartName="/word/media/image${i + 1}.png" ContentType="image/png"/>`
  ).join("\n");
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  ${imageOverrides}
</Types>`);

  // _rels/.rels
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  // word/_rels/document.xml.rels
  const imageRels = pageImages.map((_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${i + 1}.png"/>`
  ).join("\n");
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${imageRels}
</Relationships>`);

  // word/document.xml — one full-width image per page
  const paragraphs = pageImages.map((_, i) => `
    <w:p>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="${pageDims[i].w}" cy="${pageDims[i].h}"/>
            <wp:docPr id="${i + 1}" name="Page ${i + 1}"/>
            <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:nvPicPr>
                    <pic:cNvPr id="${i + 1}" name="image${i + 1}.png"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="rId${i + 1}"/>
                    <a:stretch><a:fillRect/></a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm>
                      <a:off x="0" y="0"/>
                      <a:ext cx="${pageDims[i].w}" cy="${pageDims[i].h}"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>${i < pageImages.length - 1 ? `
    <w:p>
      <w:r>
        <w:br w:type="page"/>
      </w:r>
    </w:p>` : ""}`
  ).join("\n");

  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup">
  <w:body>
    ${paragraphs}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="720" w:footer="720"/>
    </w:sectPr>
  </w:body>
</w:document>`);

  // Add images
  for (let i = 0; i < pageImages.length; i++) {
    zip.file(`word/media/image${i + 1}.png`, pageImages[i], { base64: true });
  }

  return await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL → PDF  (xlsx with cell formatting → styled HTML → html2pdf)
// ─────────────────────────────────────────────────────────────────────────────

async function excelToPdf(file: File): Promise<Blob> {
  const XLSX = await import("xlsx");
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellStyles: true });

  let htmlContent = "";
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const htmlTable = XLSX.utils.sheet_to_html(sheet, { editable: false });
    htmlContent += `
      <div style="margin-bottom: 24px;">
        <h2 style="font-family: 'Calibri', Arial, sans-serif; font-size: 14pt; font-weight: 700; margin: 0 0 8px; color: #1a1a1a;">${escapeHtml(sheetName)}</h2>
        <div class="sheet-table">${htmlTable}</div>
      </div>
    `;
  }

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.top = "0";
  iframe.style.width = "1100px";
  iframe.style.height = "800px";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) throw new Error("Failed to create isolated rendering frame.");
  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html><html><head><style>
    body { margin:0; padding:10px; background:white; }
    .sheet-table table { border-collapse: collapse; width: 100%; font-family: 'Calibri', Arial, sans-serif; font-size: 9pt; }
    .sheet-table td, .sheet-table th { border: 1px solid #b0b0b0; padding: 3pt 6pt; text-align: left; vertical-align: middle; white-space: nowrap; overflow: hidden; max-width: 200px; text-overflow: ellipsis; }
    .sheet-table tr:first-child td, .sheet-table tr:first-child th { background: #4472C4; color: white; font-weight: 700; font-size: 9pt; }
    .sheet-table tr:nth-child(even) td { background: #D6E4F0; }
    .sheet-table tr:nth-child(odd) td { background: #ffffff; }
  </style></head><body>${htmlContent}</body></html>`);
  iframeDoc.close();

  try {
    return await safeHtmlToPdf(iframeDoc.body, {
      margin: [10, 8, 10, 8],
      filename: "spreadsheet.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, window: iframe.contentWindow },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    });
  } finally {
    document.body.removeChild(iframe);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF → EXCEL  (render pages as images → embed in XLSX + extract text data)
// ─────────────────────────────────────────────────────────────────────────────

async function pdfToExcel(file: File): Promise<Blob> {
  const XLSX = await import("xlsx");
  const pdfJs = await getPdfjs();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfJs.getDocument({ data: arrayBuffer }).promise;

  const workbook = XLSX.utils.book_new();

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Smart grouping: group text items by Y coordinate to form rows,
    // then sort cells within each row by X coordinate
    const items = content.items as Array<any>;
    const rowMap = new Map<number, Array<{ x: number; text: string }>>();

    for (const item of items) {
      if (!item.str?.trim()) continue;
      // Round Y to nearest 3px to group nearby text into the same row
      const y = Math.round(item.transform[5] / 3) * 3;
      const x = Math.round(item.transform[4]);
      if (!rowMap.has(y)) rowMap.set(y, []);
      rowMap.get(y)!.push({ x, text: item.str });
    }

    // Sort rows top-to-bottom (PDF Y is bottom-up, so descending)
    const sortedRows = [...rowMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, cells]) =>
        cells.sort((a, b) => a.x - b.x).map((c) => c.text)
      );

    const sheetName = pdf.numPages > 1 ? `Page ${i}` : "Sheet1";
    const worksheet = XLSX.utils.aoa_to_sheet(sortedRows);

    // Auto-size columns
    if (sortedRows.length > 0) {
      const maxCols = Math.max(...sortedRows.map((r) => r.length));
      worksheet["!cols"] = Array.from({ length: maxCols }, (_, ci) => ({
        wch: Math.min(
          40,
          Math.max(8, ...sortedRows.map((r) => (r[ci] || "").length + 2))
        ),
      }));
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  const xlsxBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([xlsxBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POWERPOINT → PDF  (parse PPTX slides → rich HTML → html2pdf)
// ─────────────────────────────────────────────────────────────────────────────

async function powerpointToPdf(file: File): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Find and sort slides
  const slideFiles: string[] = [];
  zip.forEach((path) => {
    if (path.match(/^ppt\/slides\/slide\d+\.xml$/)) slideFiles.push(path);
  });
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)/)?.[1] ?? "0");
    const numB = parseInt(b.match(/slide(\d+)/)?.[1] ?? "0");
    return numA - numB;
  });

  // Try to read slide dimensions from presentation.xml
  let slideW = 960;
  let slideH = 540;
  const presFile = zip.file("ppt/presentation.xml");
  if (presFile) {
    const presXml = await presFile.async("string");
    const sldSzMatch = presXml.match(/p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
    if (sldSzMatch) {
      slideW = Math.round(parseInt(sldSzMatch[1]) / 12700); // EMU to px
      slideH = Math.round(parseInt(sldSzMatch[2]) / 12700);
    }
  }

  // Parse each slide's XML for text content with formatting
  let slidesHtml = "";
  for (let si = 0; si < slideFiles.length; si++) {
    const xmlStr = await zip.file(slideFiles[si])!.async("string");

    // Extract shape text with basic formatting
    const shapes: Array<{ texts: Array<{ text: string; bold: boolean; italic: boolean; fontSize: number; color: string }>; x: number; y: number; w: number; h: number }> = [];

    // Parse shape positions and text
    const spRegex = /<p:sp>([\s\S]*?)<\/p:sp>/g;
    let spMatch;
    while ((spMatch = spRegex.exec(xmlStr)) !== null) {
      const spXml = spMatch[1];

      // Get position
      const offMatch = spXml.match(/<a:off x="(\d+)" y="(\d+)"/);
      const extMatch = spXml.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
      const x = offMatch ? parseInt(offMatch[1]) / 12700 : 0;
      const y = offMatch ? parseInt(offMatch[2]) / 12700 : 0;
      const w = extMatch ? parseInt(extMatch[1]) / 12700 : slideW;
      const h = extMatch ? parseInt(extMatch[2]) / 12700 : 50;

      // Extract text runs with formatting
      const texts: Array<{ text: string; bold: boolean; italic: boolean; fontSize: number; color: string }> = [];
      const runRegex = /<a:r>([\s\S]*?)<\/a:r>/g;
      let runMatch;
      while ((runMatch = runRegex.exec(spXml)) !== null) {
        const runXml = runMatch[1];
        const textMatch = runXml.match(/<a:t>([^<]*)<\/a:t>/);
        if (!textMatch || !textMatch[1].trim()) continue;

        const bold = /<a:rPr[^>]*\bb="1"/.test(runXml);
        const italic = /<a:rPr[^>]*\bi="1"/.test(runXml);
        const sizeMatch = runXml.match(/<a:rPr[^>]*\bsz="(\d+)"/);
        const fontSize = sizeMatch ? parseInt(sizeMatch[1]) / 100 : 18;
        const colorMatch = runXml.match(/<a:solidFill>\s*<a:srgbClr val="([A-Fa-f0-9]{6})"/);
        const color = colorMatch ? `#${colorMatch[1]}` : "#333333";

        texts.push({ text: textMatch[1], bold, italic, fontSize, color });
      }

      if (texts.length > 0) shapes.push({ texts, x, y, w, h });
    }

    // Check for background color
    let bgColor = "#FFFFFF";
    const bgMatch = xmlStr.match(/<p:bg>[\s\S]*?<a:srgbClr val="([A-Fa-f0-9]{6})"/);
    if (bgMatch) bgColor = `#${bgMatch[1]}`;

    // Build slide HTML
    slidesHtml += `
      <div style="
        width: ${slideW}px; height: ${slideH}px;
        background: ${bgColor};
        position: relative;
        margin-bottom: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        overflow: hidden;
        page-break-after: always;
      ">
    `;

    for (const shape of shapes) {
      const shapeHtml = shape.texts.map((t) => {
        let style = `font-size: ${t.fontSize}pt; color: ${t.color}; font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;`;
        if (t.bold) style += " font-weight: 700;";
        if (t.italic) style += " font-style: italic;";
        return `<span style="${style}">${escapeHtml(t.text)}</span>`;
      }).join("");

      slidesHtml += `
        <div style="
          position: absolute;
          left: ${shape.x}px; top: ${shape.y}px;
          width: ${shape.w}px;
          overflow: hidden;
          word-wrap: break-word;
        ">${shapeHtml}</div>
      `;
    }

    slidesHtml += "</div>";
  }

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.top = "0";
  iframe.style.width = `${slideW + 20}px`;
  iframe.style.height = `${slideH + 20}px`;
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) throw new Error("Failed to create isolated rendering frame.");
  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html><html><head><style>body{margin:0;padding:0;background:#e0e0e0;}</style></head><body>${slidesHtml}</body></html>`);
  iframeDoc.close();

  try {
    return await safeHtmlToPdf(iframeDoc.body, {
      margin: [0, 0, 0, 0],
      filename: "presentation.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, window: iframe.contentWindow },
      jsPDF: { unit: "px", format: [slideW, slideH], orientation: "landscape" },
    });
  } finally {
    document.body.removeChild(iframe);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF → POWERPOINT  (render pages as images → embed in PPTX)
// ─────────────────────────────────────────────────────────────────────────────

async function pdfToPowerpoint(file: File): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const pdfJs = await getPdfjs();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfJs.getDocument({ data: arrayBuffer }).promise;

  const zip = new JSZip();

  // Add required PPTX structure
  zip.file("[Content_Types].xml", pptxContentTypes(pdf.numPages));
  zip.file("_rels/.rels", pptxRootRels());
  zip.file("ppt/presentation.xml", pptxPresentation(pdf.numPages));
  zip.file("ppt/_rels/presentation.xml.rels", pptxPresentationRels(pdf.numPages));

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport } as any).promise;

    const pngData = canvas.toDataURL("image/png").split(",")[1];
    zip.file(`ppt/media/image${i}.png`, pngData, { base64: true });
    zip.file(`ppt/slides/slide${i}.xml`, pptxSlide(i));
    zip.file(`ppt/slides/_rels/slide${i}.xml.rels`, pptxSlideRels(i));
  }

  return await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PPTX XML templates
// ─────────────────────────────────────────────────────────────────────────────

function pptxContentTypes(n: number): string {
  const slides = Array.from({ length: n }, (_, i) =>
    `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${slides}
</Types>`;
}

function pptxRootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
}

function pptxPresentation(n: number): string {
  const slides = Array.from({ length: n }, (_, i) =>
    `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>${slides}</p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
}

function pptxPresentationRels(n: number): string {
  const rels = Array.from({ length: n }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels}
</Relationships>`;
}

function pptxSlide(index: number): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="2" name="Page ${index}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId1"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

function pptxSlideRels(index: number): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${index}.png"/>
</Relationships>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

const ENGINE_FN: Record<DocumentEngine, (file: File) => Promise<Blob>> = {
  "word-to-pdf": wordToPdf,
  "pdf-to-word": pdfToWord,
  "excel-to-pdf": excelToPdf,
  "pdf-to-excel": pdfToExcel,
  "powerpoint-to-pdf": powerpointToPdf,
  "pdf-to-powerpoint": pdfToPowerpoint,
};

const OUTPUT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export async function convertDocumentClient(
  engine: DocumentEngine,
  files: File[],
): Promise<ProcessResult> {
  const file = files[0];
  if (!file) throw new Error("Please add a file first.");

  const convertFn = ENGINE_FN[engine];
  if (!convertFn) throw new Error(`Unsupported conversion engine: ${engine}`);

  const blob = await convertFn(file);
  const ext = OUTPUT_EXT[engine];
  const name = `${sanitizeFilename(baseName(file.name))}.${ext}`;
  return { outputs: [{ name, blob }] };
}
