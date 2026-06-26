# PDF Editor — Document State Engine (Phase 2)

The single source of truth for every editing operation: text, images, annotations,
OCR layers, signatures, redactions, page operations, undo/redo, persistence and
(eventually) the export pipeline and collaboration.

Everything here is **100% client-side** (no backend, per the product's privacy
guarantee) and **framework-free** except the thin React hook layer in `store/hooks.ts`.

---

## 1. Layers

```
operations ──reduce──▶ patch ──apply──▶ state          (the write path)
    ▲                    │                 │
  ops()                  │ invert          │ selectors (memoized)
  builders               ▼                 ▼
  UI / shortcuts     history (undo/redo)   viewer · annotations · OCR · export
                         │
                    persistence (drafts · revisions · autosave)
                         ▲
                       events (typed bus + middleware)  ◀── everyone subscribes
```

| Dir            | Responsibility                                                        |
| -------------- | -------------------------------------------------------------------- |
| `model/`       | Canonical normalized document, factories, type guards, id generation |
| `operations/`  | Strongly-typed edit intents (`ops.*`) + the reducer (op → patch)      |
| `patch/`       | Invertible patches: `applyPatch` / `revertPatch` / `mergePatches`    |
| `history/`     | Pure undo/redo stacks (O(1))                                          |
| `store/`       | Zustand store, memoized selectors, React hooks                       |
| `events/`      | Typed event bus with middleware                                      |
| `persistence/` | Versioned drafts, revisions, autosave, migrations (IndexedDB)        |
| `integration/` | Adapters to the Phase 1 viewer                                       |

Import everything from the barrel `@/lib/pdf/editor` (React hooks come from
`@/lib/pdf/editor/store/hooks` so the barrel stays safe for Node/worker code).

---

## 2. The canonical model (`model/types.ts`)

The document is **normalized and sharded by page**:

```ts
interface DocumentState {
  meta: DocumentMeta;
  pageOrder: PageId[];                                   // ordering only
  pages: Record<PageId, PDFPageModel>;
  objectsByPage: Record<PageId, Record<ObjectId, EditableObject>>;  // sharded
  objectOrder: Record<PageId, ObjectId[]>;              // z-order per page
  ocrLayers: Record<PageId, OCRLayer | undefined>;
}
```

`EditableObject` is a discriminated union — `TextBlock | ImageObject |
AnnotationObject | SignatureObject | RedactionObject` — all extending a
`BaseObject` carrying `id`, `pageId`, `rect`, `transform`, `zIndex`, `opacity`,
timestamps, `createdBy`/`updatedBy` (collaboration-ready) and free-form
`metadata`. All geometry is in **PDF points, top-left origin** — resolution
independent and export-friendly.

Always build objects through the factories so invariants hold:

```ts
import { createTextBlock } from "@/lib/pdf/editor";
const block = createTextBlock({ pageId, rect: { x, y, width, height }, text: "Hi" });
```

---

## 3. The write path: operations → patches → state

UI code never mutates the document. It dispatches an **operation**; the reducer
turns it into an **invertible patch**; the store **applies** it.

```ts
import { ops } from "@/lib/pdf/editor";
import { useDispatch } from "@/lib/pdf/editor/store/hooks";

const dispatch = useDispatch();
dispatch(ops.addText(pageId, block));
dispatch(ops.updateText(pageId, block.id, { fontSize: 18 }));
dispatch(ops.moveImage(pageId, imgId, newRect));
dispatch(ops.deleteAnnotation(pageId, annId));
```

A `Patch` captures enough state to invert itself with no replay (`before`/`after`
for updates, the full object for deletes, the page index for page removals) — the
key to **O(1) undo** and to portability across clients.

Group many ops into **one undo step**:

```ts
// One-shot:
dispatchAll([ops.addText(p, a), ops.addText(p, b)], "Paste");

// Interactive gesture (drag emits dozens of moves → still one undo step):
beginTransaction("drag");
onPointerMove(() => dispatch(ops.moveText(p, id, rect)));   // applies live
onPointerUp(() => commitTransaction());                    // coalesced + recorded
// or cancelTransaction() to roll the whole gesture back
```

---

## 4. Undo / redo

```ts
import { useUndoRedo, useEditorKeyboard } from "@/lib/pdf/editor/store/hooks";

function Toolbar() {
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  return <>
    <button onClick={undo} disabled={!canUndo}>Undo</button>
    <button onClick={redo} disabled={!canRedo}>Redo</button>
  </>;
}

function EditorRoot() {
  useEditorKeyboard();   // Ctrl/Cmd+Z, Ctrl+Shift+Z / Ctrl+Y (ignores text inputs)
  // ...
}
```

Undo reverts the newest patch (`revertPatch`) and pushes it onto the redo stack;
redo re-applies it. Both are O(1) in history size. A new dispatch clears redo.

---

## 5. Persistence (`persistence/`)

```ts
import { createAutosave } from "@/lib/pdf/editor";
import { documentStore } from "@/lib/pdf/editor/store/document-store";

// Debounced drafts to IndexedDB; flips `dirty` off + emits PERSIST_SAVED.
const autosave = createAutosave(documentStore, { debounceMs: 1500 }).start();
window.addEventListener("beforeunload", () => void autosave.saveNow());

// Crash/refresh recovery:
import { draftStore } from "@/lib/pdf/editor";
const recovered = await draftStore.loadDraft(documentId);
if (recovered) documentStore.getState().restoreSnapshot(recovered.document);

// Named revisions:
import { createRevision } from "@/lib/pdf/editor";
await draftStore.saveRevision(doc.meta.id, createRevision({ label: "Before redaction", snapshot: doc }));
```

