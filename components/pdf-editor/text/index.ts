/**
 * Public entry point for the PDF Editor text-editing UI layer (Phase 4).
 *
 * Mounts over the Phase 1 viewer page and drives the Phase 4 text engine
 * (`@/lib/pdf/text`) through the Phase 2 document store.
 */
export { TextEditLayer, applyStyleToSelectedText, deleteSelectedText, type TextTool } from "./text-edit-layer";
export { TextBlockEditor } from "./text-block-editor";
export { useTextExtraction } from "./use-text-extraction";
export type { UseTextExtractionParams } from "./use-text-extraction";
