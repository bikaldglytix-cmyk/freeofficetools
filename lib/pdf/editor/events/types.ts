/**
 * The editor's event vocabulary. This map is the contract every subscriber
 * (viewer, annotation layer, OCR pipeline, autosave, export, future collab)
 * programs against. Add events here, not as ad-hoc strings.
 */
import type {
  DocumentId,
  ObjectId,
  ObjectKind,
  PageId,
  RevisionId,
} from "../model/types";
import type { EditOperation } from "../operations/types";
import type { Patch } from "../patch/types";
import { TypedEventBus } from "./bus";

export interface EditorEventMap extends Record<string, unknown> {
  // --- Document lifecycle ---------------------------------------------------
  DOCUMENT_LOADED: { documentId: DocumentId };
  DOCUMENT_CLOSED: { documentId: DocumentId };
  /** Fired after any patch is applied (dispatch, undo or redo). */
  DOCUMENT_CHANGED: { patch: Patch; cause: "dispatch" | "undo" | "redo" };
  OPERATION_DISPATCHED: { operation: EditOperation; patch: Patch };

  // --- Granular object/page events (derived from patch changes) -------------
  OBJECT_ADDED: { pageId: PageId; id: ObjectId; kind: ObjectKind };
  OBJECT_UPDATED: { pageId: PageId; id: ObjectId; kind: ObjectKind };
  OBJECT_REMOVED: { pageId: PageId; id: ObjectId; kind: ObjectKind };
  TEXT_UPDATED: { pageId: PageId; id: ObjectId };
  IMAGE_MOVED: { pageId: PageId; id: ObjectId };
  ANNOTATION_CREATED: { pageId: PageId; id: ObjectId };
  PAGE_ADDED: { pageId: PageId; index: number };
  PAGE_REMOVED: { pageId: PageId; index: number };
  PAGE_MOVED: { pageId: PageId; from: number; to: number };
  OCR_APPLIED: { pageId: PageId };

  // --- History --------------------------------------------------------------
  UNDO: { patch: Patch };
  REDO: { patch: Patch };
  HISTORY_CHANGED: {
    canUndo: boolean;
    canRedo: boolean;
    undoSize: number;
    redoSize: number;
  };

  // --- Selection ------------------------------------------------------------
  SELECTION_CHANGED: { pageId: PageId | null; ids: ObjectId[] };

  // --- Persistence ----------------------------------------------------------
  PERSIST_SAVED: { draftId: string; savedAt: number };
  PERSIST_RESTORED: { draftId: string };
  REVISION_CREATED: { revisionId: RevisionId };

  // --- Export (Phase 5) -----------------------------------------------------
  EXPORT_STARTED: { documentId: DocumentId };
  EXPORT_FINISHED: { documentId: DocumentId; byteLength?: number };
  EXPORT_FAILED: { documentId: DocumentId; error: string };
}

export type EditorEventBus = TypedEventBus<EditorEventMap>;

export function createEditorEventBus(): EditorEventBus {
  return new TypedEventBus<EditorEventMap>();
}
