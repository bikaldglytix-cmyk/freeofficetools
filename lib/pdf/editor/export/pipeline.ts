/**
 * ExportPipeline — orchestrates the full export, stage by stage:
 *
 *   load → validate → pages → whiteout → (content in z-order) → ocr →
 *   metadata → optimize/save → verify
 *
 * The pipeline consumes the canonical {@link DocumentState} (+ source bytes) and
 * NEVER touches UI state, so it runs identically in the browser, a Web Worker, a
 * Node test, or a route handler.
 *
 * FIDELITY NOTE: within a page, content objects (text/image/annotation/signature)
 * are painted in the model's z-order rather than in rigid per-type passes, so a
 * user's intended stacking (e.g. text over an image over another image) is
 * preserved. Whiteout/redaction masks are always laid down first (under
 * everything) and the invisible OCR layer last. The named stages remain the unit
 * of progress reporting and of the modular renderer services.
 *
 * PERFORMANCE: pages are processed one at a time (bounded peak memory regardless
 * of document size); images/fonts are embedded once and cached across pages;
 * `AbortSignal` is checked at every page boundary for prompt cancellation.
 */
import {
  isAnnotation,
  isImageObject,
  isSignature,
  isTextBlock,
} from "../model/guards";
import type { DocumentState, EditableObject } from "../model/types";
import { selectOcrLayer, selectPageObjects } from "../store/selectors";
import { AnnotationFlattener } from "./annotation-flattener";
import { ExportError, ExportCancelled, errorMessage, throwIfAborted } from "./errors";
import { ImageRenderer } from "./image-renderer";
import { MetadataWriter } from "./metadata-writer";
import { OcrExporter } from "./ocr-export";
import { resolveOptions } from "./options";
import { OverlayRenderer } from "./overlay-renderer";
import { PageOperations, type RenderTarget } from "./page-operations";
import { PDFWriter, type RenderContext } from "./pdf-writer";
import { SignatureRenderer } from "./signature-renderer";
import { TextRenderer } from "./text-renderer";
import { ValidationService } from "./validation";
import type { ExportDiagnostic, ExportInput, ExportResult, ExportStage } from "./types";

export interface PipelineDeps {
  validation: ValidationService;
  pageOps: PageOperations;
  overlay: OverlayRenderer;
  text: TextRenderer;
  image: ImageRenderer;
  annotations: AnnotationFlattener;
  signatures: SignatureRenderer;
  ocr: OcrExporter;
  metadata: MetadataWriter;
}

export class ExportPipeline {
  private readonly deps: PipelineDeps;

  constructor(deps?: Partial<PipelineDeps>) {
    this.deps = {
      validation: deps?.validation ?? new ValidationService(),
      pageOps: deps?.pageOps ?? new PageOperations(),
      overlay: deps?.overlay ?? new OverlayRenderer(),
      text: deps?.text ?? new TextRenderer(),
      image: deps?.image ?? new ImageRenderer(),
      annotations: deps?.annotations ?? new AnnotationFlattener(),
      signatures: deps?.signatures ?? new SignatureRenderer(),
      ocr: deps?.ocr ?? new OcrExporter(),
      metadata: deps?.metadata ?? new MetadataWriter(),
    };
  }

  async run(input: ExportInput): Promise<ExportResult> {
    const doc = input.document;
    const options = resolveOptions(doc, input.options);
    const diagnostics: ExportDiagnostic[] = [];
    const timings: Partial<Record<ExportStage, number>> = {};
    const t0 = nowMs();

    const tick = (stage: ExportStage, progress: number) => {
      options.onProgress?.(progress, stage);
    };
    const timed = async <T>(stage: ExportStage, progress: number, fn: () => Promise<T> | T): Promise<T> => {
      throwIfAborted(options.signal);
      tick(stage, progress);
      const start = nowMs();
      try {
        return await fn();
      } finally {
        timings[stage] = (timings[stage] ?? 0) + (nowMs() - start);
      }
    };

    try {
      // 1. load -----------------------------------------------------------------
      const writer = await timed("load", 0.02, () => PDFWriter.create(input.source));
      if (!writer.hasSource() && input.source == null) {
        diagnostics.push({
          severity: hasSourcePages(doc) ? "warning" : "info",
          code: "MISSING_SOURCE",
          message:
            "No source PDF supplied; original page content cannot be preserved. Added/edited overlay objects still export.",
        });
      }

      // 2. validate -------------------------------------------------------------
      const report = await timed("validate", 0.06, () => this.deps.validation.validate(doc, options.pageRange));
      diagnostics.push(...report.diagnostics);
      if (!report.ok) {
        throw new ExportError("VALIDATION_FAILED", "Document failed pre-export validation.", { stage: "validate" });
      }
      const skip = report.skip;

      // 3. pages ----------------------------------------------------------------
      const targets = await timed("pages", 0.1, () =>
        this.deps.pageOps.buildPages(doc, writer, options.pageRange, diagnostics),
      );

      // 4–9. per-page rendering -------------------------------------------------
      await this.renderPages(doc, writer, targets, skip, options, diagnostics, tick, timings);

      // collect font fallback/glyph diagnostics accumulated during rendering
      diagnostics.push(...writer.fonts.takeDiagnostics());

      // 10. metadata ------------------------------------------------------------
      await timed("metadata", 0.9, () =>
        this.deps.metadata.write(writer, doc.meta, options.metadata, options.deterministic, options.password, diagnostics),
      );

      // 11. optimize + save -----------------------------------------------------
      const bytes = await timed("optimize", 0.95, () => writer.save(options.optimize));

      // 12. verify --------------------------------------------------------------
      await timed("verify", 0.99, () => verifyOutput(bytes, targets.length, diagnostics));

      tick("verify", 1);

      const result: ExportResult = {
        documentId: doc.meta.id,
        fileName: ensurePdfExt(options.fileName),
        bytes,
        blob: makeBlob(bytes),
        byteLength: bytes.byteLength,
        pageCount: targets.length,
        diagnostics,
        timings,
        durationMs: nowMs() - t0,
      };
      return result;
    } catch (err) {
      if (err instanceof ExportCancelled) throw err;
      if (err instanceof ExportError) throw err;
      throw new ExportError("UNKNOWN", errorMessage(err), { cause: err });
    }
  }

