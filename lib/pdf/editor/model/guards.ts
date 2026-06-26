/** Type guards for narrowing the EditableObject union. */
import type {
  AnnotationObject,
  EditableObject,
  ImageObject,
  RedactionObject,
  SignatureObject,
  TextBlock,
} from "./types";

export const isTextBlock = (o: EditableObject): o is TextBlock => o.kind === "text";
export const isImageObject = (o: EditableObject): o is ImageObject => o.kind === "image";
export const isAnnotation = (o: EditableObject): o is AnnotationObject => o.kind === "annotation";
export const isSignature = (o: EditableObject): o is SignatureObject => o.kind === "signature";
export const isRedaction = (o: EditableObject): o is RedactionObject => o.kind === "redaction";
