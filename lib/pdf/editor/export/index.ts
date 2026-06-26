/**
 * Public entry point for the Export Engine (Phase 5).
 *
 * Import from `@/lib/pdf/editor/export`. The engine consumes the canonical
 * {@link DocumentState} from the State Engine (Phase 2) plus the original source
 * PDF bytes, and produces a downloadable PDF that integrates edited text,
 * whiteout/restamp, images, annotations (Phase 3), signatures, drawings, OCR
 * (Phase 4), page operations and metadata.
 *
 * Quick start:
 *   import { ExportManager } from "@/lib/pdf/editor/export";
 *   const mgr = new ExportManager({ events: store.getState().events });
 *   const result = await mgr.exportNow({ document, source: originalBytes });
 *   triggerDownload(result);
 *
 * Or off the main thread:
 *   import { createWorkerExporter } from "@/lib/pdf/editor/export";
 *   const result = await createWorkerExporter().run({ document, source }, { onProgress });
 */

// --- Orchestration ----------------------------------------------------------
export { ExportManager, getExportManager } from "./manager";
export type { ExportManagerOptions } from "./manager";
export { ExportPipeline } from "./pipeline";
export type { PipelineDeps } from "./pipeline";

// --- Services (modular; injectable into the pipeline) -----------------------
export { PDFWriter } from "./pdf-writer";
export type { RenderContext, EmbeddedImage } from "./pdf-writer";
export { ValidationService } from "./validation";
export type { ValidationReport } from "./validation";
export { PageOperations } from "./page-operations";
export type { RenderTarget } from "./page-operations";
export { OverlayRenderer, whiteoutRects } from "./overlay-renderer";
export { TextRenderer } from "./text-renderer";
export { ImageRenderer } from "./image-renderer";
export { AnnotationFlattener } from "./annotation-flattener";
export { SignatureRenderer } from "./signature-renderer";
export { OcrExporter } from "./ocr-export";
export { MetadataWriter } from "./metadata-writer";
export { FontManager } from "./fonts";
export type { ResolvedFont, FontRequest } from "./fonts";

// --- Geometry / color (reusable primitives) ---------------------------------
export {
  placementFor,
  mapPoint,
  placeBox,
  placeBaseline,
  mapPolyline,
  rectIntersectsPage,
} from "./geometry";
export type { PagePlacement, PlacedBox, PdfPoint } from "./geometry";
export { parseColor, toRgb, FALLBACK_RGB } from "./color";
export type { ParsedColor } from "./color";

// --- Options ----------------------------------------------------------------
export { resolveOptions } from "./options";

// --- Worker / integration ---------------------------------------------------
export { createWorkerExporter, workerSupported } from "./worker-client";
export type { WorkerExporter, WorkerRunOptions } from "./worker-client";
export { exportCurrentDocument, exportAndDownload, triggerDownload } from "./integration";

// --- Errors -----------------------------------------------------------------
export { ExportError, ExportCancelled, throwIfAborted, errorMessage } from "./errors";
export type { ExportErrorCode } from "./errors";

// --- Types ------------------------------------------------------------------
export type {
  ExportInput,
  ExportOptions,
  ResolvedExportOptions,
  ExportResult,
  ExportJob,
  JobStatus,
  ExportStage,
  ExportDiagnostic,
  DiagnosticSeverity,
  FlattenStrategy,
  ImageExportOptions,
  MetadataOverrides,
} from "./types";
export { STAGES } from "./types";
