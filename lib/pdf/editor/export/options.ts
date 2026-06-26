/**
 * Resolve user-facing {@link ExportOptions} into fully-defaulted
 * {@link ResolvedExportOptions} the pipeline can use without `??` everywhere.
 */
import type { DocumentState } from "../model/types";
import type { ExportOptions, ImageExportOptions, ResolvedExportOptions } from "./types";

const DEFAULT_IMAGE: ImageExportOptions = {
  jpegQuality: 0.92,
  maxDimension: 4000,
};

export function resolveOptions(doc: DocumentState, options: ExportOptions = {}): ResolvedExportOptions {
  return {
    fileName: options.fileName ?? doc.meta.fileName ?? "document.pdf",
    flatten: options.flatten ?? "flatten",
    pageRange: options.pageRange && options.pageRange.length ? options.pageRange : null,
    includeOcr: options.includeOcr ?? true,
    ocrVisible: options.ocrVisible ?? false,
    optimize: options.optimize ?? true,
    deterministic: options.deterministic ?? false,
    metadata: options.metadata ?? {},
    image: { ...DEFAULT_IMAGE, ...(options.image ?? {}) },
    password: options.password ?? null,
    signal: options.signal ?? null,
    onProgress: options.onProgress ?? null,
  };
}
