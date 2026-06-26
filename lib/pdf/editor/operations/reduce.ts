/**
 * Operation reducer: turns a high-level {@link EditOperation} into a low-level,
 * **invertible** {@link Patch} against a given document state.
 *
 * This is the single chokepoint between "what the user wants" (operations) and
 * "what actually changes" (patches). Keeping it here means:
 *
 *   - The store never mutates the document directly — it reduces, then applies.
 *   - Undo/redo, persistence and export all consume the *same* patch the reducer
 *     produced, so they can never drift out of sync with the live edit.
 *
 * The reducer reads the current state to capture enough information for a
 * lossless inverse: the `before` of every update, the full object of every
 * delete, the page index of every removed page. That captured state is what
 * makes undo O(1) (no replay) and patches portable to other clients.
 */
import { newPatchId } from "../model/ids";
import type { DocumentState, EditableObject } from "../model/types";
import { applyPatch } from "../patch/apply";
import { coalesceUpdates } from "../patch/merge";
import type { Change, Patch } from "../patch/types";
import type { EditOperation } from "./types";

function objectAt(
  state: DocumentState,
  pageId: string,
  id: string,
): EditableObject | undefined {
  return state.objectsByPage[pageId]?.[id];
}

/**
 * Select exactly `keys` from `obj`, including keys whose value is `undefined`,
 * so an inverse update can faithfully restore "this field was unset".
 */
function pick<T extends object>(obj: T, keys: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = (obj as Record<string, unknown>)[k];
  return out as Partial<T>;
}

function patchOf(state: DocumentState, op: EditOperation, changes: Change[]): Patch {
  return {
    id: newPatchId(),
    schemaVersion: state.meta.schemaVersion,
    timestamp: op.timestamp,
    actor: op.actor,
    sourceOperationId: op.id,
    changes,
  };
}

/**
 * Translate a single operation into its changes against `state`. Returns an
 * empty array for no-ops (e.g. updating an object that no longer exists) so the
 * caller can cheaply skip them.
 */
function opToChanges(state: DocumentState, op: EditOperation): Change[] {
  switch (op.type) {
    // --- Object adds (text, image, annotation, signature, redaction) ---------
    case "ADD_TEXT":
    case "ADD_IMAGE":
    case "ADD_ANNOTATION":
    case "ADD_SIGNATURE":
      return [{ t: "obj.add", pageId: op.pageId, object: op.object }];
    case "REDACT":
      return [{ t: "obj.add", pageId: op.pageId, object: op.object }];

    // --- Object updates -------------------------------------------------------
    case "UPDATE_TEXT":
    case "UPDATE_IMAGE":
    case "UPDATE_ANNOTATION":
    case "UPDATE_SIGNATURE": {
      const current = objectAt(state, op.pageId, op.id);
      if (!current) return [];
      const after: Partial<EditableObject> = {
        ...(op.changes as Partial<EditableObject>),
        updatedAt: op.timestamp,
      };
      const before = pick(current, Object.keys(after));
      return [{ t: "obj.update", pageId: op.pageId, id: op.id, before, after }];
    }

    // --- Moves (a constrained update of `rect`) -------------------------------
    case "MOVE_TEXT":
    case "MOVE_IMAGE":
    case "MOVE_SIGNATURE": {
      const current = objectAt(state, op.pageId, op.id);
      if (!current) return [];
      const after: Partial<EditableObject> = { rect: op.rect, updatedAt: op.timestamp };
      const before = pick(current, ["rect", "updatedAt"]);
      return [{ t: "obj.update", pageId: op.pageId, id: op.id, before, after }];
    }

    // --- Object deletes -------------------------------------------------------
    case "DELETE_TEXT":
    case "DELETE_IMAGE":
    case "DELETE_ANNOTATION":
    case "REMOVE_SIGNATURE": {
      const current = objectAt(state, op.pageId, op.id);
      if (!current) return [];
      return [{ t: "obj.remove", pageId: op.pageId, object: current }];
    }

    // --- Pages ----------------------------------------------------------------
    case "INSERT_PAGE":
      return [
        {
          t: "page.insert",
          index: op.index,
          page: op.page,
          objects: op.objects ?? [],
          ocr: null,
        },
      ];
    case "DELETE_PAGE": {
      const index = state.pageOrder.indexOf(op.pageId);
      const page = state.pages[op.pageId];
      if (index === -1 || !page) return [];
      const objects = Object.values(state.objectsByPage[op.pageId] ?? {});
      const ocr = state.ocrLayers[op.pageId] ?? null;
      return [{ t: "page.remove", index, page, objects, ocr }];
    }
    case "MOVE_PAGE": {
      const from = state.pageOrder.indexOf(op.pageId);
      if (from === -1) return [];
      return [{ t: "page.move", pageId: op.pageId, from, to: op.toIndex }];
    }

    // --- OCR ------------------------------------------------------------------
    case "OCR_APPLY": {
      const before = state.ocrLayers[op.pageId] ?? null;
      return [{ t: "ocr.set", pageId: op.pageId, before, after: op.layer }];
    }

    // --- Grouped/transactional ------------------------------------------------
    case "BATCH": {
      // Reduce children against an *evolving* document so a later child sees the
      // effects of earlier ones (correct `before` capture and existence checks).
      let working = state;
      const changes: Change[] = [];
      for (const child of op.operations) {
        const childChanges = opToChanges(working, child);
        if (childChanges.length === 0) continue;
        changes.push(...childChanges);
        working = applyPatch(working, patchOf(working, op, childChanges));
      }
      return coalesceUpdates(changes);
    }

    default: {
      // Exhaustiveness guard: a new operation type must be handled above.
      const _never: never = op;
      void _never;
      return [];
    }
  }
}

/** Reduce an operation to an invertible patch against `state`. */
export function reduceOperation(state: DocumentState, op: EditOperation): Patch {
  return patchOf(state, op, opToChanges(state, op));
}
