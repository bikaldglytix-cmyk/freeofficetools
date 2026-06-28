"use client";

import { ops } from "@/lib/pdf/editor/operations/types";
import { documentStore } from "@/lib/pdf/editor/store/document-store";

export interface ImageSpec {
  /** Data URL (kept inline so everything stays client-side). */
  src: string;
  mimeType: string;
  naturalWidth: number;
  naturalHeight: number;
}

/** Read a picked file into a data URL + decoded dimensions (browser only). */
export function fileToImageSpec(file: File): Promise<ImageSpec> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that image file."));
    reader.onload = () => {
      const src = String(reader.result);
      const img = new window.Image();
      img.onload = () =>
        resolve({
          src,
          mimeType: file.type || "image/png",
          naturalWidth: img.naturalWidth || 1,
          naturalHeight: img.naturalHeight || 1,
        });
      img.onerror = () => reject(new Error("That image couldn't be decoded."));
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

/** The id of the single selected image on the active page, or null. */
export function selectedImageId(): { pageId: string; id: string } | null {
  const state = documentStore.getState();
  const pageId = state.selection.pageId;
  if (!pageId || !state.document || state.selection.ids.length !== 1) return null;
  const id = state.selection.ids[0];
  return state.document.objectsByPage[pageId]?.[id]?.kind === "image" ? { pageId, id } : null;
}

/** Swap the bitmap of the selected image, keeping its position and box. */
export function replaceSelectedImage(spec: ImageSpec): void {
  const target = selectedImageId();
  if (!target) return;
  documentStore.getState().dispatch(
    ops.updateImage(target.pageId, target.id, {
      src: spec.src,
      mimeType: spec.mimeType,
      naturalWidth: spec.naturalWidth,
      naturalHeight: spec.naturalHeight,
    }),
  );
}
