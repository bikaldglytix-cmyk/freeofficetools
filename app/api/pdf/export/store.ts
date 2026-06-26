/**
 * In-memory export job registry shared by the export route handlers.
 *
 * ARCHITECTURE NOTE: this product is privacy-first and exports run CLIENT-SIDE by
 * default (see `lib/pdf/editor/export` — the bytes never leave the device). These
 * endpoints exist for explicit server-side / batch / automation use, where the
 * caller chooses to upload the document model + source bytes. The job store is a
 * process-local Map: simple, dependency-free, and sufficient for single-instance
 * deployments. For multi-instance/serverless, back this with Redis/Blob storage —
 * the surface (`createJob`/`getJob`/`listJobs`) is the only seam to change.
 *
 * Jobs are evicted after TTL to bound memory; the stored PDF bytes dominate size.
 */
import type { ExportDiagnostic, ExportStage, JobStatus } from "@/lib/pdf/editor/export";

export interface ServerExportJob {
  id: string;
  documentId: string;
  fileName: string;
  status: JobStatus;
  progress: number;
  stage: ExportStage | null;
  createdAt: number;
  finishedAt?: number;
  byteLength?: number;
  diagnostics: ExportDiagnostic[];
  error?: string;
  /** Result bytes, held until downloaded or evicted. */
  bytes?: Uint8Array;
}

const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_JOBS = 200;

const jobs = new Map<string, ServerExportJob>();

export function createJob(id: string, documentId: string, fileName: string): ServerExportJob {
  evict();
  const job: ServerExportJob = {
    id,
    documentId,
    fileName,
    status: "queued",
    progress: 0,
    stage: null,
    createdAt: Date.now(),
    diagnostics: [],
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): ServerExportJob | undefined {
  return jobs.get(id);
}

export type JobSummary = Omit<ServerExportJob, "bytes">;

/** A job view safe to serialize to clients (omits the raw PDF bytes). */
export function summarizeJob(job: ServerExportJob): JobSummary {
  const copy: ServerExportJob = { ...job };
  delete copy.bytes;
  return copy;
}

export function listJobs(): JobSummary[] {
  return [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt).map(summarizeJob);
}

export function dropJobBytes(id: string): void {
  const job = jobs.get(id);
  if (job) job.bytes = undefined;
}

function evict(): void {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) jobs.delete(id);
  }
  if (jobs.size <= MAX_JOBS) return;
  const oldest = [...jobs.values()].sort((a, b) => a.createdAt - b.createdAt);
  for (const job of oldest.slice(0, jobs.size - MAX_JOBS)) jobs.delete(job.id);
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

export interface ExportRequestBody {
  /** Canonical DocumentState (plain JSON). */
  document: unknown;
  /** Base64-encoded original PDF bytes (optional). */
  sourceBase64?: string | null;
  /** ExportOptions minus runtime-only fields (signal/onProgress). */
  options?: Record<string, unknown>;
  /** When true, return 202 + jobId immediately and process in the background. */
  async?: boolean;
}

export function isExportRequest(body: unknown): body is ExportRequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (!b.document || typeof b.document !== "object") return false;
  const doc = b.document as Record<string, unknown>;
  if (!doc.meta || !Array.isArray(doc.pageOrder)) return false;
  if (b.sourceBase64 != null && typeof b.sourceBase64 !== "string") return false;
  return true;
}

export function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}
