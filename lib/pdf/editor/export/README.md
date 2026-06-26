# Export Engine — Phase 5

Converts the canonical `DocumentState` (Phase 2) **+** the original source PDF
bytes into a final, downloadable PDF. It consumes the **model**, never the DOM or
UI state, so the exact same code runs in the browser, a Web Worker, a Node test,
or a route handler. Primary writer: **pdf-lib** (free, pure-JS).

```
ExportManager ──enqueue/exportNow──▶ ExportPipeline ──▶ Uint8Array (+ Blob)
     │ jobs · progress · cancel · retries · history · events
     ▼
  EditorEventBus  EXPORT_STARTED / EXPORT_FINISHED / EXPORT_FAILED
```

## Pipeline stages

`load → validate → pages → whiteout → (content in z-order) → ocr → metadata →
optimize → verify`

Within a page, content objects (text / image / annotation / signature) are painted
in the model's **z-order** (whiteout & redaction masks first, the invisible OCR
layer last) so the user's intended stacking is preserved. The named stages remain
the unit of progress reporting and the boundaries of the modular services.

## Modules

| File | Responsibility |
| --- | --- |
| `manager.ts` | `ExportManager` — async jobs: queue, progress, cancel, retries, history, bus events |
| `pipeline.ts` | `ExportPipeline` — orchestrates the stages over one document |
| `pdf-writer.ts` | `PDFWriter` — owns the pdf-lib doc, source doc, image/font embed caches, `save` |
| `page-operations.ts` | `PageOperations` — insert/delete/duplicate/reorder/rotate/crop from the model |
| `overlay-renderer.ts` | `OverlayRenderer` — whiteout/restamp masks + redaction boxes |
| `text-renderer.ts` | `TextRenderer` — added/edited text: wrap, align, color, opacity, rotation, runs |
| `image-renderer.ts` | `ImageRenderer` — PNG/JPEG (+ canvas-transcoded WEBP), transform, transparency |
| `annotation-flattener.ts` | `AnnotationFlattener` — highlight/note/ink/shape/arrow/stamp |
| `signature-renderer.ts` | `SignatureRenderer` — drawn / typed / image signatures |
| `ocr-export.ts` | `OcrExporter` — searchable (invisible by default) OCR text layer |
| `metadata-writer.ts` | `MetadataWriter` — title/author/subject/keywords/dates/producer |
| `validation.ts` | `ValidationService` — pre-flight diagnostics (refs, geometry, resources) |
| `geometry.ts` / `color.ts` / `fonts.ts` | Coordinate + rotation mapping, color parsing, font matching |
| `worker.ts` / `worker-client.ts` | Off-main-thread export with an automatic in-thread fallback |
| `integration.ts` | `exportCurrentDocument` / `exportAndDownload` / `triggerDownload` |

## Usage

```ts
import { ExportManager, triggerDownload } from "@/lib/pdf/editor/export";
import { documentStore } from "@/lib/pdf/editor";

const mgr = new ExportManager({ events: documentStore.getState().events });

// Fire-and-await:
const result = await mgr.exportNow({ document, source: originalBytes });
triggerDownload(result);

// Async job with progress + cancel:
const { id, done } = mgr.enqueue({ document, source: originalBytes, options: { flatten: "flatten" } });
const unsub = mgr.subscribe((job) => render(job.progress, job.stage));
const result2 = await done;
unsub();

// Off the main thread (large docs):
import { createWorkerExporter } from "@/lib/pdf/editor/export";
const r = await createWorkerExporter().run({ document, source }, { onProgress });
```

HTTP (opt-in, server-side — see "Privacy" below):
`POST /api/pdf/export`, `GET /api/pdf/export`, `GET /api/pdf/export/:id`,
`GET /api/pdf/export/:id/download`.

## Privacy / where it runs

The product is privacy-first: **export runs client-side by default** and document
bytes never leave the device. The `app/api/pdf/export/*` routes exist for explicit
server-side / batch / automation use where the caller *chooses* to upload the
model + source bytes; they reuse the same `ExportPipeline`.

## Quality targets & free-library limitations

Targets: business docs / forms / contracts **95%+** visual fidelity, scanned docs
**90%+**, with **deterministic** output (fixed dates, no entropy) for regression
tests — see the deterministic test in `export.test.ts`.

Unedited original page content is **copied** from the source PDF, so it is
preserved at 100% (fonts, vectors, images). The following are inherent limits of
the free pure-JS stack and are handled explicitly (diagnostics, not crashes):

- **Fonts** — added/edited text uses the 14 PDF Standard Fonts (Helvetica / Times
  / Courier). Non-standard families map to the closest standard family; glyphs
  outside WinAnsi (CJK, most emoji) become `?` with a `FONT_GLYPH` diagnostic. Add
  `@pdf-lib/fontkit` and embed real font bytes to lift this (`fonts.ts` is the seam).
- **Redaction** — pdf-lib can only paint over content, not remove it. A redaction
  box is visually opaque but underlying text may remain extractable; a
  `REDACTION_VISUAL_ONLY` diagnostic is emitted. True redaction needs page
  rasterization or a content-stream rewriter.
- **Password / encryption** — pdf-lib cannot write encrypted PDFs. A requested
  password yields an `ENCRYPTION_UNSUPPORTED` diagnostic and an unencrypted file.
- **WEBP/GIF images** — transcoded to PNG/JPEG via canvas in the browser/Worker;
  unavailable in pure Node (`IMAGE_UNSUPPORTED` diagnostic). PNG/JPEG always work.
- **Interactive annotations** — `flatten: "keep"` still flattens (pdf-lib can't
  reliably author editable widgets); `ANNOTATIONS_FLATTENED` is emitted.

## Error recovery

Per-object render failures are caught, recorded as warnings, and skipped so one
bad object never sinks a large export. Fatal problems (no pages, failed
validation, unreadable source) abort with a structured `ExportError`. The manager
retries transient failures (not validation) up to `maxRetries`.

## Performance

Pages are processed one at a time (bounded peak memory for 1000-page docs); images
and fonts are embedded once and cached across pages; `AbortSignal` is checked at
every page boundary; `worker.ts` moves the work off the UI thread; `save({
useObjectStreams })` compresses output.

## Tests

`npm run test -- lib/pdf/editor/export` — geometry/rotation, color, validation,
page ops (reorder/duplicate/rotate), all object kinds, whiteout, metadata,
deterministic output, cancellation, progress monotonicity, and a 50-page perf
smoke test, all with real pdf-lib round-trips.
