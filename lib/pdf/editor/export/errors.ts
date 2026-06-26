/**
 * Structured export errors. The pipeline distinguishes *fatal* errors (abort the
 * export) from *recoverable* ones (record a diagnostic, skip the offending
 * object, keep going) — see `ExportError.recoverable`. The manager surfaces the
 * `code` so UIs can map errors to friendly copy without string matching.
 */
import type { ExportDiagnostic, ExportStage } from "./types";

export type ExportErrorCode =
  | "MISSING_SOURCE"
  | "INVALID_STATE"
  | "NO_PAGES"
  | "SOURCE_LOAD_FAILED"
  | "PAGE_COPY_FAILED"
  | "IMAGE_DECODE_FAILED"
  | "FONT_EMBED_FAILED"
  | "RENDER_FAILED"
  | "VALIDATION_FAILED"
  | "CANCELLED"
  | "SAVE_FAILED"
  | "UNKNOWN";

export class ExportError extends Error {
  readonly code: ExportErrorCode;
  readonly stage?: ExportStage;
  readonly recoverable: boolean;
  readonly cause?: unknown;

  constructor(
    code: ExportErrorCode,
    message: string,
    opts: { stage?: ExportStage; recoverable?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "ExportError";
    this.code = code;
    this.stage = opts.stage;
    this.recoverable = opts.recoverable ?? false;
    this.cause = opts.cause;
  }

  toDiagnostic(): ExportDiagnostic {
    return {
      severity: this.recoverable ? "warning" : "error",
      code: this.code,
      message: this.message,
      detail: this.stage ? { stage: this.stage } : undefined,
    };
  }
}

/** Thrown when an AbortSignal fires mid-export. */
export class ExportCancelled extends ExportError {
  constructor() {
    super("CANCELLED", "Export was cancelled.", { recoverable: false });
    this.name = "ExportCancelled";
  }
}

/** Throw if the signal is aborted; cheap to call at stage boundaries. */
export function throwIfAborted(signal: AbortSignal | null | undefined): void {
  if (signal?.aborted) throw new ExportCancelled();
}

/** Narrow an unknown thrown value to a readable message. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
