/**
 * Public shape of the editor store: state + actions. Kept separate from the
 * implementation so UI code and tests can depend on the interface, and so the
 * (large) action surface is documented in one place.
 */
import type { EditorEventBus } from "../events/types";
import type { History } from "../history/history";
import type {
  DocumentState,
  ObjectId,
  PageId,
} from "../model/types";
import type { EditOperation } from "../operations/types";
import type { Patch } from "../patch/types";

/** Which objects on which page are currently selected. */
export interface Selection {
  pageId: PageId | null;
  ids: ObjectId[];
}

export interface DocumentStoreState {
  /** The canonical document, or null when nothing is open. */
  document: DocumentState | null;
  /** Undo/redo stacks. */
  history: History;
  /** Current selection (objects + page). */
  selection: Selection;
  /** The page the toolbar/keyboard act on by default. */
  activePageId: PageId | null;
  /** True when there are unsaved changes since the last `markSaved`. */
  dirty: boolean;
  /** Timestamp of the last successful persist, or null. */
  lastSavedAt: number | null;
  /** Open transaction buffer, or null when not inside `beginTransaction`. */
  transaction: { label?: string; patches: Patch[] } | null;
  /** Stable, app-wide event bus (does not change across renders). */
  events: EditorEventBus;
}

export interface DocumentStoreActions {
  // --- Lifecycle ------------------------------------------------------------
  /** Load a document, resetting history/selection. */
  loadDocument(document: DocumentState): void;
  /** Replace the document *without* clearing history (e.g. external sync). */
  setDocument(document: DocumentState): void;
  /** Restore a snapshot (e.g. a revision); clears history. */
  restoreSnapshot(document: DocumentState): void;
  closeDocument(): void;

  // --- Dispatch -------------------------------------------------------------
  /** Reduce + apply one operation. Returns the patch, or null for a no-op. */
  dispatch(op: EditOperation): Patch | null;
  /** Dispatch many ops as a single undo step (one merged patch). */
  dispatchAll(ops: EditOperation[], label?: string): Patch | null;

  // --- Transactions (for interactive, multi-step gestures like drag) --------
  /** Open a transaction: subsequent dispatches apply live but coalesce into one
   *  undo entry on commit. */
  beginTransaction(label?: string): void;
  /** Close the transaction, recording a single merged patch. Returns it. */
  commitTransaction(): Patch | null;
  /** Abort the transaction, reverting everything dispatched since it opened. */
  cancelTransaction(): void;

  // --- History --------------------------------------------------------------
  undo(): boolean;
  redo(): boolean;
  clearHistory(): void;

  // --- Selection ------------------------------------------------------------
  select(pageId: PageId, ids: ObjectId[]): void;
  toggleSelect(pageId: PageId, id: ObjectId): void;
  clearSelection(): void;
  setActivePage(pageId: PageId | null): void;

  // --- Persistence bookkeeping ----------------------------------------------
  markSaved(at?: number): void;
}

export type DocumentStore = DocumentStoreState & DocumentStoreActions;
