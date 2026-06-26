import { bucketFor, deleteTextBucket, isTextPayload, readTextBucket } from "../store";

/**
 * Text-edit persistence endpoint (Phase 4 §16), mirroring the annotations route.
 *
 * Text *extraction* is inherently client-side (PDF.js needs the source bytes in
 * the browser), so GET only returns a snapshot the client previously persisted;
 * a 404 tells the client to extract locally.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = { params: Promise<{ documentId: string }> };

export async function GET(request: Request, context: ParamsContext): Promise<Response> {
  const { documentId } = await context.params;
  const pageId = new URL(request.url).searchParams.get("pageId");
  const page = pageId ? readTextBucket(documentId)?.pages.get(pageId) : undefined;
  if (!page) {
    return Response.json({ error: "No server-side text snapshot for this page." }, { status: 404 });
  }
  return Response.json(page);
}

export async function POST(request: Request, context: ParamsContext): Promise<Response> {
  const { documentId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  if (!isTextPayload(body)) {
    return Response.json({ error: "A valid text persistence payload is required." }, { status: 400 });
  }
  if (body.documentId !== documentId) {
    return Response.json({ error: "Payload documentId does not match the route." }, { status: 409 });
  }
  const bucket = bucketFor(documentId);
  bucket.pages.set(body.pageId, body);
  bucket.revision += 1;
  bucket.revisions.push({ id: `rev_${bucket.revision}`, timestamp: Date.now(), pageId: body.pageId });
  return Response.json({ documentId, revision: bucket.revision }, { status: 201 });
}

export async function DELETE(request: Request, context: ParamsContext): Promise<Response> {
  const { documentId } = await context.params;
  const pageId = new URL(request.url).searchParams.get("pageId") ?? undefined;
  const removed = deleteTextBucket(documentId, pageId);
  if (!removed) return Response.json({ error: "Nothing to delete." }, { status: 404 });
  return Response.json({ documentId, pageId: pageId ?? null });
}
