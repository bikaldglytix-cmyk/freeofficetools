/**
 * Edit operations: the strongly-typed, immutable, serializable intents the UI
 * dispatches. Operations describe *what the user wants*; the reducer
 * (`operations/reduce.ts`) turns them into invertible patches against the live
 * document. Per-kind operation names (ADD_TEXT, ADD_IMAGE, …) are the public
 * API; internally the reducer routes them through a few shared handlers.
 *
 * Every operation is plain JSON + frozen, so it can be logged, persisted,
 * replayed and (later) broadcast to collaborators verbatim.
 */
import type {
  AnnotationObject,
  ImageObject,
  OCRLayer,
  ObjectId,
  PageId,
  PDFPageModel,
  RedactionObject,
  Rect,
  SignatureObject,
  TextBlock,
} from "../model/types";
import type { ActorId } from "../model/types";
import { newGroupId, newOperationId } from "../model/ids";

export interface OperationEnvelope {
  id: string;
  timestamp: number;
  actor?: ActorId;
  /** Set when the op is part of a grouped/transactional action. */
  groupId?: string;
}

export type EditOperationBody =
  // --- Text ---
  | { type: "ADD_TEXT"; pageId: PageId; object: TextBlock }
  | { type: "UPDATE_TEXT"; pageId: PageId; id: ObjectId; changes: Partial<TextBlock> }
  | { type: "DELETE_TEXT"; pageId: PageId; id: ObjectId }
  | { type: "MOVE_TEXT"; pageId: PageId; id: ObjectId; rect: Rect }
  // --- Image ---
  | { type: "ADD_IMAGE"; pageId: PageId; object: ImageObject }
  | { type: "UPDATE_IMAGE"; pageId: PageId; id: ObjectId; changes: Partial<ImageObject> }
  | { type: "DELETE_IMAGE"; pageId: PageId; id: ObjectId }
  | { type: "MOVE_IMAGE"; pageId: PageId; id: ObjectId; rect: Rect }
  // --- Annotation ---
  | { type: "ADD_ANNOTATION"; pageId: PageId; object: AnnotationObject }
  | { type: "UPDATE_ANNOTATION"; pageId: PageId; id: ObjectId; changes: Partial<AnnotationObject> }
  | { type: "DELETE_ANNOTATION"; pageId: PageId; id: ObjectId }
  // --- Redaction ---
  | { type: "REDACT"; pageId: PageId; object: RedactionObject }
  // --- Signature ---
  | { type: "ADD_SIGNATURE"; pageId: PageId; object: SignatureObject }
  | { type: "UPDATE_SIGNATURE"; pageId: PageId; id: ObjectId; changes: Partial<SignatureObject> }
  | { type: "MOVE_SIGNATURE"; pageId: PageId; id: ObjectId; rect: Rect }
  | { type: "REMOVE_SIGNATURE"; pageId: PageId; id: ObjectId }
  // --- Pages ---
  | { type: "INSERT_PAGE"; page: PDFPageModel; index: number; objects?: ImageObject[] }
  | { type: "DELETE_PAGE"; pageId: PageId }
  | { type: "MOVE_PAGE"; pageId: PageId; toIndex: number }
  // --- OCR ---
  | { type: "OCR_APPLY"; pageId: PageId; layer: OCRLayer }
  // --- Grouping ---
  | { type: "BATCH"; operations: EditOperation[]; label?: string };

export type EditOperation = OperationEnvelope & EditOperationBody;
export type EditOperationType = EditOperationBody["type"];

/** Wrap a body in an envelope and freeze it (shallow — payloads are fresh). */
export function defineOperation(
  body: EditOperationBody,
  envelope?: Partial<OperationEnvelope>,
): EditOperation {
  return Object.freeze({
    id: envelope?.id ?? newOperationId(),
    timestamp: envelope?.timestamp ?? Date.now(),
    actor: envelope?.actor,
    groupId: envelope?.groupId,
    ...body,
  }) as EditOperation;
}

/**
 * Ergonomic builders. Each returns a frozen `EditOperation`. The UI calls these
 * (often via the store's `dispatch`), keeping call sites declarative.
 */
export const ops = {
  addText: (pageId: PageId, object: TextBlock, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "ADD_TEXT", pageId, object }, env),
  updateText: (pageId: PageId, id: ObjectId, changes: Partial<TextBlock>, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "UPDATE_TEXT", pageId, id, changes }, env),
  deleteText: (pageId: PageId, id: ObjectId, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "DELETE_TEXT", pageId, id }, env),
  moveText: (pageId: PageId, id: ObjectId, rect: Rect, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "MOVE_TEXT", pageId, id, rect }, env),

  addImage: (pageId: PageId, object: ImageObject, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "ADD_IMAGE", pageId, object }, env),
  updateImage: (pageId: PageId, id: ObjectId, changes: Partial<ImageObject>, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "UPDATE_IMAGE", pageId, id, changes }, env),
  deleteImage: (pageId: PageId, id: ObjectId, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "DELETE_IMAGE", pageId, id }, env),
  moveImage: (pageId: PageId, id: ObjectId, rect: Rect, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "MOVE_IMAGE", pageId, id, rect }, env),

  addAnnotation: (pageId: PageId, object: AnnotationObject, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "ADD_ANNOTATION", pageId, object }, env),
  updateAnnotation: (
    pageId: PageId,
    id: ObjectId,
    changes: Partial<AnnotationObject>,
    env?: Partial<OperationEnvelope>,
  ) => defineOperation({ type: "UPDATE_ANNOTATION", pageId, id, changes }, env),
  deleteAnnotation: (pageId: PageId, id: ObjectId, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "DELETE_ANNOTATION", pageId, id }, env),

  redact: (pageId: PageId, object: RedactionObject, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "REDACT", pageId, object }, env),

  addSignature: (pageId: PageId, object: SignatureObject, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "ADD_SIGNATURE", pageId, object }, env),
  updateSignature: (
    pageId: PageId,
    id: ObjectId,
    changes: Partial<SignatureObject>,
    env?: Partial<OperationEnvelope>,
  ) => defineOperation({ type: "UPDATE_SIGNATURE", pageId, id, changes }, env),
  moveSignature: (pageId: PageId, id: ObjectId, rect: Rect, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "MOVE_SIGNATURE", pageId, id, rect }, env),
  removeSignature: (pageId: PageId, id: ObjectId, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "REMOVE_SIGNATURE", pageId, id }, env),

  insertPage: (page: PDFPageModel, index: number, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "INSERT_PAGE", page, index }, env),
  deletePage: (pageId: PageId, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "DELETE_PAGE", pageId }, env),
  movePage: (pageId: PageId, toIndex: number, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "MOVE_PAGE", pageId, toIndex }, env),

  ocrApply: (pageId: PageId, layer: OCRLayer, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "OCR_APPLY", pageId, layer }, env),

  batch: (operations: EditOperation[], label?: string, env?: Partial<OperationEnvelope>) =>
    defineOperation({ type: "BATCH", operations, label }, { groupId: newGroupId(), ...env }),
};
