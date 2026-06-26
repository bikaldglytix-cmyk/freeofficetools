/**
 * Patch composition utilities.
 *
 *  - `mergePatches` squashes a sequence of patches into one (used to turn a
 *    grouped/transactional set of operations into a single undo step).
 *  - `coalesceUpdates` collapses consecutive updates to the same object —
 *    e.g. a drag that emits dozens of MOVE operations becomes one patch with
 *    one undo step, keeping the *earliest* `before` and *latest* `after`.
 */
import { newPatchId } from "../model/ids";
import type { Change, Patch } from "./types";

export function mergePatches(patches: Patch[], actor?: string): Patch {
  const changes: Change[] = [];
  for (const p of patches) changes.push(...p.changes);
  const last = patches[patches.length - 1];
  return {
    id: newPatchId(),
    schemaVersion: last?.schemaVersion ?? 1,
    timestamp: last?.timestamp ?? Date.now(),
    actor: actor ?? last?.actor,
    changes: coalesceUpdates(changes),
  };
}

/**
 * Merge runs of `obj.update` to the same object. Only collapses an update into
 * the immediately preceding one for that object when no other change to that
 * object intervened, preserving correctness of before/after windows.
 */
export function coalesceUpdates(changes: Change[]): Change[] {
  const out: Change[] = [];
  // Track index in `out` of the last update per object id.
  const lastUpdateIndex = new Map<string, number>();

  for (const change of changes) {
    if (change.t === "obj.update") {
      const prevIdx = lastUpdateIndex.get(change.id);
      if (prevIdx !== undefined) {
        const prev = out[prevIdx];
        if (prev.t === "obj.update") {
          out[prevIdx] = {
            t: "obj.update",
            pageId: prev.pageId,
            id: prev.id,
            before: { ...change.before, ...prev.before }, // keep earliest values
            after: { ...prev.after, ...change.after }, // keep latest values
          };
          continue;
        }
      }
      out.push(change);
      lastUpdateIndex.set(change.id, out.length - 1);
    } else {
      // Any non-update change to an object breaks the coalescing window.
      if (change.t === "obj.add" || change.t === "obj.remove") {
        lastUpdateIndex.delete(change.object.id);
      }
      out.push(change);
    }
  }
  return out;
}

/** True when a patch makes no changes (used to skip empty undo entries). */
export function isEmptyPatch(patch: Patch): boolean {
  return patch.changes.length === 0;
}
