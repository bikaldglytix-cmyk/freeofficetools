/**
 * Public entry point for the PDF Editor document state engine (Phase 2).
 *
 * Import from here (`@/lib/pdf/editor`) rather than reaching into submodules, so
 * the internal layout can evolve without churning call sites.
 *
 * Layers:
 *   model        — canonical normalized document + factories + guards
 *   operations   — strongly-typed edit intents + the reducer (op → patch)
 *   patch        — invertible patches: apply / revert / merge
 *   history      — undo/redo stacks (pure)
 *   store        — Zustand store, selectors, React hooks
 *   events       — typed event bus
 *   persistence  — drafts, revisions, autosave, migrations
 *   integration  — adapters to the Phase 1 viewer
 */

// --- Model ------------------------------------------------------------------
export * from "./model/types";
export * from "./model/ids";
export * from "./model/factory";
export * from "./model/guards";

// --- Operations -------------------------------------------------------------
export * from "./operations/types";
export { reduceOperation } from "./operations/reduce";

// --- Patch ------------------------------------------------------------------
export type { Change, Patch } from "./patch/types";
export { applyPatch, invertChange, invertPatch, revertPatch } from "./patch/apply";
export { coalesceUpdates, isEmptyPatch, mergePatches } from "./patch/merge";

// --- History ----------------------------------------------------------------
export * from "./history/history";

// --- Events -----------------------------------------------------------------
export { TypedEventBus } from "./events/bus";
export type { EmittedEvent, EventHandler, EventMeta, EventMiddleware } from "./events/bus";
export { createEditorEventBus } from "./events/types";
export type { EditorEventBus, EditorEventMap } from "./events/types";

// --- Store ------------------------------------------------------------------
export { createDocumentStore, dispatch, documentStore } from "./store/document-store";
export type { CreateDocumentStoreOptions } from "./store/document-store";
export type { DocumentStore, DocumentStoreActions, DocumentStoreState, Selection } from "./store/types";
export * from "./store/selectors";
// React hooks live behind a "use client" boundary; import them directly from
// "@/lib/pdf/editor/store/hooks" so this barrel stays safe for non-React
// consumers (Node tests, the Phase 5 export engine, web workers).

// --- Persistence ------------------------------------------------------------
export * from "./persistence/schema";
export { DraftStore, draftStore } from "./persistence/draft-store";
export type { LoadedDraft, SaveDraftOptions } from "./persistence/draft-store";
export { createAutosave } from "./persistence/autosave";
export type { AutosaveController, AutosaveOptions } from "./persistence/autosave";
export {
  ALL_STORES,
  createDefaultBackend,
  createIdbBackend,
  createMemoryBackend,
  STORE_DRAFTS,
  STORE_REVISIONS,
} from "./persistence/backend";
export type { KVBackend, StoreName } from "./persistence/backend";
export { isCurrentSchema, MigrationError, migratePersisted } from "./persistence/migrations";
export type { Migration } from "./persistence/migrations";

// --- Integration ------------------------------------------------------------
export { buildDocumentFromViewer, pageIdForSourceIndex } from "./integration/from-viewer";
export type { FromViewerOptions } from "./integration/from-viewer";
