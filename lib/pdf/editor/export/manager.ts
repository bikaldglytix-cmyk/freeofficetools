/**
 * ExportManager — the high-level, app-facing entry point. Wraps the
 * {@link ExportPipeline} with asynchronous jobs: a bounded queue, progress
 * reporting, cancellation, retries, and an in-memory history. It bridges into the
 * editor's typed event bus (EXPORT_STARTED / EXPORT_FINISHED / EXPORT_FAILED) so
 * the rest of the app reacts to exports the same way it reacts to edits.
 *
 * This is the "API" in a 100%-client-side product: the heavy PDF work happens in
 * the browser (or a Web Worker — see `worker.ts`) to honor the privacy guarantee
 * that document bytes never leave the device. The optional Next.js route handlers
 * in `app/api/export/*` mirror this surface for non-sensitive metadata only.
 *
 * Usage:
 *   const mgr = new ExportManager({ events: store.events });
 *   const { id } = mgr.enqueue({ document, source, options: { flatten: "flatten" } });
 *   mgr.subscribe((job) => updateUi(job));
 *   // or, fire-and-await a single export:
 *   const result = await mgr.exportNow({ document, source });
 */
import type { EditorEventBus } from "../events/types";
import { newId } from "../model/ids";
import { ExportCancelled, ExportError, errorMessage } from "./errors";
import { ExportPipeline } from "./pipeline";
import type { ExportInput, ExportJob, ExportResult, ExportStage } from "./types";

export interface ExportManagerOptions {
  events?: EditorEventBus | null;
  pipeline?: ExportPipeline;
  /** Max jobs running at once. Default 1 (PDF work is CPU-bound on one thread). */
  concurrency?: number;
  /** Max retry attempts for transient failures (not cancellations). Default 1. */
  maxRetries?: number;
  /** Max finished jobs kept in history. Default 25. */
  historyLimit?: number;
}

type JobListener = (job: ExportJob) => void;

interface InternalJob {
  job: ExportJob;
  input: ExportInput;
  controller: AbortController;
  attempts: number;
  resolve: (r: ExportResult) => void;
  reject: (e: unknown) => void;
}

export class ExportManager {
  private readonly events: EditorEventBus | null;
  private readonly pipeline: ExportPipeline;
  private readonly concurrency: number;
  private readonly maxRetries: number;
  private readonly historyLimit: number;

  private readonly jobs = new Map<string, InternalJob>();
  private readonly queue: string[] = [];
  private running = 0;
  private readonly listeners = new Set<JobListener>();

  constructor(opts: ExportManagerOptions = {}) {
    this.events = opts.events ?? null;
    this.pipeline = opts.pipeline ?? new ExportPipeline();
    this.concurrency = Math.max(1, opts.concurrency ?? 1);
    this.maxRetries = Math.max(0, opts.maxRetries ?? 1);
    this.historyLimit = Math.max(1, opts.historyLimit ?? 25);
  }

  /** Run a single export to completion (no queue). Throws on failure. */
  async exportNow(input: ExportInput): Promise<ExportResult> {
    const documentId = input.document.meta.id;
    this.events?.emit("EXPORT_STARTED", { documentId });
    try {
      const result = await this.pipeline.run(withProgress(input, undefined));
      this.events?.emit("EXPORT_FINISHED", { documentId, byteLength: result.byteLength });
      return result;
    } catch (err) {
      this.events?.emit("EXPORT_FAILED", { documentId, error: errorMessage(err) });
      throw err;
    }
  }

  /** Queue an export. Returns a job handle + a promise that settles with the result. */
  enqueue(input: ExportInput): { id: string; done: Promise<ExportResult> } {
    const id = newId("export");
    const controller = new AbortController();
    let resolve!: (r: ExportResult) => void;
    let reject!: (e: unknown) => void;
    const done = new Promise<ExportResult>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const job: ExportJob = {
      id,
      documentId: input.document.meta.id,
      status: "queued",
      progress: 0,
      stage: null,
      createdAt: Date.now(),
      diagnostics: [],
    };
    this.jobs.set(id, { job, input, controller, attempts: 0, resolve, reject });
    this.queue.push(id);
    this.emit(job);
    void this.pump();
    return { id, done };
  }

  getJob(id: string): ExportJob | undefined {
    return this.jobs.get(id)?.job;
  }