Every write is wrapped in a **versioned envelope** and every read passes through
`migratePersisted`, so old drafts keep opening as the schema evolves
(`persistence/migrations.ts` documents the migration shape). Storage is pluggable
(`KVBackend`): IndexedDB in the browser, an in-memory backend for tests/SSR.

---

## 6. Events (`events/`)

A typed, decoupled bus is how everything else reacts to edits.

```ts
import { useEditorEvent } from "@/lib/pdf/editor/store/hooks";

useEditorEvent("ANNOTATION_CREATED", ({ pageId, id }) => focusAnnotation(pageId, id));
useEditorEvent("HISTORY_CHANGED", ({ canUndo, canRedo }) => updateToolbar(canUndo, canRedo));

// Middleware (logging, throttling, future collab op-log):
documentStore.getState().events.use((event, next) => { log(event); next(); });
```

Events: `DOCUMENT_LOADED/CLOSED/CHANGED`, `OPERATION_DISPATCHED`,
`OBJECT_ADDED/UPDATED/REMOVED`, `TEXT_UPDATED`, `IMAGE_MOVED`,
`ANNOTATION_CREATED`, `PAGE_ADDED/REMOVED/MOVED`, `OCR_APPLIED`, `UNDO`, `REDO`,
`HISTORY_CHANGED`, `SELECTION_CHANGED`, `PERSIST_SAVED/RESTORED`,
`REVISION_CREATED`, `EXPORT_STARTED/FINISHED/FAILED`.

---

## 7. Performance — built for 1000 pages / 100k+ objects

1. **Normalized, sharded storage.** Objects live under `objectsByPage[pageId]`, so
   an edit only ever touches one page's data structures, never a global list.
2. **Structural sharing.** `applyPatch` shallow-clones the ~1000-entry top-level
   maps once, then clones only the *one* page sub-map each change touches. Every
   untouched page keeps its exact object references.
3. **Memoized selectors.** `selectPageObjects` caches its ordered array in a
   `WeakMap` keyed by the page's `objects`+`order` references. Because (2)
   preserves those references for untouched pages, 999 of 1000 pages return their
   cached array by identity → React's `useSyncExternalStore` skips re-rendering
   them. This is what makes large docs viable.
4. **O(1) undo/redo.** History stores patches, not snapshots — constant memory per
   edit and constant-time stepping.
5. **Lazy / coalesced updates.** A drag's dozens of `MOVE` ops collapse via
   `coalesceUpdates` into one patch (one undo step, one selector invalidation).
6. **Bounded history.** `historyLimit` (default 200) caps memory regardless of
   session length.

---

## 8. Integration

### 8.1 Viewer (Phase 1)

The viewer keeps rendering page bitmaps from its own `ViewerDocument`; the store
holds the editable overlay. Bridge them once at the root:

```ts
// components/pdf-editor/hooks/use-editor-document.ts (provided)
const viewer = useEditorDocument(file);   // loads viewer + mirrors into the store
```

`buildDocumentFromViewer` maps pdf.js scale-1 page sizes (1px == 1pt) into the
model. Pages share identity by `sourcePageIndex`; `pageIdForSourceIndex(doc, i)`
resolves a rendered page to its (possibly reordered) editable page id.

### 8.2 Annotation layer (Phase 3)

```ts
import { usePageObjects } from "@/lib/pdf/editor/store/hooks";
import { isAnnotation } from "@/lib/pdf/editor";

function AnnotationLayer({ pageId, zoom }: { pageId: string; zoom: number }) {
  const objects = usePageObjects(pageId);          // stable until this page changes
  return objects.filter(isAnnotation).map((a) => (
    <AnnotationView key={a.id} a={a} style={scaleRect(a.rect, zoom)} />
  ));
}
// create: dispatch(ops.addAnnotation(pageId, createAnnotation({ pageId, rect, annotationType: "highlight" })));
```

### 8.3 OCR (Phase 4/OCR)

Run OCR in a worker, then commit the result as one operation:

```ts
const layer = createOCRLayer({ pageId, engine: "tesseract.js", words });
dispatch(ops.ocrApply(pageId, layer));   // emits OCR_APPLIED; undoable
```

### 8.4 Export engine (Phase 5)

Export consumes patches/state, not the DOM. It can either replay the patch log or
walk the final `DocumentState`:

```ts
const doc = documentStore.getState().document!;
events.emit("EXPORT_STARTED", { documentId: doc.meta.id });
for (const pageId of doc.pageOrder) {
  for (const obj of selectPageObjects(doc, pageId)) stampWithPdfLib(obj); // points → flip Y
}
events.emit("EXPORT_FINISHED", { documentId: doc.meta.id, byteLength });
```

Patches make incremental export possible: each `Change` says exactly what differs
from the source PDF (added text, redactions, moved pages…).

### 8.5 Collaboration (future)

The model is already collaboration-ready: operations are immutable, serializable
and actor-stamped; patches are portable. A transport subscribes to
`OPERATION_DISPATCHED`, broadcasts the patch, and applies remote patches via
`applyPatch` — with the event bus's middleware as the natural place for an
OT/CRDT reconciliation layer. No schema changes required.

---

## 9. Tests

`npm run test` (Vitest, Node env) covers factories, the reducer, patch
apply/invert/structural-sharing, merge/coalesce, the store (dispatch, undo/redo,
transactions, selection, events), the event bus (middleware, error isolation),
and persistence (draft round-trips, revisions, migrations, autosave).
