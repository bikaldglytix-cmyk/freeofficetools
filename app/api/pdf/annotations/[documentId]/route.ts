import type { PdfAnnotation } from "@/lib/pdf/annotations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AnnotationBucket {
  revision: number;
  annotations: Map<string, PdfAnnotation>;
}

const buckets = new Map<string, AnnotationBucket>();

type ParamsContext = { params: Promise<{ documentId: string }> };

function bucketFor(documentId: string): AnnotationBucket {
  let bucket = buckets.get(documentId);
  if (!bucket) {
    bucket = { revision: 0, annotations: new Map() };
    buckets.set(documentId, bucket);
  }
  return bucket;
}

function isAnnotation(value: unknown): value is PdfAnnotation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PdfAnnotation>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.documentId === "string" &&
    typeof candidate.pageId === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.author === "string" &&
    typeof candidate.createdAt === "number" &&
    typeof candidate.updatedAt === "number" &&
    !!candidate.bounds &&
    typeof candidate.bounds.x === "number" &&
    typeof candidate.bounds.y === "number" &&
    typeof candidate.bounds.width === "number" &&
    typeof candidate.bounds.height === "number"
  );
}

async function annotationFromBody(request: Request): Promise<PdfAnnotation | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const annotation = (body as { annotation?: unknown }).annotation;
  if (!isAnnotation(annotation)) {
    return Response.json({ error: "A valid annotation payload is required." }, { status: 400 });
  }
  return annotation;
}

export async function GET(_request: Request, context: ParamsContext): Promise<Response> {
  const { documentId } = await context.params;
  const bucket = bucketFor(documentId);
  return Response.json({
    documentId,
    annotations: [...bucket.annotations.values()],
    revision: bucket.revision,
  });
}

export async function POST(request: Request, context: ParamsContext): Promise<Response> {
  const { documentId } = await context.params;
  const annotation = await annotationFromBody(request);
  if (annotation instanceof Response) return annotation;
  if (annotation.documentId !== documentId) {
    return Response.json({ error: "Annotation documentId does not match the route." }, { status: 409 });
  }
  const bucket = bucketFor(documentId);
  bucket.annotations.set(annotation.id, annotation);
  bucket.revision += 1;
  return Response.json({ documentId, annotation, revision: bucket.revision }, { status: 201 });
}

export async function PATCH(request: Request, context: ParamsContext): Promise<Response> {
  const { documentId } = await context.params;
  const annotation = await annotationFromBody(request);
  if (annotation instanceof Response) return annotation;
  const bucket = bucketFor(documentId);
  if (!bucket.annotations.has(annotation.id)) {
    return Response.json({ error: "Annotation not found." }, { status: 404 });
  }
  bucket.annotations.set(annotation.id, annotation);
  bucket.revision += 1;
  return Response.json({ documentId, annotation, revision: bucket.revision });
}

export async function DELETE(request: Request, context: ParamsContext): Promise<Response> {
  const { documentId } = await context.params;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Annotation id is required." }, { status: 400 });
  const bucket = bucketFor(documentId);
  if (!bucket.annotations.delete(id)) {
    return Response.json({ error: "Annotation not found." }, { status: 404 });
  }
  bucket.revision += 1;
  return Response.json({ documentId, deletedId: id, revision: bucket.revision });
}
