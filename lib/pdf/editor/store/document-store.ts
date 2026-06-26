/**
 * The editor's single source of truth — a Zustand (vanilla) store.
 *
 * Why vanilla + a factory:
 *   - `createDocumentStore()` returns an isolated store, so tests (and a future
 *     multi-document UI) can spin up independent instances with no globals.
 *   - The app uses one shared singleton (`documentStore`) wrapped by React hooks
 *     in `./hooks.ts`.
 *
 * The store is intentionally thin: it holds normalized state and orchestrates
 * the pure engine modules — `reduceOperation` (op → patch), `applyPatch` /
 * `revertPatch` (patch → state) and the history stacks. Every mutation goes
 * through a patch, which is what keeps undo/redo, persistence and export
 * perfectly consistent.
 */
import { createStore, type StoreApi } from "zustand/vanilla";
import { createEditorEventBus, type EditorEventBus } from "../events/types";
import {
  clearHistory as clearHistoryStacks,
  createHistory,
  DEFAULT_HISTORY_LIMIT,
  historyInfo,
  popRedo,
  popUndo,
  recordPatch,
} from "../history/history";
import type { DocumentState } from "../model/types";
import { defineOperation, type EditOperation } from "../operations/types";
import { reduceOperation } from "../operations/reduce";
import { applyPatch, revertPatch } from "../patch/apply";
import { isEmptyPatch, mergePatches } from "../patch/merge";
import type { Patch } from "../patch/types";
import type { DocumentStore } from "./types";

export interface CreateDocumentStoreOptions {
  /** Max undo entries to keep (default 200; 0 = unlimited). */
  historyLimit?: number;
  /** Inject a shared event bus (e.g. to wire app-wide listeners up front). */
  events?: EditorEventBus;
}

type Cause = "dispatch" | "undo" | "redo";

/** Emit DOCUMENT_CHANGED plus granular events derived from a patch's changes. */
function emitPatchEvents(
  events: EditorEventBus,
  patch: Patch,
  cause: Cause,
  resultDoc: DocumentState | null,
): void {
  events.emit("DOCUMENT_CHANGED", { patch, cause });
  // Granular events describe forward intent; undo/redo consumers re-read state.
  if (cause !== "dispatch") return;

  for (const c of patch.changes) {
    switch (c.t) {
      case "obj.add":
        events.emit("OBJECT_ADDED", { pageId: c.pageId, id: c.object.id, kind: c.object.kind });
        if (c.object.kind === "annotation") {
          events.emit("ANNOTATION_CREATED", { pageId: c.pageId, id: c.object.id });
        }
        break;
      case "obj.remove":
        events.emit("OBJECT_REMOVED", { pageId: c.pageId, id: c.object.id, kind: c.object.kind });
        break;
      case "obj.update": {
        const kind = resultDoc?.objectsByPage[c.pageId]?.[c.id]?.kind ?? "text";
        events.emit("OBJECT_UPDATED", { pageId: c.pageId, id: c.id, kind });
        if (kind === "text") events.emit("TEXT_UPDATED", { pageId: c.pageId, id: c.id });
        if (kind === "image" && "rect" in c.after) {
          events.emit("IMAGE_MOVED", { pageId: c.pageId, id: c.id });
        }
        break;
      }
      case "page.insert":
        events.emit("PAGE_ADDED", { pageId: c.page.id, index: c.index });
        break;
      case "page.remove":
        events.emit("PAGE_REMOVED", { pageId: c.page.id, index: c.index });
        break;
      case "page.move":
        events.emit("PAGE_MOVED", { pageId: c.pageId, from: c.from, to: c.to });
        break;
      case "ocr.set":
        events.emit("OCR_APPLIED", { pageId: c.pageId });
        break;
      case "meta.update":
        break;
    }
  }
}

