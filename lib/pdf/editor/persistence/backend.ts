/**
 * Storage backend abstraction.
 *
 * The persistence layer talks to a tiny key/value interface, not to IndexedDB
 * directly. That lets us:
 *   - run the *exact* same persistence code in unit tests with an in-memory
 *     backend (no fake-indexeddb dependency), and
 *   - degrade gracefully (SSR / private-mode browsers) by falling back to memory.
 *
 * Two named stores are used: `drafts` and `revisions`.
 */

export const STORE_DRAFTS = "drafts";
export const STORE_REVISIONS = "revisions";
export const ALL_STORES = [STORE_DRAFTS, STORE_REVISIONS] as const;
export type StoreName = (typeof ALL_STORES)[number];

export interface KVBackend {
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  put<T>(store: StoreName, key: string, value: T): Promise<void>;
  delete(store: StoreName, key: string): Promise<void>;
  keys(store: StoreName): Promise<string[]>;
  values<T>(store: StoreName): Promise<T[]>;
  clear(store: StoreName): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory backend (tests, SSR, private mode)
// ---------------------------------------------------------------------------

export function createMemoryBackend(): KVBackend {
  const data = new Map<StoreName, Map<string, unknown>>();
  const tableOf = (store: StoreName) => {
    let t = data.get(store);
    if (!t) {
      t = new Map();
      data.set(store, t);
    }
    return t;
  };
  // Deep-clone on the way in/out so callers can't mutate stored snapshots —
  // mirrors the structured-clone semantics of a real IndexedDB.
  const clone = <T>(v: T): T => deepClone(v);

  return {
    async get<T>(store: StoreName, key: string) {
      const v = tableOf(store).get(key);
      return v === undefined ? undefined : (clone(v) as T);
    },
    async put<T>(store: StoreName, key: string, value: T) {
      tableOf(store).set(key, clone(value));
    },
    async delete(store: StoreName, key: string) {
      tableOf(store).delete(key);
    },
    async keys(store: StoreName) {
      return [...tableOf(store).keys()];
    },
    async values<T>(store: StoreName) {
      return [...tableOf(store).values()].map((v) => clone(v) as T);
    },
    async clear(store: StoreName) {
      tableOf(store).clear();
    },
  };
}

function deepClone<T>(v: T): T {
  if (typeof structuredClone === "function") return structuredClone(v);
  return JSON.parse(JSON.stringify(v)) as T;
}

// ---------------------------------------------------------------------------
// IndexedDB backend (browser)
// ---------------------------------------------------------------------------

export interface IdbOptions {
  dbName?: string;
  version?: number;
}

export function createIdbBackend(options: IdbOptions = {}): KVBackend {
  const dbName = options.dbName ?? "freeofficetools-pdf-editor";
  const version = options.version ?? 1;
  let dbPromise: Promise<IDBDatabase> | null = null;

  const openDb = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, version);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const store of ALL_STORES) {
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  };

  const tx = async <T>(
    store: StoreName,
    mode: IDBTransactionMode,
    run: (os: IDBObjectStore) => IDBRequest<T> | void,
  ): Promise<T> => {
    const db = await openDb();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const os = transaction.objectStore(store);
      let request: IDBRequest<T> | void;
      try {
        request = run(os);
      } catch (err) {
        reject(err);
        return;
      }
      transaction.oncomplete = () => resolve((request ? request.result : undefined) as T);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  };

  return {
    get<T>(store: StoreName, key: string) {
      return tx<T>(store, "readonly", (os) => os.get(key) as IDBRequest<T>);
    },
    async put<T>(store: StoreName, key: string, value: T) {
      await tx(store, "readwrite", (os) => {
        os.put(value as unknown, key);
      });
    },
    async delete(store: StoreName, key: string) {
      await tx(store, "readwrite", (os) => {
        os.delete(key);
      });
    },
    keys(store: StoreName) {
      return tx<string[]>(store, "readonly", (os) => os.getAllKeys() as unknown as IDBRequest<string[]>);
    },
    values<T>(store: StoreName) {
      return tx<T[]>(store, "readonly", (os) => os.getAll() as unknown as IDBRequest<T[]>);
    },
    async clear(store: StoreName) {
      await tx(store, "readwrite", (os) => {
        os.clear();
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Default selection
// ---------------------------------------------------------------------------

/** Pick IndexedDB when available, otherwise fall back to in-memory. */
export function createDefaultBackend(options: IdbOptions = {}): KVBackend {
  if (typeof indexedDB !== "undefined") {
    try {
      return createIdbBackend(options);
    } catch {
      /* fall through to memory */
    }
  }
  return createMemoryBackend();
}
