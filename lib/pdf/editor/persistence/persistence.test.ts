import { describe, expect, it, vi } from "vitest";
import { firstPageId, makeDoc, makeText } from "../test-utils";
import { createRevision } from "../model/factory";
import { ops } from "../operations/types";
import { createDocumentStore } from "../store/document-store";
import { createMemoryBackend } from "./backend";
import { DraftStore } from "./draft-store";
import { createAutosave } from "./autosave";
import { migratePersisted, MigrationError } from "./migrations";
import { CURRENT_SCHEMA_VERSION, type PersistedDocument } from "./schema";

describe("DraftStore (memory backend)", () => {
  it("round-trips a draft", async () => {
    const drafts = new DraftStore(createMemoryBackend());
    const doc = makeDoc(2);
    await drafts.saveDraft(doc, { savedAt: 42 });

    const loaded = await drafts.loadDraft(doc.meta.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.savedAt).toBe(42);
    expect(loaded!.document.meta.id).toBe(doc.meta.id);
    expect(loaded!.document.pageOrder).toEqual(doc.pageOrder);
  });

  it("lists and deletes drafts", async () => {
    const drafts = new DraftStore(createMemoryBackend());
    await drafts.saveDraft(makeDoc(1), { id: "a", savedAt: 1 });
    await drafts.saveDraft(makeDoc(1), { id: "b", savedAt: 2 });

    const list = await drafts.listDrafts();
    expect(list.map((d) => d.id)).toEqual(["b", "a"]); // newest first

    await drafts.deleteDraft("a");
    expect(await drafts.hasDraft("a")).toBe(false);
    expect(await drafts.hasDraft("b")).toBe(true);
  });

  it("stores a snapshot the caller cannot mutate afterwards", async () => {
    const drafts = new DraftStore(createMemoryBackend());
    const doc = makeDoc(1);
    await drafts.saveDraft(doc, { id: "x" });
    doc.meta.title = "MUTATED";
    const loaded = await drafts.loadDraft("x");
    expect(loaded!.document.meta.title).not.toBe("MUTATED");
  });

  it("saves and lists revisions per document", async () => {
    const drafts = new DraftStore(createMemoryBackend());
    const doc = makeDoc(1);
    const r1 = createRevision({ label: "v1", snapshot: doc });
    const r2 = createRevision({ label: "v2", snapshot: doc });
    await drafts.saveRevision(doc.meta.id, { ...r1, timestamp: 1 });
    await drafts.saveRevision(doc.meta.id, { ...r2, timestamp: 2 });

    const revs = await drafts.listRevisions(doc.meta.id);
    expect(revs.map((r) => r.label)).toEqual(["v2", "v1"]);

    const got = await drafts.getRevision(doc.meta.id, r1.id);
    expect(got!.document.meta.id).toBe(doc.meta.id);
  });
});

describe("migrations", () => {
  it("is a no-op for current-version data", () => {
    const doc = makeDoc(1);
    const env: PersistedDocument = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: doc.meta.id,
      savedAt: 1,
      document: doc,
    };
    expect(migratePersisted(env).document.meta.id).toBe(doc.meta.id);
  });

  it("throws for data from a newer/unknown schema", () => {
    const doc = makeDoc(1);
    const env = {
      schemaVersion: CURRENT_SCHEMA_VERSION - 1,
      id: doc.meta.id,
      savedAt: 1,
      document: doc,
    } as PersistedDocument;
    // No migration registered from (current-1) since current is the first version.
    expect(() => migratePersisted(env)).toThrow(MigrationError);
  });
});

describe("autosave", () => {
  it("debounced save clears dirty and emits PERSIST_SAVED", async () => {
    vi.useFakeTimers();
    try {
      const store = createDocumentStore();
      const drafts = new DraftStore(createMemoryBackend());
      const saved = vi.fn();
      store.getState().events.on("PERSIST_SAVED", saved);

      const auto = createAutosave(store, { store: drafts, debounceMs: 100 }).start();

      const doc = makeDoc(1);
      store.getState().loadDocument(doc);
      store.getState().dispatch(ops.addText(firstPageId(doc), makeText(firstPageId(doc))));
      expect(store.getState().dirty).toBe(true);
      expect(auto.isPending()).toBe(true);

      await vi.advanceTimersByTimeAsync(150);

      expect(store.getState().dirty).toBe(false);
      expect(saved).toHaveBeenCalledTimes(1);
      expect(await drafts.hasDraft(doc.meta.id)).toBe(true);

      auto.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("saveNow persists immediately", async () => {
    const store = createDocumentStore();
    const drafts = new DraftStore(createMemoryBackend());
    const doc = makeDoc(1);
    store.getState().loadDocument(doc);
    store.getState().dispatch(ops.addText(firstPageId(doc), makeText(firstPageId(doc))));

    const auto = createAutosave(store, { store: drafts, includeHistory: true });
    await auto.saveNow();

    const loaded = await drafts.loadDraft(doc.meta.id);
    expect(loaded!.history?.undo).toHaveLength(1);
    expect(store.getState().dirty).toBe(false);
  });
});
