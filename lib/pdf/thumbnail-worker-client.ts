/**
 * Main-thread client for the OffscreenCanvas thumbnail worker (`thumbnail-worker.ts`).
 *
 * Each renderer owns one dedicated Worker and one open document, mirroring the
 * editor export client's pattern (`editor/export/worker-client.ts`): spawn on
 * open, terminate on dispose, so a failure in one renderer never affects others.
 *
 * Object URLs are deliberately *not* created here — the worker returns Blobs and
 * the caller mints (and later revokes) the URLs, keeping the existing URL
 * lifecycle ownership unchanged.
 *
 * Usage:
 *   const r = await openThumbnailRenderer(await file.arrayBuffer());
 *   await r.renderAll({ targetWidth: 170, onPage: ({ index, blob }) => … });
 *   r.dispose();
 */

export interface RenderedThumb {
  blob: Blob;
  width: number;
  height: number;
}

export interface RenderOptions {
  /** Thumbnail width in CSS px; height follows the page aspect ratio. */
  targetWidth?: number;
  /** JPEG quality, 0–1. */
  quality?: number;
}

export interface RenderAllOptions extends RenderOptions {
  /** Called once per page as it finishes, in page order. */
  onPage: (page: RenderedThumb & { index: number }) => void;
}

export interface ThumbnailRenderer {
  /** Page count of the opened document. */
  readonly numPages: number;
  /** Render a single page to a JPEG Blob (lazy / on-demand). */
  renderPage(pageIndex: number, opts?: RenderOptions): Promise<RenderedThumb>;
  /** Render every page, streaming each result through `onPage` as it completes. */
  renderAll(opts: RenderAllOptions): Promise<void>;
  /** Terminate the worker and release the document. Idempotent. */
  dispose(): void;
}

/** True when the browser can run the worker path (Worker + OffscreenCanvas). */
export function thumbnailWorkerSupported(): boolean {
  return typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined";
}

const DEFAULT_TARGET_WIDTH = 150;
const DEFAULT_QUALITY = 0.72;

type OutMessage =
  | { type: "opened"; id: number; numPages: number }
  | { type: "page"; id: number; index: number; blob: Blob; width: number; height: number }
  | { type: "allDone"; id: number; count: number }
  | { type: "error"; id: number; message: string };

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  /** Present for `renderAll`: receives each page; resolution waits for `allDone`. */
  onPage?: (page: RenderedThumb & { index: number }) => void;
}

/**
 * Open a PDF in a fresh worker and return a renderer handle. The `source`
 * buffer is transferred to the worker, so the caller must not reuse it
 * afterwards (pass a copy if it's still needed on the main thread).
 */
export async function openThumbnailRenderer(source: ArrayBuffer): Promise<ThumbnailRenderer> {
  const worker = new Worker(new URL("./thumbnail-worker.ts", import.meta.url), { type: "module" });
  const pending = new Map<number, PendingRequest>();
  let seq = 0;
  let disposed = false;

  const failAll = (error: unknown): void => {
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  };

  worker.addEventListener("message", (ev: MessageEvent) => {
    const data = ev.data as OutMessage;
    const entry = pending.get(data.id);
    if (!entry) return;
    switch (data.type) {
      case "opened":
        pending.delete(data.id);
        entry.resolve(data.numPages);
        break;
      case "page":
        if (entry.onPage) {
          entry.onPage({ index: data.index, blob: data.blob, width: data.width, height: data.height });
        } else {
          pending.delete(data.id);
          entry.resolve({ blob: data.blob, width: data.width, height: data.height });
        }
        break;
      case "allDone":
        pending.delete(data.id);
        entry.resolve(undefined);
        break;
      case "error":
        pending.delete(data.id);
        entry.reject(new Error(data.message));
        break;
    }
  });

  worker.addEventListener("error", (ev: ErrorEvent) => {
    failAll(new Error(ev.message || "Thumbnail worker crashed."));
  });

  function request<T>(
    message: Record<string, unknown>,
    transfer?: Transferable[],
    onPage?: PendingRequest["onPage"],
  ): Promise<T> {
    if (disposed) return Promise.reject(new Error("Thumbnail renderer was disposed."));
    const id = ++seq;
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onPage });
      worker.postMessage({ ...message, id }, transfer ?? []);
    });
  }

  const numPages = await request<number>({ type: "open", source }, [source]);

  return {
    numPages,
    renderPage(pageIndex, opts) {
      return request<RenderedThumb>({
        type: "renderPage",
        pageIndex,
        targetWidth: opts?.targetWidth ?? DEFAULT_TARGET_WIDTH,
        quality: opts?.quality ?? DEFAULT_QUALITY,
      });
    },
    renderAll(opts) {
      return request<void>(
        {
          type: "renderAll",
          targetWidth: opts.targetWidth ?? DEFAULT_TARGET_WIDTH,
          quality: opts.quality ?? DEFAULT_QUALITY,
        },
        undefined,
        opts.onPage,
      );
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      worker.terminate();
      failAll(new Error("Thumbnail renderer was disposed."));
    },
  };
}
