"use client";

/**
 * Bridge hook: loads a `File` into the Phase 1 viewer *and* mirrors it into the
 * Phase 2 document store as a fresh editable document.
 *
 * This is additive — it composes the existing `useViewerDocument` without
 * changing it. Mount it once at the editor root; child components then read
 * editable state via the store hooks (`usePageObjects`, `useUndoRedo`, …) and
 * render the original page bitmap via the viewer as before.
 */
import { useEffect } from "react";
import { buildDocumentFromViewer } from "@/lib/pdf/editor/integration/from-viewer";
import { documentStore } from "@/lib/pdf/editor/store/document-store";
import { useViewerDocument, type UseViewerDocument } from "./use-viewer-document";

export function useEditorDocument(file: File | null): UseViewerDocument {
  const viewer = useViewerDocument(file);

  useEffect(() => {
    // Talking to an external store (not React state), so this is the correct
    // place to sync the viewer's lifecycle into the document model.
    const store = documentStore.getState();
    if (viewer.status === "ready" && viewer.doc) {
      store.loadDocument(
        buildDocumentFromViewer(viewer.doc, { fileName: file?.name }),
      );
    } else if (viewer.status === "idle") {
      store.closeDocument();
    }
  }, [viewer.status, viewer.doc, file]);

  return viewer;
}
