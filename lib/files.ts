import { zip } from "fflate";
import type { OutputFile, ProcessResult } from "@/lib/process/types";

export const MAX_FILE_SIZE_MB = 200;
export const MAX_FILES = 50;

/** Human-readable byte size. */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${units[i]}`;
}

/** Filename without its extension. */
export function baseName(name: string): string {
  return name.replace(/\.[^./\\]+$/, "");
}

/** Make a string safe to use as a download filename. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(0, 120) || "file";
}

export interface ValidationOptions {
  accept: string; // same syntax as <input accept>
  maxSizeMb?: number;
  maxFiles?: number;
  multiple?: boolean;
}

export interface ValidationResult {
  valid: File[];
  error: string | null;
}

/** Validate file type, size and count before any processing. */
export function validateFiles(files: File[], opts: ValidationOptions): ValidationResult {
  const maxSize = (opts.maxSizeMb ?? MAX_FILE_SIZE_MB) * 1024 * 1024;
  const maxFiles = opts.multiple ? opts.maxFiles ?? MAX_FILES : 1;
  const matchers = parseAccept(opts.accept);

  if (files.length === 0) return { valid: [], error: "Please choose at least one file." };

  const valid: File[] = [];
  for (const file of files) {
    if (!matchesAccept(file, matchers)) {
      return { valid: [], error: `"${file.name}" isn't a supported file type.` };
    }
    if (file.size > maxSize) {
      return {
        valid: [],
        error: `"${file.name}" is larger than the ${opts.maxSizeMb ?? MAX_FILE_SIZE_MB} MB limit.`,
      };
    }
    valid.push(file);
  }

  if (valid.length > maxFiles) {
    return { valid: [], error: `Please add no more than ${maxFiles} file${maxFiles > 1 ? "s" : ""}.` };
  }

  return { valid, error: null };
}

interface AcceptMatchers {
  extensions: string[];
  mimeExact: string[];
  mimeWildcard: string[]; // e.g. "image/"
}

function parseAccept(accept: string): AcceptMatchers {
  const parts = accept.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
  const extensions: string[] = [];
  const mimeExact: string[] = [];
  const mimeWildcard: string[] = [];
  for (const p of parts) {
    if (p.startsWith(".")) extensions.push(p);
    else if (p.endsWith("/*")) mimeWildcard.push(p.slice(0, -1));
    else if (p.includes("/")) mimeExact.push(p);
  }
  return { extensions, mimeExact, mimeWildcard };
}

function matchesAccept(file: File, m: AcceptMatchers): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (m.extensions.some((ext) => name.endsWith(ext))) return true;
  if (type && m.mimeExact.includes(type)) return true;
  if (type && m.mimeWildcard.some((w) => type.startsWith(w))) return true;
  // Some browsers report an empty MIME type; fall back to extension only.
  return false;
}

/** Trigger a browser download for a single blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = sanitizeFilename(filename);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after a tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Bundle multiple outputs into a single ZIP blob (stored, not recompressed). */
export async function zipOutputs(outputs: OutputFile[], zipName: string): Promise<OutputFile> {
  const entries: Record<string, Uint8Array> = {};
  for (const out of outputs) {
    const buf = new Uint8Array(await out.blob.arrayBuffer());
    entries[sanitizeFilename(out.name)] = buf;
  }
  // Async zip runs the packaging on fflate's own worker thread, so bundling
  // many or large outputs (e.g. every page of a big PDF→JPG export) never
  // freezes the main thread. `level: 0` = stored, identical bytes to before.
  const zipped = await new Promise<Uint8Array>((resolve, reject) => {
    zip(entries, { level: 0 }, (err, data) => (err ? reject(err) : resolve(data)));
  });
  return {
    name: sanitizeFilename(zipName),
    blob: new Blob([zipped as BlobPart], { type: "application/zip" }),
  };
}

/**
 * Download a result. A single output downloads directly; multiple outputs are
 * zipped first so the user gets one clean file.
 */
export async function downloadResult(result: ProcessResult, zipName = "freeofficetools.zip"): Promise<void> {
  if (result.outputs.length === 0) return;
  if (result.outputs.length === 1) {
    downloadBlob(result.outputs[0].blob, result.outputs[0].name);
    return;
  }
  const zip = await zipOutputs(result.outputs, zipName);
  downloadBlob(zip.blob, zip.name);
}

/** Total byte size of all outputs. */
export function totalSize(result: ProcessResult): number {
  return result.outputs.reduce((sum, o) => sum + o.blob.size, 0);
}
