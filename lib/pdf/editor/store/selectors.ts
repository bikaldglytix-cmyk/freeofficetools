/**
 * Selectors over the normalized document state.
 *
 * Performance is the whole point of this file. Because `applyPatch` only ever
 * replaces the references of the *one* page it touched (see `patch/apply.ts`),
 * we can memoize per-page selectors on those references with a `WeakMap`:
 *
 *   - Edit page 7 → only page 7's `objectsByPage` / `objectOrder` arrays get new
 *     references, so only page 7's `selectPageObjects` recomputes.
 *   - The other 999 pages return their previously-cached arrays by identity, so
 *     React's `useSyncExternalStore` sees `Object.is`-equal results and skips
 *     re-rendering them. This is what makes 1000-page / 100k-object docs viable.
 *
 * Selectors take the raw `DocumentState` (not the store) so they're trivially
 * unit-testable and reusable by non-React code (export, OCR workers, etc.).
 */
import { isAnnotation, isImageObject, isRedaction, isSignature, isTextBlock } from "../model/guards";
import type {
  AnnotationObject,
  DocumentState,
  EditableObject,
  ImageObject,
  ObjectId,
  OCRLayer,
  PageId,
  PDFPageModel,
  RedactionObject,
  SignatureObject,
  TextBlock,
} from "../model/types";

const EMPTY_OBJECTS: readonly EditableObject[] = Object.freeze([]);
const EMPTY_PAGES: readonly PDFPageModel[] = Object.freeze([]);
const EMPTY_IDS: readonly PageId[] = Object.freeze([]);

// ---------------------------------------------------------------------------
// Document-level (cheap; no memo needed)
// ---------------------------------------------------------------------------

export const selectMeta = (s: DocumentState) => s.meta;
export const selectPageOrder = (s: DocumentState): readonly PageId[] => s.pageOrder;
export const selectPageCount = (s: DocumentState): number => s.pageOrder.length;
export const selectPage = (s: DocumentState, pageId: PageId): PDFPageModel | undefined =>
  s.pages[pageId];
export const selectOcrLayer = (s: DocumentState, pageId: PageId): OCRLayer | undefined =>
  s.ocrLayers[pageId];

/** Pages in display order. Memoized on `pages` + `pageOrder` references. */
export const selectPagesInOrder = createMemo2(
  (s: DocumentState) => s.pages,
  (s: DocumentState) => s.pageOrder,
  (pages, order): readonly PDFPageModel[] => {
    if (order.length === 0) return EMPTY_PAGES;
    const out: PDFPageModel[] = [];
    for (const id of order) {
      const p = pages[id];
      if (p) out.push(p);
    }
    return out;
  },
);

// ---------------------------------------------------------------------------
// Per-page objects (the hot path) — memoized by page sub-map identity
// ---------------------------------------------------------------------------

const pageObjectsCache = new WeakMap<
  Record<ObjectId, EditableObject>,
  WeakMap<ObjectId[], readonly EditableObject[]>
>();

/**
 * Objects on a page in z-order (ascending zIndex). O(n) once per edit to that
 * page, then O(1) cache hits until the page changes again.
 */
export function selectPageObjects(s: DocumentState, pageId: PageId): readonly EditableObject[] {
  const objs = s.objectsByPage[pageId];
  const order = s.objectOrder[pageId];
  if (!objs || !order) return EMPTY_OBJECTS;

  let inner = pageObjectsCache.get(objs);
  if (!inner) {
    inner = new WeakMap();
    pageObjectsCache.set(objs, inner);
  }
  const cached = inner.get(order);
  if (cached) return cached;

  const result: EditableObject[] = [];
  for (const id of order) {
    const o = objs[id];
    if (o) result.push(o);
  }
  const frozen = Object.freeze(result);
  inner.set(order, frozen);
  return frozen;
}

export function selectObject(
  s: DocumentState,
  pageId: PageId,
  id: ObjectId,
): EditableObject | undefined {
  return s.objectsByPage[pageId]?.[id];
}

export function selectObjectCount(s: DocumentState, pageId: PageId): number {
  return s.objectOrder[pageId]?.length ?? 0;
}

// Kind-filtered views (memoized off the ordered list, so they ride the same
// per-page invalidation as `selectPageObjects`).
const kindCache = new WeakMap<readonly EditableObject[], Map<string, readonly EditableObject[]>>();

function selectByKind<T extends EditableObject>(
  s: DocumentState,
  pageId: PageId,
  kind: string,
  guard: (o: EditableObject) => o is T,
): readonly T[] {
  const all = selectPageObjects(s, pageId);
  if (all.length === 0) return EMPTY_OBJECTS as readonly T[];
  let byKind = kindCache.get(all);
  if (!byKind) {
    byKind = new Map();
    kindCache.set(all, byKind);
  }
  const hit = byKind.get(kind);
  if (hit) return hit as readonly T[];
  const filtered = Object.freeze(all.filter(guard)) as readonly T[];
  byKind.set(kind, filtered);
  return filtered;
}

export const selectTextBlocks = (s: DocumentState, pageId: PageId): readonly TextBlock[] =>
  selectByKind(s, pageId, "text", isTextBlock);
export const selectImages = (s: DocumentState, pageId: PageId): readonly ImageObject[] =>
  selectByKind(s, pageId, "image", isImageObject);
export const selectAnnotations = (s: DocumentState, pageId: PageId): readonly AnnotationObject[] =>
  selectByKind(s, pageId, "annotation", isAnnotation);
export const selectSignatures = (s: DocumentState, pageId: PageId): readonly SignatureObject[] =>
  selectByKind(s, pageId, "signature", isSignature);
export const selectRedactions = (s: DocumentState, pageId: PageId): readonly RedactionObject[] =>
  selectByKind(s, pageId, "redaction", isRedaction);

// ---------------------------------------------------------------------------
// Document-wide stats (used by the perf/HUD and tests)
// ---------------------------------------------------------------------------

export interface DocumentStats {
  pages: number;
  objects: number;
  byKind: Record<string, number>;
}

export function selectStats(s: DocumentState): DocumentStats {
  const byKind: Record<string, number> = {};
  let objects = 0;
  for (const pageId of s.pageOrder) {
    const map = s.objectsByPage[pageId];
    if (!map) continue;
    for (const id in map) {
      const o = map[id];
      objects++;
      byKind[o.kind] = (byKind[o.kind] ?? 0) + 1;
    }
  }
  return { pages: s.pageOrder.length, objects, byKind };
}

export function selectAllPageIds(s: DocumentState | null): readonly PageId[] {
  return s ? s.pageOrder : EMPTY_IDS;
}

// ---------------------------------------------------------------------------
// Tiny memo helper: caches the last result keyed by two input references.
// ---------------------------------------------------------------------------

function createMemo2<A extends object, B extends object, R>(
  inputA: (s: DocumentState) => A,
  inputB: (s: DocumentState) => B,
  compute: (a: A, b: B) => R,
): (s: DocumentState) => R {
  const cache = new WeakMap<A, WeakMap<B, R>>();
  return (s: DocumentState): R => {
    const a = inputA(s);
    const b = inputB(s);
    let inner = cache.get(a);
    if (!inner) {
      inner = new WeakMap();
      cache.set(a, inner);
    }
    if (inner.has(b)) return inner.get(b) as R;
    const r = compute(a, b);
    inner.set(b, r);
    return r;
  };
}
