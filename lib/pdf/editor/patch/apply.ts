/**
 * Applying & inverting patches with structural sharing.
 *
 * Performance: `applyPatch` shallow-clones only the top-level maps (O(pages),
 * ≤ ~1000) once, then lazily clones the *one* page sub-map each change touches.
 * A single object edit therefore copies one page's objects, never the whole
 * document — the key to handling 100k+ objects. Untouched pages keep their
 * exact references, so memoized selectors below them never recompute.
 */
import type { DocumentState, EditableObject, PageId } from "../model/types";
import type { Change, Patch } from "./types";

/** Mutable working copy used during a single applyPatch pass. */
type Draft = DocumentState;

function shallowTop(state: DocumentState): Draft {
  return {
    meta: state.meta,
    pageOrder: state.pageOrder,
    pages: { ...state.pages },
    objectsByPage: { ...state.objectsByPage },
    objectOrder: { ...state.objectOrder },
    ocrLayers: { ...state.ocrLayers },
  };
}

function sortPageOrder(draft: Draft, pageId: PageId): void {
  const ids = draft.objectOrder[pageId];
  const objects = draft.objectsByPage[pageId];
  if (!ids || !objects) return;
  ids.sort((a, b) => {
    const oa = objects[a];
    const ob = objects[b];
    if (!oa || !ob) return 0;
    if (oa.zIndex !== ob.zIndex) return oa.zIndex - ob.zIndex;
    return oa.createdAt - ob.createdAt;
  });
}

/**
 * Apply one change to the draft. `clonePage` ensures the touched page's object
 * map + order array are cloned exactly once per pass before mutation.
 */
function applyChange(draft: Draft, change: Change, clonePage: (pageId: PageId) => void): void {
  switch (change.t) {
    case "obj.add": {
      clonePage(change.pageId);
      draft.objectsByPage[change.pageId][change.object.id] = change.object;
      draft.objectOrder[change.pageId].push(change.object.id);
      sortPageOrder(draft, change.pageId);
      return;
    }
    case "obj.remove": {
      clonePage(change.pageId);
      delete draft.objectsByPage[change.pageId][change.object.id];
      draft.objectOrder[change.pageId] = draft.objectOrder[change.pageId].filter(
        (id) => id !== change.object.id,
      );
      return;
    }
    case "obj.update": {
      clonePage(change.pageId);
      const current = draft.objectsByPage[change.pageId][change.id];
      if (!current) return;
      const merged = { ...current, ...change.after } as EditableObject;
      draft.objectsByPage[change.pageId][change.id] = merged;
      if ("zIndex" in change.after) sortPageOrder(draft, change.pageId);
      return;
    }
    case "page.insert": {
      draft.pages = { ...draft.pages, [change.page.id]: change.page };
      const order = [...draft.pageOrder];
      order.splice(clampIndex(change.index, order.length), 0, change.page.id);
      draft.pageOrder = order;
      const objMap: Record<string, EditableObject> = {};
      const objOrder: string[] = [];
      for (const obj of change.objects) {
        objMap[obj.id] = obj;
        objOrder.push(obj.id);
      }
      draft.objectsByPage[change.page.id] = objMap;
      draft.objectOrder[change.page.id] = objOrder;
      draft.ocrLayers[change.page.id] = change.ocr ?? undefined;
      sortPageOrder(draft, change.page.id);
      return;
    }
    case "page.remove": {
      const pid = change.page.id;
      draft.pageOrder = draft.pageOrder.filter((id) => id !== pid);
      // `draft`'s top-level maps are shallow copies (see shallowTop), so deleting
      // keys here removes the page without ever mutating the previous state.
      delete draft.pages[pid];
      delete draft.objectsByPage[pid];
      delete draft.objectOrder[pid];
      delete draft.ocrLayers[pid];
      return;
    }
    case "page.move": {
      const order = [...draft.pageOrder];
      const from = order.indexOf(change.pageId);
      if (from === -1) return;
      order.splice(from, 1);
      order.splice(clampIndex(change.to, order.length), 0, change.pageId);
      draft.pageOrder = order;
      return;
    }
    case "ocr.set": {
      draft.ocrLayers = { ...draft.ocrLayers, [change.pageId]: change.after ?? undefined };
      return;
    }
    case "meta.update": {
      draft.meta = { ...draft.meta, ...change.after };
      return;
    }
  }
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length));
}

/** Apply a patch, returning a new document state (structural sharing). */
export function applyPatch(state: DocumentState, patch: Patch): DocumentState {
  const draft = shallowTop(state);
  const cloned = new Set<PageId>();
  const clonePage = (pageId: PageId) => {
    if (cloned.has(pageId)) return;
    draft.objectsByPage[pageId] = { ...(draft.objectsByPage[pageId] ?? {}) };
    draft.objectOrder[pageId] = [...(draft.objectOrder[pageId] ?? [])];
    cloned.add(pageId);
  };
  for (const change of patch.changes) applyChange(draft, change, clonePage);
  // Touch updatedAt so persistence/autosave see the document as dirty.
  draft.meta = { ...draft.meta, updatedAt: patch.timestamp };
  return draft;
}

/** Invert a single change so applying the result undoes the original. */
export function invertChange(change: Change): Change {
  switch (change.t) {
    case "obj.add":
      return { t: "obj.remove", pageId: change.pageId, object: change.object };
    case "obj.remove":
      return { t: "obj.add", pageId: change.pageId, object: change.object };
    case "obj.update":
      return {
        t: "obj.update",
        pageId: change.pageId,
        id: change.id,
        before: change.after,
        after: change.before,
      };
    case "page.insert":
      return { t: "page.remove", index: change.index, page: change.page, objects: change.objects, ocr: change.ocr };
    case "page.remove":
      return { t: "page.insert", index: change.index, page: change.page, objects: change.objects, ocr: change.ocr };
    case "page.move":
      return { t: "page.move", pageId: change.pageId, from: change.to, to: change.from };
    case "ocr.set":
      return { t: "ocr.set", pageId: change.pageId, before: change.after, after: change.before };
    case "meta.update":
      return { t: "meta.update", before: change.after, after: change.before };
  }
}

/** Invert a whole patch (reverse order so dependent changes unwind correctly). */
export function invertPatch(patch: Patch): Patch {
  return {
    ...patch,
    changes: [...patch.changes].reverse().map(invertChange),
  };
}

/** Apply a patch's inverse — the undo primitive. */
export function revertPatch(state: DocumentState, patch: Patch): DocumentState {
  return applyPatch(state, invertPatch(patch));
}
