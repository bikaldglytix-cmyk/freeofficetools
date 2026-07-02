/**
 * Export Engine — public type surface (Phase 5).
 *
 * The Export Engine turns the canonical {@link DocumentState} (Phase 2) plus the
 * original source PDF bytes into a final, downloadable PDF. It consumes the model
 * — never the DOM or UI state — so it is identically usable from the browser, a
 * Web Worker, a Node test, or a route handler.
 *
 * COORDINATES: the model stores geometry in *PDF points, top-left origin* (see
 * `model/types.ts`). pdf-lib draws in *PDF points, bottom-left origin*, on the
 * page's UNROTATED media box. `geometry.ts` is the single place that reconciles
 * the two (Y-flip + page-rotation mapping); every renderer goes through it.
 */
import type { DocumentId, DocumentState, PageId } from "../model/types";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * How annotations/signatures are written into the output.
 *  - `flatten` (default): paint appearances directly onto page content. Result is
 *    universally viewable and tamper-evident-free, but no longer interactive.
 *  - `keep`: best-effort interactive annotations where pdf-lib can express them
 *    (notes, highlights), falling back to flatten for shapes/ink it cannot.
 *  - `discard`: drop annotations entirely (e.g. a "clean" print copy).
 */
export type FlattenStrategy = "flatten" | "keep" | "discard";

/** Quality knobs for raster (image) handling. */
export interface ImageExportOptions {
  /** JPEG re-encode quality (0..1) when transcoding non-PNG/JPEG inputs. */
  jpegQuality: number;
  /**
   * Max embedded pixel dimension. Images larger than this on either axis are
   * downscaled before embedding to keep output size and memory bounded. 0 = off.
   */
  maxDimension: number;
}

export interface MetadataOverrides {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  /** Preserve the source file's creation date instead of stamping now. */
  preserveCreationDate?: boolean;
}

export interface ExportOptions {
  /** Output file name; defaults to the document's `meta.fileName`. */
  fileName?: string;
  /** Annotation/signature handling. Default: "flatten". */
  flatten?: FlattenStrategy;
  /** Restrict output to these page ids, in this order. Default: full pageOrder. */
  pageRange?: PageId[];
  /** Write a searchable (default invisible) OCR text layer. Default: true. */
  includeOcr?: boolean;
  /** Render OCR text visibly (debugging / accessibility). Default: false. */
  ocrVisible?: boolean;
  /** pdf-lib object streams + de-duplication. Default: true. */
  optimize?: boolean;
  /** Metadata to write; missing fields fall back to the source/document. */
  metadata?: MetadataOverrides;
  image?: Partial<ImageExportOptions>;
  /**
   * Owner/user password. NOTE: pdf-lib (the only free pure-JS writer here)
   * cannot write encrypted PDFs — requesting this raises a diagnostic and the
   * output is written unencrypted. See `metadata-writer.ts` for the rationale.
   */
  password?: string;
  /**
   * Deterministic mode for regression tests: fixed timestamps + no entropy in
   * metadata, so byte output is reproducible for identical input.
   */
  deterministic?: boolean;
  /** Abort signal for cancellation (manager wires this from job.cancel()). */
  signal?: AbortSignal;
  /** Progress callback (0..1) with a human-readable stage label. */
  onProgress?: (progress: number, stage: ExportStage) => void;
}

/** Fully-resolved options (after defaults) used internally by the pipeline. */
export interface ResolvedExportOptions
  extends Required<Omit<ExportOptions, "metadata" | "image" | "pageRange" | "password" | "signal" | "onProgress">> {
  metadata: MetadataOverrides;
  image: ImageExportOptions;
  pageRange: PageId[] | null;
  password: string | null;
  signal: AbortSignal | null;
  onProgress: ((progress: number, stage: ExportStage) => void) | null;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface ExportInput {
  /** The canonical document to export. */
  document: DocumentState;
  /**
   * Original PDF bytes. Required to copy/preserve original page content (text,
   * vectors, images, fonts). If omitted, original pages are rendered as blank
   * pages sized to the model and a diagnostic is raised — added objects still
   * export. (Privacy model: bytes stay in-process; nothing is uploaded.)
   */
  source?: ArrayBuffer | Uint8Array | null;
  options?: ExportOptions;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export type DiagnosticSeverity = "info" | "warning" | "error";

export interface ExportDiagnostic {
  severity: DiagnosticSeverity;
  /** Stable machine code, e.g. "MISSING_SOURCE", "FONT_FALLBACK". */
  code: string;
  message: string;
  pageId?: PageId;
  objectId?: string;
  detail?: Record<string, unknown>;
}

export const STAGES = [
  "load",
  "validate",
  "pages",
  "fonts",
  "whiteout",
  "text",
  "images",
  "annotations",
  "signatures",
  "drawings",
  "ocr",
  "metadata",
  "optimize",
  "verify",
] as const;

export type ExportStage = (typeof STAGES)[number];

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface ExportResult {
  documentId: DocumentId;
  fileName: string;
  bytes: Uint8Array;
  /** Browser-only convenience; undefined in pure Node runs without Blob. */
  blob?: Blob;
  byteLength: number;
  pageCount: number;
  diagnostics: ExportDiagnostic[];
  /** Per-stage wall-clock timings (ms). */
  timings: Partial<Record<ExportStage, number>>;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Jobs (async export — see manager.ts)
// ---------------------------------------------------------------------------

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface ExportJob {
  id: string;
  documentId: DocumentId;
  status: JobStatus;
  progress: number;
  stage: ExportStage | null;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  result?: ExportResult;
  error?: string;
  diagnostics: ExportDiagnostic[];
}
