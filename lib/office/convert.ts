/**
 * convertDocument — the single, location-agnostic entry point for Office
 * conversions. The UI calls this and never learns whether the work ran in the
 * browser or on a server, so the processing engine can change later with no
 * change to any component or URL.
 *
 * High-fidelity Office <-> PDF conversion needs a server engine (LibreOffice-
 * class). Two transport modes, chosen by env:
 *   - Direct (NEXT_PUBLIC_OFFICE_BACKEND_URL set): the browser POSTs straight to
 *     the backend. Used in production to avoid the host's request-body limit
 *     (e.g. Vercel's ~4.5 MB). The backend authorizes by CORS Origin.
 *   - Proxy (default): the browser POSTs to the same-origin /api/office/convert
 *     route, which forwards to OFFICE_BACKEND_URL (server-only) with a token.
 * Either way the UI and URLs are identical. The UI is gated by
 * isOfficeConvertEnabled() until a backend is connected.
 */
import type { ProcessResult, ProcessContext } from "@/lib/process/types";
import { baseName, sanitizeFilename } from "@/lib/files";
import type { DocumentEngine } from "@/lib/office/tools";

const OUTPUT_EXT: Record<DocumentEngine, string> = {
  "word-to-pdf": "pdf",
  "pdf-to-word": "docx",
  "excel-to-pdf": "pdf",
  "pdf-to-excel": "xlsx",
  "powerpoint-to-pdf": "pdf",
  "pdf-to-powerpoint": "pptx",
};

const OUTPUT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

/** Whether the conversion backend is connected for this deployment (client-visible flag). */
export function isOfficeConvertEnabled(): boolean {
  return process.env.NEXT_PUBLIC_OFFICE_CONVERT_ENABLED === "1";
}

/**
 * Whether a specific engine can actually run.
 *
 * Office→PDF works on the LibreOffice backend. The reverse (PDF→Office) does
 * NOT — LibreOffice imports PDFs into Draw, which has no .docx/.xlsx/.pptx
 * export path, so those conversions fail. They stay gated behind a separate
 * flag until a dedicated PDF→Office engine (e.g. pdf2docx) is wired up, so the
 * UI shows an honest "coming soon" instead of a 502.
 */
export function isEngineReady(engine: DocumentEngine): boolean {
  if (!isOfficeConvertEnabled()) return false;
  if (!engine.startsWith("pdf-to-")) return true;
  return process.env.NEXT_PUBLIC_OFFICE_REVERSE_ENABLED === "1";
}

/** Safe default upload cap (MB) for same-origin proxy mode — stays under a
 *  serverless host's request-body limit (e.g. Vercel's ~4.5 MB). */
const PROXY_UPLOAD_CAP_MB = 4;

/**
 * The effective per-file upload limit (MB) for the current transport — used to
 * validate *before* uploading so a too-large file gives an instant, friendly
 * message instead of a raw 413 from the host or backend.
 *
 *  - Direct-to-backend (NEXT_PUBLIC_OFFICE_BACKEND_URL set): the browser uploads
 *    straight to the backend, so the tool's full limit applies.
 *  - Same-origin proxy (default): capped to stay under the host's request-body
 *    limit, unless overridden.
 *
 * NEXT_PUBLIC_OFFICE_MAX_UPLOAD_MB overrides both, so the client limit can be
 * aligned with whatever the connected backend actually accepts.
 */
export function officeUploadLimitMb(toolMaxMb: number): number {
  const explicit = Number(process.env.NEXT_PUBLIC_OFFICE_MAX_UPLOAD_MB);
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(toolMaxMb, explicit);

  const direct = process.env.NEXT_PUBLIC_OFFICE_BACKEND_URL?.trim();
  if (direct) return toolMaxMb;

  return Math.min(toolMaxMb, PROXY_UPLOAD_CAP_MB);
}

export async function convertDocument(
  engine: DocumentEngine,
  files: File[],
  ctx: ProcessContext = {},
): Promise<ProcessResult> {
  const file = files[0];
  if (!file) throw new Error("Please add a file first.");

  const form = new FormData();
  form.append("engine", engine);
  form.append("file", file);

  // Direct-to-backend in production (bypasses the host's request-body limit);
  // otherwise the same-origin proxy. Same contract for both.
  const directUrl = process.env.NEXT_PUBLIC_OFFICE_BACKEND_URL?.trim();
  const endpoint = directUrl ? `${directUrl.replace(/\/$/, "")}/convert` : "/api/office/convert";

  let res: Response;
  try {
    res = await fetch(endpoint, { method: "POST", body: form, signal: ctx.signal });
  } catch {
    throw new Error("Couldn't reach the conversion service. Please check your connection and try again.");
  }

  if (res.status === 501) {
    throw new Error("Server-side conversion isn't enabled in this deployment yet.");
  }
  if (res.status === 413) {
    throw new Error("This file is too large to convert. Please try a smaller file.");
  }
  if (!res.ok) {
    throw new Error("This file couldn't be converted. It may be corrupted or in an unsupported format.");
  }

  const ext = OUTPUT_EXT[engine];
  const blob = new Blob([await res.arrayBuffer()], { type: OUTPUT_MIME[ext] });
  const suggested = res.headers.get("X-Filename");
  const name = suggested && suggested.length ? suggested : `${sanitizeFilename(baseName(file.name))}.${ext}`;
  return { outputs: [{ name, blob }] };
}
