import type { ExtractedTextPage, TextExportInstruction } from "./types";

export interface TextPersistencePayload {
  documentId: string;
  pageId: string;
  objects: unknown[];
  exportInstructions: TextExportInstruction[];
}

export const textApi = {
  async extract(documentId: string, pageId: string): Promise<ExtractedTextPage | null> {
    const res = await fetch(`/api/pdf/text/${encodeURIComponent(documentId)}?pageId=${encodeURIComponent(pageId)}`, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<ExtractedTextPage>;
  },
  async persist(payload: TextPersistencePayload): Promise<{ documentId: string; revision: number }> {
    const res = await fetch(`/api/pdf/text/${encodeURIComponent(payload.documentId)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ documentId: string; revision: number }>;
  },
  async revisions(documentId: string): Promise<Array<{ id: string; timestamp: number }>> {
    const res = await fetch(`/api/pdf/text/${encodeURIComponent(documentId)}/revisions`, { cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<Array<{ id: string; timestamp: number }>>;
  },
  async correctOcr(documentId: string, pageId: string, wordId: string, text: string): Promise<{ documentId: string; pageId: string; wordId: string; text: string }> {
    const res = await fetch(`/api/pdf/ocr/${encodeURIComponent(documentId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pageId, wordId, text }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ documentId: string; pageId: string; wordId: string; text: string }>;
  },
};