export function createDocumentStore(
  options: CreateDocumentStoreOptions = {},
): StoreApi<DocumentStore> {
  const events = options.events ?? createEditorEventBus();
  const historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT;

  return createStore<DocumentStore>()((set, get) => {
    const emitHistoryChanged = () => {
      events.emit("HISTORY_CHANGED", historyInfo(get().history));
    };

    return {
      // ----- initial state ---------------------------------------------------
      document: null,
      history: createHistory(historyLimit),
      selection: { pageId: null, ids: [] },
      activePageId: null,
      dirty: false,
      lastSavedAt: null,
      transaction: null,
      events,

      // ----- lifecycle -------------------------------------------------------
      loadDocument(document) {
        set({
          document,
          history: createHistory(historyLimit),
          selection: { pageId: null, ids: [] },
          activePageId: document.pageOrder[0] ?? null,
          dirty: false,
          lastSavedAt: null,
          transaction: null,
        });
        events.emit("DOCUMENT_LOADED", { documentId: document.meta.id });
        emitHistoryChanged();
      },

      setDocument(document) {
        set({ document, dirty: true });
      },

      restoreSnapshot(document) {
        set({
          document,
          history: createHistory(historyLimit),
          selection: { pageId: null, ids: [] },
          activePageId: document.pageOrder[0] ?? null,
          dirty: true,
          transaction: null,
        });
        events.emit("DOCUMENT_LOADED", { documentId: document.meta.id });
        emitHistoryChanged();
      },

      closeDocument() {
        const id = get().document?.meta.id;
        set({
          document: null,
          history: createHistory(historyLimit),
          selection: { pageId: null, ids: [] },
          activePageId: null,
          dirty: false,
          lastSavedAt: null,
          transaction: null,
        });
        if (id) events.emit("DOCUMENT_CLOSED", { documentId: id });
        emitHistoryChanged();
      },

      // ----- dispatch --------------------------------------------------------
      dispatch(op) {
        const { document, transaction, history } = get();
        if (!document) return null;

        const patch = reduceOperation(document, op);
        if (isEmptyPatch(patch)) return null;

        const next = applyPatch(document, patch);

        if (transaction) {
          set({
            document: next,
            dirty: true,
            transaction: { ...transaction, patches: [...transaction.patches, patch] },
          });
        } else {
          set({ document: next, dirty: true, history: recordPatch(history, patch) });
        }

        events.emit("OPERATION_DISPATCHED", { operation: op, patch });
        emitPatchEvents(events, patch, "dispatch", next);
        if (!transaction) emitHistoryChanged();
        return patch;
      },

      dispatchAll(ops, label) {
        if (ops.length === 0) return null;
        const batch = defineOperation({ type: "BATCH", operations: ops, label });
        return get().dispatch(batch);
      },

      // ----- transactions ----------------------------------------------------
      beginTransaction(label) {
        if (get().transaction) return; // already open; keep the outer one
        set({ transaction: { label, patches: [] } });
      },

      commitTransaction() {
        const { transaction, history } = get();
        if (!transaction) return null;
        if (transaction.patches.length === 0) {
          set({ transaction: null });
          return null;
        }
        const merged = mergePatches(transaction.patches);
        set({ transaction: null, history: recordPatch(history, merged) });
        emitHistoryChanged();
        return merged;
      },

      cancelTransaction() {
        const { transaction, document } = get();
        if (!transaction) return;
        let doc = document;
        if (doc) {
          for (let i = transaction.patches.length - 1; i >= 0; i--) {
            doc = revertPatch(doc, transaction.patches[i]);
          }
        }
        set({ document: doc, transaction: null, dirty: true });
      },

      // ----- history ---------------------------------------------------------
      undo() {
        const { document, history } = get();
        if (!document) return false;
        const step = popUndo(history);
        if (!step) return false;
        const next = revertPatch(document, step.patch);
        set({ document: next, history: step.history, dirty: true });
        events.emit("UNDO", { patch: step.patch });
        emitPatchEvents(events, step.patch, "undo", next);
        emitHistoryChanged();
        return true;
      },

      redo() {
        const { document, history } = get();
        if (!document) return false;
        const step = popRedo(history);
        if (!step) return false;
        const next = applyPatch(document, step.patch);
        set({ document: next, history: step.history, dirty: true });
        events.emit("REDO", { patch: step.patch });
        emitPatchEvents(events, step.patch, "redo", next);
        emitHistoryChanged();
        return true;
      },

      clearHistory() {
        set({ history: clearHistoryStacks(get().history) });
        emitHistoryChanged();
      },

      // ----- selection -------------------------------------------------------
      select(pageId, ids) {
        set({ selection: { pageId, ids: [...ids] }, activePageId: pageId });
        events.emit("SELECTION_CHANGED", { pageId, ids });
      },

      toggleSelect(pageId, id) {
        const { selection } = get();
        const samePage = selection.pageId === pageId;
        const current = samePage ? selection.ids : [];
        const ids = current.includes(id)
          ? current.filter((x) => x !== id)
          : [...current, id];
        set({ selection: { pageId, ids }, activePageId: pageId });
        events.emit("SELECTION_CHANGED", { pageId, ids });
      },

      clearSelection() {
        set({ selection: { pageId: null, ids: [] } });
        events.emit("SELECTION_CHANGED", { pageId: null, ids: [] });
      },

      setActivePage(pageId) {
        set({ activePageId: pageId });
      },

      // ----- persistence bookkeeping ----------------------------------------
      markSaved(at) {
        set({ dirty: false, lastSavedAt: at ?? Date.now() });
      },
    };
  });
}

/** App-wide singleton store. Tests should use `createDocumentStore()` instead. */
export const documentStore = createDocumentStore();

/** Convenience: dispatch against the singleton without a React hook. */
export function dispatch(op: EditOperation): Patch | null {
  return documentStore.getState().dispatch(op);
}
