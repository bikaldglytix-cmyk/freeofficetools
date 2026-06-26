/**
 * Undo/redo engine — pure, framework-free.
 *
 * The history is two stacks of {@link Patch}es. We never store document
 * snapshots per step (that would be O(document) memory per edit); instead each
 * patch already carries its own inverse information, so:
 *
 *   - **undo** = pop the newest undo patch, hand it back to be *reverted*, and
 *     move it onto the redo stack.  → O(1)
 *   - **redo** = pop the newest redo patch, hand it back to be *applied*, and
 *     move it onto the undo stack.  → O(1)
 *
 * The store owns the document and performs the actual apply/revert; this module
 * only owns the bookkeeping, which makes it trivial to unit-test in isolation.
 *
 * All functions are immutable: they return a *new* {@link History} so the store
 * can keep history in reactive state without aliasing bugs.
 */
import type { Patch } from "../patch/types";

export interface History {
  /** Newest patch is last. Reverting it is "undo". */
  undo: Patch[];
  /** Newest undone patch is last. Applying it is "redo". */
  redo: Patch[];
  /** Max undo entries kept; older entries are dropped (0 = unlimited). */
  limit: number;
}

export const DEFAULT_HISTORY_LIMIT = 200;

export function createHistory(limit: number = DEFAULT_HISTORY_LIMIT): History {
  return { undo: [], redo: [], limit };
}

export function canUndo(h: History): boolean {
  return h.undo.length > 0;
}

export function canRedo(h: History): boolean {
  return h.redo.length > 0;
}

/**
 * Record a freshly-applied patch. This pushes onto the undo stack and clears the
 * redo stack (a new edit invalidates the redo timeline), enforcing `limit`.
 */
export function recordPatch(h: History, patch: Patch): History {
  let undo = [...h.undo, patch];
  if (h.limit > 0 && undo.length > h.limit) {
    undo = undo.slice(undo.length - h.limit);
  }
  return { undo, redo: [], limit: h.limit };
}

export interface HistoryStep {
  history: History;
  /** The patch the store should act on (revert for undo, apply for redo). */
  patch: Patch;
}

/** Pop the newest undo patch. Returns `null` when there is nothing to undo. */
export function popUndo(h: History): HistoryStep | null {
  if (h.undo.length === 0) return null;
  const patch = h.undo[h.undo.length - 1];
  return {
    patch,
    history: {
      undo: h.undo.slice(0, -1),
      redo: [...h.redo, patch],
      limit: h.limit,
    },
  };
}

/** Pop the newest redo patch. Returns `null` when there is nothing to redo. */
export function popRedo(h: History): HistoryStep | null {
  if (h.redo.length === 0) return null;
  const patch = h.redo[h.redo.length - 1];
  return {
    patch,
    history: {
      undo: [...h.undo, patch],
      redo: h.redo.slice(0, -1),
      limit: h.limit,
    },
  };
}

export function clearHistory(h: History): History {
  return { undo: [], redo: [], limit: h.limit };
}

export interface HistoryInfo {
  canUndo: boolean;
  canRedo: boolean;
  undoSize: number;
  redoSize: number;
}

export function historyInfo(h: History): HistoryInfo {
  return {
    canUndo: h.undo.length > 0,
    canRedo: h.redo.length > 0,
    undoSize: h.undo.length,
    redoSize: h.redo.length,
  };
}
