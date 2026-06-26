/**
 * GET /api/pdf/export/:jobId — export job status (Phase 5 §13).
 * Returns the job summary (status, progress, stage, diagnostics) without bytes.
 * Poll this after a `POST { async: true }` until `status` is terminal.
 */
import { getJob, summarizeJob } from "../store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, context: ParamsContext): Promise<Response> {
  const { jobId } = await context.params;
  const job = getJob(jobId);
  if (!job) return Response.json({ error: "Unknown export job." }, { status: 404 });
  return Response.json({ job: summarizeJob(job) });
}
