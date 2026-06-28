import type { EditableObject, ObjectId, Rect } from "@/lib/pdf/editor/model/types";
import { rectContainsPoint, rectsIntersect } from "./geometry";
import type { Point } from "./types";

export interface SelectionHit {
  id: ObjectId;
  zIndex: number;
}

/** Kinds the Konva layer renders and lets the user select/move/resize directly. */
function isCanvasSelectable(object: EditableObject): boolean {
  return object.kind === "annotation" || object.kind === "signature" || object.kind === "image";
}

export function hitTestAnnotation(objects: readonly EditableObject[], point: Point): SelectionHit | null {
  let hit: SelectionHit | null = null;
  for (const object of objects) {
    if (!isCanvasSelectable(object) || object.locked || !object.visible) continue;
    if (!rectContainsPoint(object.rect, point)) continue;
    if (!hit || object.zIndex >= hit.zIndex) hit = { id: object.id, zIndex: object.zIndex };
  }
  return hit;
}

export function annotationsInRect(objects: readonly EditableObject[], rect: Rect): ObjectId[] {
  return objects
    .filter((object) => isCanvasSelectable(object) && object.visible && rectsIntersect(object.rect, rect))
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((object) => object.id);
}
