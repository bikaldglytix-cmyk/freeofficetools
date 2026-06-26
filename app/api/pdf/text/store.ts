import type { TextExportInstruction } from "@/lib/pdf/text/types";

/**
 * Shared in-memory store for the Phase 4 text-edit persistence routes.
 *
 * Colocated (not a `route.ts`) so both `[documentId]/route.ts` and
 * `[documentId]/revisions/route.ts` import the *same* module instance and see
 * one bucket map. Per-process and ephemeral — the real persistence is the
 * client-side IndexedDB draft store from Phase 2; this only backs the optional
 * server sync in `lib/pdf/text/api.ts`.
 */

export interface TextPersistencePayload {
  documentId: string;
  pageId: string;
  objects: unknown[];
  exportInstructions: TextExportInstruction[];
}

export interface TextRevision {
  id: string;
  timestamp: number;
  pageId: string;
}

export interface TextBucket {
  revision: number;
  pages: Map<string, TextPersistencePayload>;
  revisions: TextRevision[];
}

const buckets = new Map<string, TextBucket>();

export function bucketFor(documentId: string): TextBucket {
  let bucket = buckets.get(documentId);
  if (!bucket) {
    bucket = { revision: 0, pages: new Map(), revisions: [] };
    buckets.set(documentId, bucket);
  }
  return bucket;
}

export function readTextBucket(documentId: string): TextBucket | undefined {
  return buckets.get(documentId);
}

export function deleteTextBucket(documentId: string, pageId?: string): boolean {
  const bucket = buckets.get(documentId);
  if (!bucket) return false;
  if (pageId) return bucket.pages.delete(pageId);
  return buckets.delete(documentId);
}

export function isTextPayload(value: unknown): value is TextPersistencePayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TextPersistencePayload>;
  return (
    typeof candidate.documentId === "string" &&
    typeof candidate.pageId === "string" &&
    Array.isArray(candidate.objects) &&
    Array.isArray(candidate.exportInstructions)
  );
}