  private async renderPages(
    doc: DocumentState,
    writer: PDFWriter,
    targets: RenderTarget[],
    skip: ReadonlySet<string>,
    options: ReturnType<typeof resolveOptions>,
    diagnostics: ExportDiagnostic[],
    tick: (stage: ExportStage, progress: number) => void,
    timings: Partial<Record<ExportStage, number>>,
  ): Promise<void> {
    const total = targets.length;
    const renderStart = nowMs();

    for (let i = 0; i < total; i++) {
      throwIfAborted(options.signal);
      const target = targets[i];
      const ctx: RenderContext = {
        doc: writer.doc,
        page: target.page,
        pageId: target.pageId,
        placement: target.placement,
        writer,
        fonts: writer.fonts,
        options,
        diagnostics,
      };

      const objects = selectPageObjects(doc, target.pageId);

      // whiteout/redaction masks first (under all content)
      this.deps.overlay.render(ctx, objects, skip);

      // content in z-order (the array is already ascending zIndex)
      for (const obj of objects) {
        if (skip.has(obj.id)) continue;
        await this.dispatch(ctx, obj);
      }

      // searchable OCR layer last (invisible by default)
      this.deps.ocr.render(ctx, selectOcrLayer(doc, target.pageId));

      // Progress across the content stages (0.1 → 0.9); label the dominant stage.
      const frac = (i + 1) / total;
      tick("text", 0.1 + 0.8 * frac);
    }
    // Attribute the per-page wall-clock to the content stages collectively.
    timings.text = nowMs() - renderStart;
  }

  private async dispatch(ctx: RenderContext, obj: EditableObject): Promise<void> {
    try {
      if (isTextBlock(obj)) {
        if (obj.source === "added" || obj.source === "original") this.deps.text.draw(ctx, obj);
      } else if (isImageObject(obj)) {
        await this.deps.image.draw(ctx, obj);
      } else if (isAnnotation(obj)) {
        this.deps.annotations.draw(ctx, obj);
      } else if (isSignature(obj)) {
        await this.deps.signatures.draw(ctx, obj);
      }
      // redactions are painted by the overlay stage; nothing to do here.
    } catch (err) {
      // Per-object error recovery: record and continue with the rest of the doc.
      ctx.diagnostics.push({
        severity: "warning",
        code: "RENDER_FAILED",
        message: `Failed to render object ${obj.id} (${obj.kind}): ${errorMessage(err)}; skipped.`,
        pageId: ctx.pageId,
        objectId: obj.id,
      });
    }
  }
}

function hasSourcePages(doc: DocumentState): boolean {
  return doc.pageOrder.some((id) => doc.pages[id]?.sourcePageIndex !== null);
}

async function verifyOutput(bytes: Uint8Array, expectedPages: number, diagnostics: ExportDiagnostic[]): Promise<void> {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const reloaded = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = reloaded.getPageCount();
    if (pages !== expectedPages) {
      diagnostics.push({
        severity: "warning",
        code: "VERIFY_PAGE_MISMATCH",
        message: `Output has ${pages} page(s) but ${expectedPages} were expected.`,
      });
    }
  } catch (err) {
    diagnostics.push({
      severity: "error",
      code: "VERIFY_FAILED",
      message: `The exported PDF failed to re-parse: ${errorMessage(err)}`,
    });
  }
}

function ensurePdfExt(name: string): string {
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
}

function makeBlob(bytes: Uint8Array): Blob | undefined {
  if (typeof Blob === "undefined") return undefined;
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}

function nowMs(): number {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}
