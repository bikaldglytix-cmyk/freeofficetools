/**
 * High-level persistence API over a {@link KVBackend}.
 *
 * Responsibilities:
 *   - **Drafts** — the latest editable state of a document (one row per doc id),
 *     used for autosave + crash/refresh recovery.
 *   - **Revisions** — immutable named snapshots for one-click restore.
 *
 * Everything written goes through a versioned envelope (`schema.ts`) and
 * everything read goes through `migratePersisted`, so old data keeps opening.
 */
import type { DocumentState, Revision } from "../model/types";
import {
  createDefaultBackend,
  STORE_DRAFTS,
  STORE_REVISIONS,
  type KVBackend,
} from "./backend";
import { migratePersisted } from "./migrations";
import {
  CURRENT_SCHEMA_VERSION,
  type DraftSummary,
  type PersistedDocument,
  type PersistedHistory,
  type PersistedRevision,
  type RevisionSummary,
} from "./schema";

export interface SaveDraftOptions {
  /** Override the storage key (defaults to `document.meta.id`). */
  id?: string;
  /** Persist undo/redo stacks alongside the document. */
  history?: PersistedHistory;
  /** Override the save timestamp (mostly for tests). */
  savedAt?: number;
}

export interface LoadedDraft {
  document: DocumentState;
  history?: PersistedHistory;
  savedAt: number;
  schemaVersion: number;
}

const revisionKey = (documentId: string, revisionId: string) =>
  `${documentId}:${revisionId}`;

export class DraftStore {
  private backend: KVBackend;

  constructor(backend: KVBackend = createDefaultBackend()) {
    this.backend = backend;
  }

  // ----- Drafts -------------------------------------------------------------

  async saveDraft(
    document: DocumentState,
    options: SaveDraftOptions = {},
  ): Promise<PersistedDocument> {
    const id = options.id ?? document.meta.id;
    const envelope: PersistedDocument = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id,
      savedAt: options.savedAt ?? Date.now(),
      document,
      history: options.history,
    };
    await this.backend.put(STORE_DRAFTS, id, envelope);
    return envelope;
  }

  async loadDraft(id: string): Promise<LoadedDraft | null> {
    const raw = await this.backend.get<PersistedDocument>(STORE_DRAFTS, id);
    if (!raw) return null;
    const migrated = migratePersisted(raw);
    return {
      document: migrated.document,
      history: migrated.history,
      savedAt: migrated.savedAt,
      schemaVersion: migrated.schemaVersion,
    };
  }

  async listDrafts(): Promise<DraftSummary[]> {
    const all = await this.backend.values<PersistedDocument>(STORE_DRAFTS);
    return all
      .map((d) => ({
        id: d.id,
        title: d.document.meta.title,
        fileName: d.document.meta.fileName,
        savedAt: d.savedAt,
        schemaVersion: d.schemaVersion,
        pageCount: d.document.pageOrder.length,
      }))
      .sort((a, b) => b.savedAt - a.savedAt);
  }

  async deleteDraft(id: string): Promise<void> {
    await this.backend.delete(STORE_DRAFTS, id);
  }

  async hasDraft(id: string): Promise<boolean> {
    return (await this.backend.get(STORE_DRAFTS, id)) !== undefined;
  }

  // ----- Revisions ----------------------------------------------------------

  async saveRevision(documentId: string, revision: Revision): Promise<PersistedRevision> {
    const envelope: PersistedRevision = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      documentId,
      revisionId: revision.id,
      label: revision.label,
      timestamp: revision.timestamp,
      document: revision.snapshot,
    };
    await this.backend.put(STORE_REVISIONS, revisionKey(documentId, revision.id), envelope);
    return envelope;
  }

  async getRevision(documentId: string, revisionId: string): Promise<PersistedRevision | null> {
    const raw = await this.backend.get<PersistedRevision>(
      STORE_REVISIONS,
      revisionKey(documentId, revisionId),
    );
    return raw ?? null;
  }

  async listRevisions(documentId: string): Promise<RevisionSummary[]> {
    const all = await this.backend.values<PersistedRevision>(STORE_REVISIONS);
    return all
      .filter((r) => r.documentId === documentId)
      .map((r) => ({
        documentId: r.documentId,
        revisionId: r.revisionId,
        label: r.label,
        timestamp: r.timestamp,
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async deleteRevision(documentId: string, revisionId: string): Promise<void> {
    await this.backend.delete(STORE_REVISIONS, revisionKey(documentId, revisionId));
  }
}

/** App-wide default draft store (uses IndexedDB in the browser). */
export const draftStore = new DraftStore();
