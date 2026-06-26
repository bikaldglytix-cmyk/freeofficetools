/**
 * Export endpoints (Phase 5 §13).
 *
 *   POST /api/pdf/export    — create + run an export job.
 *                             Body: { document, sourceBase64?, options?, async? }
 *                             Sync (default): 200 { job } once finished.
 *                             async:true:     202 { job } immediately; poll status.
 *   GET  /api/pdf/export    — list export jobs (history), newest first.
 *
 * The heavy PDF work uses the same environment-agnostic `ExportPipeline` as the
 * browser; in Node, PNG/JPEG embed natively while canvas-only transcodes
 * (WEBP→JPEG) are unavailable and surface as diagnostics. See `store.ts` for the
 * privacy rationale (client-side export is the default; this is opt-in upload).
 */
import { ExportPipeline, errorMessage, type ExportInput } from "@/lib/pdf/editor/export";
import type { DocumentState } from "@/lib/pdf/editor";
import { base64ToBytes, createJob, isExportRequest, listJobs, summarizeJob } from "./store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pipeline = new ExportPipeline();

export async function GET(): Promise<Response> {
  return Response.json({ jobs: listJobs() });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  if (!isExportRequest(body)) {
    return Response.json({ error: "A valid export request { document, ... } is required." }, { status: 400 });
  }

  const document = body.document as DocumentState;
  const source = body.sourceBase64 ? base64ToBytes(body.sourceBase64) : null;
  const id = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const fileName =
    (body.options?.fileName as string | undefined) ?? document.meta.fileName ?? "document.pdf";
  const job = createJob(id, document.meta.id, fileName);

  const input: ExportInput = {
    document,
    source,
    options: {
      ...(body.options ?? {}),
      onProgress: (progress, stage) => {
        job.progress = progress;
        job.stage = stage;
      },
    },
  };

  const runner = async () => {
    job.status = "running";
    try {
      const result = await pipeline.run(input);
      job.status = "succeeded";
      job.progress = 1;
      job.stage = "verify";
      job.byteLength = result.byteLength;
      job.diagnostics = result.diagnostics;
      job.bytes = result.bytes;
      job.fileName = result.fileName;
      job.finishedAt = Date.now();
    } catch (err) {
      job.status = "failed";
      job.error = errorMessage(err);
      job.finishedAt = Date.now();
    }
  };

  if (body.async) {
    void runner();
    return Response.json({ job: summarizeJob(job) }, { status: 202 });
  }

  await runner();
  const status = job.status === "succeeded" ? 200 : 500;
  return Response.json({ job: summarizeJob(job) }, { status });
}
