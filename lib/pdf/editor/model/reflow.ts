/**
 * Vertical reflow: when an object grows taller, the content beneath it must move
 * down by the same amount instead of being overlapped.
 *
 * This is deliberately a small, pure helper (no store/UI deps) so the editor can
 * batch a "grow + push everything below" edit as one undoable action, and so the
 * rule is unit-testable. It is column-agnostic on purpose — every object whose
 * top sits at or below the grown block's *original* bottom shifts down by the
 * growth delta, preserving the spacing between them (the common single-column
 * document case, and what users mean by "push the content below down a bit").
 */
import type { EditableObject, ObjectId, PageId, Rect } from "./types";
import { ops, type EditOperation } from "../operations/types";

/** Sub-point growth/position differences are noise; ignore them. */
export const REFLOW_TOLERANCE = 0.5;

/** The right "move" operation for an object kind (redactions have none). */
function moveObjectOp(pageId: PageId, obj: EditableObject, rect: Rect): EditOperation | null {
  switch (obj.kind) {
    case "text":
      return ops.moveText(pageId, obj.id, rect);
    case "image":
      return ops.moveImage(pageId, obj.id, rect);
    case "signature":
      return ops.moveSignature(pageId, obj.id, rect);
    case "annotation":
      return ops.updateAnnotation(pageId, obj.id, { rect });
    default:
      return null;
  }
}

export interface ReflowParams {
  pageId: PageId;
  /** All objects on the page (any order). */
  objects: readonly EditableObject[];
  /** The object that grew; it is never moved by its own growth. */
  anchorId: ObjectId;
  /** The grown object's bottom edge *before* it grew (y + height). */
  oldBottom: number;
  /** How much taller it became (newHeight - oldHeight). */
  delta: number;
}

/**
 * Move every object that sits below `oldBottom` down by `delta`, returning the
 * operations to do so (empty when nothing needs to shift, e.g. the block shrank
 * or grew imperceptibly). Locked objects stay put.
 */
export function reflowBelowOps(params: ReflowParams): EditOperation[] {
  const { pageId, objects, anchorId, oldBottom, delta } = params;
  if (delta <= REFLOW_TOLERANCE) return [];
  const out: EditOperation[] = [];
  for (const obj of objects) {
    if (obj.id === anchorId || obj.locked) continue;
    if (obj.rect.y >= oldBottom - REFLOW_TOLERANCE) {
      const op = moveObjectOp(pageId, obj, { ...obj.rect, y: obj.rect.y + delta });
      if (op) out.push(op);
    }
  }
  return out;
}
