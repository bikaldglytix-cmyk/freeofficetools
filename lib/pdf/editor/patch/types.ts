/**
 * Patch model.
 *
 * A `Patch` is the serialized, invertible effect of one (or a grouped set of)
 * edit operations. It is the single currency for three subsystems:
 *
 *   - **Undo/redo** — the history stores patches; undo = apply the inverse.
 *   - **Persistence/revisions** — a revision is a base snapshot + a patch log.
 *   - **Export (Phase 5)** — the export engine walks `changes` to know exactly
 *     what differs from the original PDF (added text, redactions, moved pages…).
 *
 * Every `Change` carries enough state (`before`/`after`, full removed objects)
 * to be inverted without consulting the live document, which is what makes
 * undo O(1) and patches portable across clients.
 */
import type {
  DocumentMeta,
  EditableObject,
  OCRLayer,
  ObjectId,
  PageId,
  PDFPageModel,
} from "../model/types";
import type { ActorId } from "../model/types";

export type Change =
  | { t: "obj.add"; pageId: PageId; object: EditableObject }
  | { t: "obj.remove"; pageId: PageId; object: EditableObject }
  | {
      t: "obj.update";
      pageId: PageId;
      id: ObjectId;
      before: Partial<EditableObject>;
      after: Partial<EditableObject>;
    }
  | { t: "page.insert"; index: number; page: PDFPageModel; objects: EditableObject[]; ocr: OCRLayer | null }
  | { t: "page.remove"; index: number; page: PDFPageModel; objects: EditableObject[]; ocr: OCRLayer | null }
  | { t: "page.move"; pageId: PageId; from: number; to: number }
  | { t: "ocr.set"; pageId: PageId; before: OCRLayer | null; after: OCRLayer | null }
  | { t: "meta.update"; before: Partial<DocumentMeta>; after: Partial<DocumentMeta> };

export interface Patch {
  id: string;
  /** Document schema version this patch was produced under. */
  schemaVersion: number;
  timestamp: number;
  actor?: ActorId;
  /** Optional id of the operation/group that produced it (debugging, audit). */
  sourceOperationId?: string;
  changes: Change[];
}
