/**
 * OCR correction endpoint (Phase 4 §10/§16). In-memory and per-process; the
 * authoritative OCR layer and corrections live in the client document store.
 * Consumed by `lib/pdf/text/api.ts#correctOcr`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OcrCorrection {
  pageId: string;
  wordId: string;
  text: string;
}

interface OcrBucket {
  revision: number;
  corrections: Map<string, OcrCorrection>;
}

const buckets = new Map<string, OcrBucket>();

function bucketFor(documentId: string): OcrBucket {
  let bucket = buckets.get(documentId);
  if (!bucket) {
    bucket = { revision: 0, corrections: new Map() };
    buckets.set(documentId, bucket);
  }
  return bucket;
}

type ParamsContext = { params: Promise<{ documentId: string }> };

function isCorrection(value: unknown): value is OcrCorrection {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OcrCorrection>;
  return (
    typeof candidate.pageId === "string" &&
    typeof candidate.wordId === "string" &&
    typeof candidate.text === "string"
  );
}

export async function PATCH(request: Request, context: ParamsContext): Promise<Response> {
  const { documentId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  if (!isCorrection(body)) {
    return Response.json({ error: "A valid OCR correction { pageId, wordId, text } is required." }, { status: 400 });
  }
  const bucket = bucketFor(documentId);
  bucket.corrections.set(`${body.pageId}:${body.wordId}`, body);
  bucket.revision += 1;
  return Response.json({ documentId, pageId: body.pageId, wordId: body.wordId, text: body.text });
}

export async function GET(_request: Request, context: ParamsContext): Promise<Response> {
  const { documentId } = await context.params;
  const bucket = buckets.get(documentId);
  return Response.json({
    documentId,
    corrections: bucket ? [...bucket.corrections.values()] : [],
    revision: bucket?.revision ?? 0,
  });
}
