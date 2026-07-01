import { createTextBlock } from "@/lib/pdf/editor/model/factory";
import type { Rect, TextBlock as EditorTextBlock, TextRun } from "@/lib/pdf/editor/model/types";
import { ops, type EditOperation, type OperationEnvelope } from "@/lib/pdf/editor/operations/types";
import { createNewTextInstruction, createWhiteoutRestampInstruction } from "./whiteout";
import { defaultTextStyle, fontFamilyStack } from "./fonts";
import { measureTextBoxHeight } from "./measure";
import type { TextBlock, TextStyle } from "./types";

export function textBlockToEditorObject(
  block: TextBlock,
  source: EditorTextBlock["source"] = "original",
  runs?: TextRun[],
): EditorTextBlock {
  return createTextBlock({
    pageId: block.pageId,
    rect: block.bounds,
    text: block.text,
    // Per-run formatting (rich text). When present it overrides the block-level
    // weight/slant on both screen and export, so a mixed-format line keeps each
    // word's style instead of collapsing to one.
    runs: runs && runs.length ? runs : undefined,
    fontFamily: block.style.font.available ? block.style.font.family : block.style.font.fallbackFamily,
    pdfFontFamily: block.style.font.cssName,
    fontSize: block.style.fontSize,
    color: block.style.color,
    align: block.style.align,
    lineHeight: block.style.lineHeight,
    bold: block.style.bold,
    italic: block.style.italic,
    opacity: block.style.opacity,
    rotation: block.transforms.rotation,
    zIndex: block.zIndex,
    source,
    originalItemIds: block.provenance.kind === "native" ? block.provenance.pdfItemIds : undefined,
    metadata: {
      textEdit: block,
      // Offset (pt) from the box top to the first line's baseline, taken from the
      // line's own original bounds so it survives a box move. The export renderer
      // uses it to place the restamped text on the SAME baseline as the original
      // glyphs (instead of a fixed 0.8·fontSize), eliminating the vertical shift.
      ...firstBaselineMeta(block),
      export: source === "added" ? createNewTextInstruction(block) : createWhiteoutRestampInstruction(block, { objectId: block.id, text: block.text }),
    },
  });
}

function firstBaselineMeta(block: TextBlock): { firstBaseline?: number } {
  const line = block.lines?.[0];
  if (!line) return {};
  const offset = line.baseline - line.bounds.y;
  return Number.isFinite(offset) && offset > 0 ? { firstBaseline: offset } : {};
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
    bold: style.bold,
    italic: style.italic,
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
  /** Per-run formatting from the rich editor; preserves mixed bold/italic etc. */
  runs?: TextRun[];
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
  const object = textBlockToEditorObject(replacement, params.source.provenance.kind === "added" ? "added" : "original", params.runs);
  object.metadata.export = createWhiteoutRestampInstruction(params.source, {
    objectId: object.id,
    text: params.text,
    bounds,
    style,
  });
  return ops.addText(params.source.pageId, object, params.env);
}

/**
 * Read the existing export instruction off a text object so updates can be
 * merged into it. UPDATE_TEXT patches replace the whole `metadata` object
 * (shallow merge — see patch/apply.ts), so we must carry forward the prior
 * `export` payload — crucially its `whiteout.bounds` — or every content/style
 * edit after the first would drop the original-text mask + redaction region.
 */
type TextExport = Record<string, unknown>;
function prevExport(object: EditorTextBlock): TextExport {
  return ((object.metadata?.export as TextExport | undefined) ?? {});
}

export function updateTextContentOperation(
  pageId: string,
  object: EditorTextBlock,
  text: string,
  rect?: Rect,
  runs?: TextRun[],
  env?: Partial<OperationEnvelope>,
): EditOperation {
  const prior = prevExport(object);
  const changes: Partial<EditorTextBlock> = {
    text,
    // Per-run formatting from the rich editor. Setting `runs` (even to `[]`) is
    // intentional so an edit that removes mixed formatting also clears stale runs;
    // `undefined` (caller passed nothing) leaves the existing runs untouched.
    ...(runs !== undefined ? { runs: runs.length ? runs : undefined } : {}),
    metadata: {
      ...object.metadata,
      // Preserve kind/whiteout/style; the text and (when the box auto-grew to
      // fit it) the restamp bounds change. The original-text mask in
      // `whiteout.bounds` is carried forward via `...prior`.
      export: { kind: "whiteout-restamp", ...prior, text, ...(rect ? { bounds: rect } : {}) },
    },
  };
  // Auto-grow: a taller box so the new text is never clipped in the editor and
  // the selection handles wrap the real content (Acrobat-style).
  if (rect) changes.rect = rect;
  return ops.updateText(pageId, object.id, changes, env);
}

