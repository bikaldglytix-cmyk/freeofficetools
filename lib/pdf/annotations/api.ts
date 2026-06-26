import type { PdfAnnotation } from "./types";

export interface AnnotationListResponse {
  documentId: string;
  annotations: PdfAnnotation[];
  revision: number;
}

export interface AnnotationMutationResponse {
  documentId: string;
  annotation: PdfAnnotation;
  revision: number;
}

export const annotationApi = {
  async load(documentId: string): Promise<AnnotationListResponse> {
    const res = await fetch(`/api/pdf/annotations/${encodeURIComponent(documentId)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<AnnotationListResponse>;
  },
  async save(documentId: string, annotation: PdfAnnotation): Promise<AnnotationMutationResponse> {
    const res = await fetch(`/api/pdf/annotations/${encodeURIComponent(documentId)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ annotation }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<AnnotationMutationResponse>;
  },
  async update(documentId: string, annotation: PdfAnnotation): Promise<AnnotationMutationResponse> {
    const res = await fetch(`/api/pdf/annotations/${encodeURIComponent(documentId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ annotation }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<AnnotationMutationResponse>;
  },
  async delete(documentId: string, annotationId: string): Promise<{ documentId: string; deletedId: string; revision: number }> {
    const res = await fetch(`/api/pdf/annotations/${encodeURIComponent(documentId)}?id=${encodeURIComponent(annotationId)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ documentId: string; deletedId: string; revision: number }>;
  },
};
