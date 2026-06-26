/**
 * GET /api/pdf/export/:jobId/download — download a finished export's PDF bytes
 * (Phase 5 §13). 404 if the job is unknown, 409 if it has not succeeded yet, 410
 * if the bytes were already evicted (TTL) or consumed.
 *
 * (The spec's "POST /export/download" maps to this resource-scoped GET, which is
 * cache-friendly and consistent with the other export routes.)
 */
import { dropJobBytes, getJob } from "../../store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, context: ParamsContext): Promise<Response> {
  const { jobId } = await context.params;
  const job = getJob(jobId);
  if (!job) return Response.json({ error: "Unknown export job." }, { status: 404 });
  if (job.status !== "succeeded") {
    return Response.json({ error: `Job is "${job.status}", not ready to download.` }, { status: 409 });
  }
  if (!job.bytes) {
    return Response.json({ error: "Export bytes are no longer available." }, { status: 410 });
  }

  const body = job.bytes;
  // Free the buffer after handing it off (one-shot download keeps memory bounded).
  dropJobBytes(jobId);

  return new Response(body as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(job.fileName)}"`,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