  /** All jobs (queued + running + finished), newest first. */
  history(): ExportJob[] {
    return [...this.jobs.values()].map((j) => j.job).sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Cancel a queued or running job. No-op if already finished. */
  cancel(id: string): boolean {
    const entry = this.jobs.get(id);
    if (!entry) return false;
    if (entry.job.status === "succeeded" || entry.job.status === "failed" || entry.job.status === "cancelled") {
      return false;
    }
    entry.controller.abort();
    if (entry.job.status === "queued") {
      // Not started yet — remove from queue and settle now.
      const qi = this.queue.indexOf(id);
      if (qi >= 0) this.queue.splice(qi, 1);
      this.finish(entry, "cancelled", undefined, new ExportCancelled());
    }
    return true;
  }

  /** Subscribe to job updates. Returns an unsubscribe fn. */
  subscribe(listener: JobListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // -------------------------------------------------------------------------

  private async pump(): Promise<void> {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const id = this.queue.shift()!;
      const entry = this.jobs.get(id);
      if (!entry || entry.job.status === "cancelled") continue;
      this.running++;
      void this.runJob(entry).finally(() => {
        this.running--;
        void this.pump();
      });
    }
  }

  private async runJob(entry: InternalJob): Promise<void> {
    entry.attempts++;
    entry.job.status = "running";
    entry.job.startedAt = Date.now();
    this.events?.emit("EXPORT_STARTED", { documentId: entry.job.documentId });
    this.emit(entry.job);

    const input = withProgress(entry.input, (progress, stage) => {
      entry.job.progress = progress;
      entry.job.stage = stage;
      this.emit(entry.job);
    });
    input.options = { ...input.options, signal: entry.controller.signal };

    try {
      const result = await this.pipeline.run(input);
      entry.job.diagnostics = result.diagnostics;
      this.finish(entry, "succeeded", result);
    } catch (err) {
      if (err instanceof ExportCancelled || entry.controller.signal.aborted) {
        this.finish(entry, "cancelled", undefined, err);
        return;
      }
      // Retry transient failures (e.g. flaky image fetch), but not validation.
      const retryable = !(err instanceof ExportError && err.code === "VALIDATION_FAILED");
      if (retryable && entry.attempts <= this.maxRetries) {
        entry.job.status = "queued";
        entry.job.progress = 0;
        entry.job.stage = null;
        this.emit(entry.job);
        this.queue.push(entry.job.id);
        return;
      }
      this.finish(entry, "failed", undefined, err);
    }
  }

  private finish(entry: InternalJob, status: ExportJob["status"], result?: ExportResult, err?: unknown): void {
    entry.job.status = status;
    entry.job.finishedAt = Date.now();
    if (status === "succeeded" && result) {
      entry.job.result = result;
      entry.job.progress = 1;
      entry.job.stage = "verify";
      this.events?.emit("EXPORT_FINISHED", { documentId: entry.job.documentId, byteLength: result.byteLength });
      entry.resolve(result);
    } else {
      entry.job.error = err ? errorMessage(err) : status;
      if (status !== "cancelled") {
        this.events?.emit("EXPORT_FAILED", { documentId: entry.job.documentId, error: entry.job.error });
      }
      entry.reject(err ?? new ExportError("UNKNOWN", entry.job.error));
    }
    this.emit(entry.job);
    this.evictHistory();
  }

  private emit(job: ExportJob): void {
    const snapshot = { ...job, diagnostics: [...job.diagnostics] };
    for (const l of this.listeners) {
      try {
        l(snapshot);
      } catch {
        /* listener errors never break the manager */
      }
    }
  }

  private evictHistory(): void {
    const finished = [...this.jobs.values()].filter(
      (e) => e.job.status === "succeeded" || e.job.status === "failed" || e.job.status === "cancelled",
    );
    if (finished.length <= this.historyLimit) return;
    finished
      .sort((a, b) => (a.job.finishedAt ?? 0) - (b.job.finishedAt ?? 0))
      .slice(0, finished.length - this.historyLimit)
      .forEach((e) => this.jobs.delete(e.job.id));
  }
}

function withProgress(
  input: ExportInput,
  onProgress: ((p: number, s: ExportStage) => void) | undefined,
): ExportInput {
  return { ...input, options: { ...input.options, onProgress } };
}

/** A lazily-created default manager for simple call sites. */
let defaultManager: ExportManager | null = null;
export function getExportManager(events?: EditorEventBus | null): ExportManager {
  if (!defaultManager) defaultManager = new ExportManager({ events });
  return defaultManager;
}
