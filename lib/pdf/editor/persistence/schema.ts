/**
 * Versioned persistence envelopes.
 *
 * Everything written to disk (IndexedDB/localStorage) is wrapped in an envelope
 * carrying its `schemaVersion`. On load we run migrations from the stored
 * version up to {@link CURRENT_SCHEMA_VERSION} before handing the document to
 * the store — so old drafts keep opening as the model evolves.
 *
 * Note: `DocumentMeta.schemaVersion` (model version) and this envelope's
 * `schemaVersion` are intentionally the same number — they move together — but
 * the envelope is what the migration runner keys off.
 */
import type { DocumentState } from "../model/types";
import type { Patch } from "../patch/types";

/** Bump this (and add a migration) whenever the persisted shape changes. */
export const CURRENT_SCHEMA_VERSION = 1;

export interface PersistedHistory {
  undo: Patch[];
  redo: Patch[];
}

/** A saved draft: the live document plus optional undo/redo history. */
export interface PersistedDocument {
  schemaVersion: number;
  /** Stable key for this draft (usually `document.meta.id`). */
  id: string;
  savedAt: number;
  document: DocumentState;
  history?: PersistedHistory;
}

/** A saved revision (immutable snapshot for one-click restore). */
export interface PersistedRevision {
  schemaVersion: number;
  /** Composite key `${documentId}:${revisionId}` in storage. */
  documentId: string;
  revisionId: string;
  label: string;
  timestamp: number;
  document: DocumentState;
}

/** Lightweight listing row (avoids loading whole documents for a picker). */
export interface DraftSummary {
  id: string;
  title: string;
  fileName: string;
  savedAt: number;
  schemaVersion: number;
  pageCount: number;
}

export interface RevisionSummary {
  documentId: string;
  revisionId: string;
  label: string;
  timestamp: number;
}
