import { ops, type OperationEnvelope } from "@/lib/pdf/editor/operations/types";
import type { EditOperation } from "@/lib/pdf/editor/operations/types";
import type { AnnotationObject, Rect, SignatureObject } from "@/lib/pdf/editor/model/types";
import { annotationToEditorObject } from "./factory";
import type { PdfAnnotation } from "./types";

export function addAnnotationOperation(annotation: PdfAnnotation, env?: Partial<OperationEnvelope>): EditOperation {
  const object = annotationToEditorObject(annotation);
  return object.kind === "signature"
    ? ops.addSignature(annotation.pageId, object as SignatureObject, env)
    : ops.addAnnotation(annotation.pageId, object as AnnotationObject, env);
}

export function updateAnnotationOperation(
  pageId: string,
  id: string,
  changes: Partial<AnnotationObject | SignatureObject>,
  isSignature = false,
  env?: Partial<OperationEnvelope>,
): EditOperation {
  if (isSignature) return ops.updateSignature(pageId, id, changes as Partial<SignatureObject>, env);
  return ops.updateAnnotation(pageId, id, changes as Partial<AnnotationObject>, env);
}

export function moveAnnotationOperation(pageId: string, id: string, rect: Rect, isSignature = false, env?: Partial<OperationEnvelope>): EditOperation {
  return isSignature ? ops.moveSignature(pageId, id, rect, env) : ops.updateAnnotation(pageId, id, { rect }, env);
}

export function deleteAnnotationOperation(pageId: string, id: string, isSignature = false, env?: Partial<OperationEnvelope>): EditOperation {
  return isSignature ? ops.removeSignature(pageId, id, env) : ops.deleteAnnotation(pageId, id, env);
}
