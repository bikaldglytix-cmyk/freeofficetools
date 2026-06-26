import { createTextBlock } from "@/lib/pdf/editor/model/factory";
import type { Rect, TextBlock as EditorTextBlock } from "@/lib/pdf/editor/model/types";
import { ops, type EditOperation, type OperationEnvelope } from "@/lib/pdf/editor/operations/types";
import { createNewTextInstruction, createWhiteoutRestampInstruction } from "./whiteout";
import { defaultTextStyle } from "./fonts";
import type { TextBlock, TextStyle } from "./types";

export function textBlockToEditorObject(block: TextBlock, source: EditorTextBlock["source"] = "original"): EditorTextBlock {
  return createTextBlock({
    pageId: block.pageId,
    rect: block.bounds,
    text: block.text,
    fontFamily: block.style.font.fallbackFamily,
    fontSize: block.style.fontSize,
    color: block.style.color,
    align: block.style.align,
    lineHeight: block.style.lineHeight,
    opacity: block.style.opacity,
    rotation: block.transforms.rotation,
    zIndex: block.zIndex,
    source,
    originalItemIds: block.provenance.kind === "native" ? block.provenance.pdfItemIds : undefined,
    metadata: {
      textEdit: block,
      export: source === "added" ? createNewTextInstruction(block) : createWhiteoutRestampInstruction(block, { objectId: block.id, text: block.text }),
    },
  });
}

export function createAddedTextOperation(params: {
  pageId: string;
  rect: Rect;
  text: string;
  style?: Partial<TextStyle>;
  actor?: string;
  env?: Partial<OperationEnvelope>;
}): EditOperation {
  const style = defaultTextStyle(params.style);
  const object = createTextBlock({
    pageId: params.pageId,
    rect: params.rect,
    text: params.text,
    fontFamily: style.font.fallbackFamily,
    fontSize: style.fontSize,
    color: style.color,
    align: style.align,
    lineHeight: style.lineHeight,
    opacity: style.opacity,
    actor: params.actor,
    source: "added",
    metadata: {
      textEdit: { provenance: { kind: "added", confidence: 1, editable: "direct" }, style },
      export: {
        kind: "new-text",
        bounds: params.rect,
        text: params.text,
        style,
      },
    },
  });
  return ops.addText(params.pageId, object, params.env);
}

export function createReplacementTextOperation(params: {
  source: TextBlock;
  text: string;
  rect?: Rect;
  style?: Partial<TextStyle>;
  env?: Partial<OperationEnvelope>;
}): EditOperation {
  const style = defaultTextStyle({ ...params.source.style, ...params.style });
  const bounds = params.rect ?? params.source.bounds;
  const replacement: TextBlock = {
    ...params.source,
    id: params.source.id,
    text: params.text,
    bounds,
    style,
    updatedAt: Date.now(),
    metadata: {
      ...params.source.metadata,
      replacementOf: params.source.id,
    },
  };
  const object = textBlockToEditorObject(replacement, params.source.provenance.kind === "added" ? "added" : "original");
  object.metadata.export = createWhiteoutRestampInstruction(params.source, {
    objectId: object.id,
    text: params.text,
    bounds,
    style,
  });
  return ops.addText(params.source.pageId, object, params.env);
}

export function updateTextContentOperation(pageId: string, id: string, text: string, env?: Partial<OperationEnvelope>): EditOperation {
  return ops.updateText(pageId, id, {
    text,
    metadata: {
      export: { kind: "whiteout-restamp", text },
    },
  }, env);
}

export function styleTextOperation(pageId: string, id: string, style: Partial<TextStyle>, env?: Partial<OperationEnvelope>): EditOperation {
  // The Phase 2 store has no dedicated STYLE_TEXT op; styling is an UPDATE_TEXT
  // that maps the rich TextStyle onto the flat editor TextBlock fields. The full
  // style is preserved in metadata so the export engine can restamp faithfully.
  const changes: Partial<EditorTextBlock> = {};
  if (style.font) changes.fontFamily = style.font.available ? style.font.family : style.font.fallbackFamily;
  if (style.fontSize !== undefined) changes.fontSize = style.fontSize;
  if (style.color !== undefined) changes.color = style.color;
  if (style.align !== undefined) changes.align = style.align;
  if (style.lineHeight !== undefined) changes.lineHeight = style.lineHeight;
  if (style.opacity !== undefined) changes.opacity = style.opacity;
  changes.metadata = { export: { kind: "whiteout-restamp", style } };
  return ops.updateText(pageId, id, changes, env);
}
