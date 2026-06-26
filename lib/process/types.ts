/**
 * Shared conversion interface.
 *
 * Every tool — whether it runs in the browser today or on a server tomorrow —
 * speaks this contract. A processor takes input files plus typed options and
 * resolves to a set of output files. Because the shape is identical, a
 * client-side engine can be swapped for a `fetch('/api/...')` call later
 * without touching any UI, route or URL.
 */

export interface OutputFile {
  /** Suggested download filename, including extension. */
  name: string;
  blob: Blob;
}

export interface ProcessResult {
  outputs: OutputFile[];
  /** Optional extra info for the result screen (e.g. size before/after). */
  meta?: Record<string, unknown>;
}

/** Reports progress as a fraction from 0 to 1. */
export type ProgressReporter = (fraction: number) => void;

export interface ProcessContext {
  onProgress?: ProgressReporter;
  signal?: AbortSignal;
}

/** A processor for a given options shape. */
export type Processor<TOptions> = (
  files: File[],
  options: TOptions,
  ctx?: ProcessContext,
) => Promise<ProcessResult>;
