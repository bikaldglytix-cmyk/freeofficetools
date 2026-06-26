"use client";

/**
 * React bindings for the singleton {@link documentStore}.
 *
 * Two rules keep these fast and loop-free under React 19 / `useSyncExternalStore`:
 *   1. Object-returning selectors must be referentially stable. We rely on the
 *      memoized selectors in `./selectors.ts` (stable per page) and otherwise
 *      select primitives, so React's `Object.is` snapshot check never thrashes.
 *   2. Actions are stable for the store's lifetime, so selecting them is free.
 */
import { useCallback, useEffect, useRef } from "react";
import { useStore } from "zustand/react";
import type { EditorEventBus, EditorEventMap } from "../events/types";
import type { EventHandler } from "../events/bus";
import type {
  DocumentMeta,
  DocumentState,
  EditableObject,
  ObjectId,
  PageId,
  PDFPageModel,
} from "../model/types";
import type { EditOperation } from "../operations/types";
import type { Patch } from "../patch/types";
import { documentStore } from "./document-store";
import {
  selectObject,
  selectPage,
  selectPageObjects,
  selectPageOrder,
} from "./selectors";
import type { DocumentStore, Selection } from "./types";

const EMPTY_OBJECTS: readonly EditableObject[] = Object.freeze([]);
const EMPTY_PAGE_IDS: readonly PageId[] = Object.freeze([]);

/** Low-level escape hatch: subscribe to any slice of the store. */
export function useDocumentStore<U>(selector: (s: DocumentStore) => U): U {
  return useStore(documentStore, selector);
}

// ---------------------------------------------------------------------------
// State hooks
// ---------------------------------------------------------------------------

export function useDocument(): DocumentState | null {
  return useDocumentStore((s) => s.document);
}

export function useHasDocument(): boolean {
  return useDocumentStore((s) => s.document !== null);
}

export function useDocumentMeta(): DocumentMeta | null {
  return useDocumentStore((s) => s.document?.meta ?? null);
}

export function usePageOrder(): readonly PageId[] {
  return useDocumentStore((s) => (s.document ? selectPageOrder(s.document) : EMPTY_PAGE_IDS));
}

export function usePage(pageId: PageId): PDFPageModel | undefined {
  return useDocumentStore((s) => (s.document ? selectPage(s.document, pageId) : undefined));
}

/** Objects on a page in z-order. Stable reference until that page changes. */
export function usePageObjects(pageId: PageId): readonly EditableObject[] {
  return useDocumentStore((s) =>
    s.document ? selectPageObjects(s.document, pageId) : EMPTY_OBJECTS,
  );
}

export function useObject(pageId: PageId, id: ObjectId): EditableObject | undefined {
  return useDocumentStore((s) => (s.document ? selectObject(s.document, pageId, id) : undefined));
}

export function useSelection(): Selection {
  return useDocumentStore((s) => s.selection);
}

export function useActivePageId(): PageId | null {
  return useDocumentStore((s) => s.activePageId);
}

export function useIsDirty(): boolean {
  return useDocumentStore((s) => s.dirty);
}

export function useLastSavedAt(): number | null {
  return useDocumentStore((s) => s.lastSavedAt);
}

// ---------------------------------------------------------------------------
// Action hooks (stable references)
// ---------------------------------------------------------------------------

export function useDispatch(): (op: EditOperation) => Patch | null {
  return useDocumentStore((s) => s.dispatch);
}

export function useDispatchAll(): (ops: EditOperation[], label?: string) => Patch | null {
  return useDocumentStore((s) => s.dispatchAll);
}

export function useCanUndo(): boolean {
  return useDocumentStore((s) => s.history.undo.length > 0);
}

export function useCanRedo(): boolean {
  return useDocumentStore((s) => s.history.redo.length > 0);
}

export interface UndoRedo {
  undo: () => boolean;
  redo: () => boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export function useUndoRedo(): UndoRedo {
  const undo = useDocumentStore((s) => s.undo);
  const redo = useDocumentStore((s) => s.redo);
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  return { undo, redo, canUndo, canRedo };
}

export interface SelectionActions {
  select: (pageId: PageId, ids: ObjectId[]) => void;
  toggleSelect: (pageId: PageId, id: ObjectId) => void;
  clearSelection: () => void;
  setActivePage: (pageId: PageId | null) => void;
}

export function useSelectionActions(): SelectionActions {
  const select = useDocumentStore((s) => s.select);
  const toggleSelect = useDocumentStore((s) => s.toggleSelect);
  const clearSelection = useDocumentStore((s) => s.clearSelection);
  const setActivePage = useDocumentStore((s) => s.setActivePage);
  return { select, toggleSelect, clearSelection, setActivePage };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export function useEditorEvents(): EditorEventBus {
  return useDocumentStore((s) => s.events);
}

/** Subscribe to one editor event for the lifetime of the component. */
export function useEditorEvent<K extends keyof EditorEventMap>(
  type: K,
  handler: EventHandler<EditorEventMap[K]>,
): void {
  const events = useEditorEvents();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    return events.on(type, (payload, meta) => ref.current(payload, meta));
  }, [events, type]);
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts (Ctrl/Cmd+Z, Ctrl+Shift+Z / Ctrl+Y)
// ---------------------------------------------------------------------------

export interface KeyboardOptions {
  /** Disable while a modal/text input has focus, etc. */
  enabled?: boolean;
}

/**
 * Wire undo/redo to the keyboard. Call once near the editor root.
 * Ignores keystrokes originating from editable fields so typing isn't hijacked.
 */
export function useEditorKeyboard(options: KeyboardOptions = {}): void {
  const enabled = options.enabled ?? true;
  const undo = useDocumentStore((s) => s.undo);
  const redo = useDocumentStore((s) => s.redo);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      const target = e.target as HTMLElement | null;
      if (target && isEditableTarget(target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    },
    [enabled, undo, redo],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);
}

function isEditableTarget(el: HTMLElement): boolean {
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}