/** Apply a whole-block style delta onto each existing run so a block-wide change
 *  (e.g. "make everything size 20") stays consistent when rich runs are present. */
function applyStyleToRuns(runs: readonly TextRun[], style: Partial<TextStyle>): TextRun[] {
  return runs.map((r) => ({
    ...r,
    ...(style.bold !== undefined ? { bold: style.bold } : {}),
    ...(style.italic !== undefined ? { italic: style.italic } : {}),
    ...(style.underline !== undefined ? { underline: style.underline } : {}),
    ...(style.fontSize !== undefined ? { fontSize: style.fontSize } : {}),
    ...(style.color !== undefined ? { color: style.color } : {}),
    ...(style.font ? { fontFamily: style.font.available ? style.font.family : style.font.fallbackFamily, pdfFontFamily: style.font.cssName } : {}),
  }));
}

export function styleTextOperation(pageId: string, object: EditorTextBlock, style: Partial<TextStyle>, env?: Partial<OperationEnvelope>): EditOperation {
  // The Phase 2 store has no dedicated STYLE_TEXT op; styling is an UPDATE_TEXT
  // that maps the rich TextStyle onto the flat editor TextBlock fields. The full
  // style is preserved in metadata so the export engine can restamp faithfully.
  const changes: Partial<EditorTextBlock> = {};
  if (style.font) {
    changes.fontFamily = style.font.available ? style.font.family : style.font.fallbackFamily;
    // Picking a font in the UI intentionally leaves the embedded face behind
    // (cssName is undefined for picker fonts, which clears it).
    changes.pdfFontFamily = style.font.cssName;
  }
  if (style.fontSize !== undefined) changes.fontSize = style.fontSize;
  if (style.color !== undefined) changes.color = style.color;
  if (style.align !== undefined) changes.align = style.align;
  if (style.lineHeight !== undefined) changes.lineHeight = style.lineHeight;
  if (style.bold !== undefined) changes.bold = style.bold;
  if (style.italic !== undefined) changes.italic = style.italic;
  if (style.opacity !== undefined) changes.opacity = style.opacity;
  // Keep per-run formatting in sync with a whole-block style change so the runs
  // (authoritative for rendering) don't override and silently undo it.
  if (object.runs && object.runs.length) changes.runs = applyStyleToRuns(object.runs, style);
  // Re-fit the box to the new effective style (e.g. a bigger font needs a taller
  // box) so style changes can't clip text either. Keeps x/y/width; grows height.
  const height = measureTextBoxHeight({
    text: object.text,
    widthPoints: object.rect.width,
    fontFamily: fontFamilyStack(
      changes.fontFamily ?? object.fontFamily,
      "pdfFontFamily" in changes ? changes.pdfFontFamily : object.pdfFontFamily,
    ),
    fontSizePoints: changes.fontSize ?? object.fontSize,
    bold: changes.bold ?? object.bold,
    italic: changes.italic ?? object.italic,
    lineHeight: changes.lineHeight ?? object.lineHeight,
  });
  if (Math.abs(height - object.rect.height) > 0.5) changes.rect = { ...object.rect, height };
  const prior = prevExport(object);
  const priorStyle = (prior.style as Record<string, unknown> | undefined) ?? {};
  changes.metadata = {
    ...object.metadata,
    // Merge the new style fields into the existing export instruction so its
    // bounds/whiteout survive; never clobber the whole export payload.
    export: {
      kind: "whiteout-restamp",
      ...prior,
      style: { ...priorStyle, ...style },
      ...(changes.rect ? { bounds: changes.rect } : {}),
    },
  };
  return ops.updateText(pageId, object.id, changes, env);
}
