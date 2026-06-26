/**
 * Autosave controller.
 *
 * Subscribes to a store and writes a debounced draft whenever the document
 * becomes dirty. On a successful save it calls `markSaved` (flipping `dirty` off
 * and stamping `lastSavedAt`) and emits `PERSIST_SAVED`, so the UI can show a
 * "Saved" indicator and recovery is always one `loadDraft` away.
 */
import type { StoreApi } from "zustand/vanilla";
import type { DocumentStore } from "../store/types";
import { DraftStore, draftStore as defaultDraftStore } from "./draft-store";

export interface AutosaveOptions {
  /** Quiet period (ms) after the last edit before writing. Default 1500. */
  debounceMs?: number;
  /** Persist undo/redo stacks too (heavier; default false). */
  includeHistory?: boolean;
  /** Override the draft key (defaults to the document id). */
  draftId?: string;
  /** Where to persist (defaults to the IndexedDB-backed singleton). */
  store?: DraftStore;
}

export interface AutosaveController {
  /** Begin watching the store. Returns the controller for chaining. */
  start(): AutosaveController;
  /** Stop watching and cancel any pending save. */
  stop(): void;
  /** Force an immediate save (e.g. on `beforeunload`). Resolves when written. */
  saveNow(): Promise<void>;
  /** Whether a debounced save is currently scheduled. */
  isPending(): boolean;
}

export function createAutosave(
  store: StoreApi<DocumentStore>,
  options: AutosaveOptions = {},
): AutosaveController {
  const debounceMs = options.debounceMs ?? 1500;
  const persistence = options.store ?? defaultDraftStore;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe: (() => void) | null = null;
  let saving = false;

  const cancelTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const doSave = async (): Promise<void> => {
    cancelTimer();
    const state = store.getState();
    const document = state.document;
    if (!document || !state.dirty || saving) return;

    saving = true;
    try {
      const id = options.draftId ?? document.meta.id;
      const savedAt = Date.now();
      await persistence.saveDraft(document, {
        id,
        savedAt,
        history: options.includeHistory
          ? { undo: state.history.undo, redo: state.history.redo }
          : undefined,
      });
      // Only clear `dirty` if nothing changed *during* the async write.
      if (store.getState().document === document) {
        store.getState().markSaved(savedAt);
      }
      state.events.emit("PERSIST_SAVED", { draftId: id, savedAt });
    } finally {
      saving = false;
    }
  };

  const schedule = () => {
    cancelTimer();
    timer = setTimeout(() => {
      void doSave();
    }, debounceMs);
  };

  const controller: AutosaveController = {
    start() {
      if (unsubscribe) return controller;
      unsubscribe = store.subscribe((state, prev) => {
        // Re-arm only when the document actually changed and is dirty.
        if (state.document !== prev.document && state.dirty) schedule();
      });
      return controller;
    },
    stop() {
      cancelTimer();
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    },
    saveNow() {
      return doSave();
    },
    isPending() {
      return timer !== null;
    },
  };

  return controller;
}
