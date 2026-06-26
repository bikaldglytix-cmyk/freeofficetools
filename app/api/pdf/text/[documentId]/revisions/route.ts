import { readTextBucket } from "../../store";

/** Revision history for a document's persisted text edits (Phase 4 §16). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = { params: Promise<{ documentId: string }> };

export async function GET(_request: Request, context: ParamsContext): Promise<Response> {
  const { documentId } = await context.params;
  const bucket = readTextBucket(documentId);
  return Response.json(bucket ? bucket.revisions : []);
}
