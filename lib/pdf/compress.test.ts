import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { compressPdf } from "./compress";
import type { CompressMeta } from "./compress";

async function textPdf(pages = 2): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Hello searchable world ${i}`, { x: 50, y: 700, size: 24, font });
  }
  return doc.save();
}

const asFile = (bytes: Uint8Array): File => new File([bytes as unknown as BlobPart], "doc.pdf", { type: "application/pdf" });
const outBytes = async (res: Awaited<ReturnType<typeof compressPdf>>) =>
  new Uint8Array(await res.outputs[0].blob.arrayBuffer());

describe("compressPdf — text-preserving (no rasterization)", () => {
  it("keeps a text PDF as a valid, multi-page PDF and never larger than the input", async () => {
    const original = await textPdf(2);
    const res = await compressPdf([asFile(original)], { maxDim: 1600, quality: 0.65 });
    const meta = res.meta as unknown as CompressMeta;

    const out = await outBytes(res);
    // Never hand back a bigger file.
    expect(out.byteLength).toBeLessThanOrEqual(meta.originalSize);
    // Crucially: still a real PDF with both pages — NOT flattened to page images.
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(2);
  });

  it("target mode returns a valid best-effort PDF, never larger than the original", async () => {
    const original = await textPdf(2);
    const res = await compressPdf([asFile(original)], { maxDim: 1600, quality: 0.65, targetBytes: 1 });
    const meta = res.meta as unknown as CompressMeta;

    const out = await outBytes(res);
    expect(out.byteLength).toBeLessThanOrEqual(meta.originalSize);
    expect(meta.targetBytes).toBe(1);
    await expect(PDFDocument.load(out)).resolves.toBeDefined();
  });
});
