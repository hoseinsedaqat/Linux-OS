/**
 * Minimal promise-based IndexedDB helper for NOVA Linux.
 *
 * Two object stores:
 *  - `fs`  : one record per virtual file-system node (write-through)
 *  - `kv`  : JSON blobs for application state (accounting, browser, calendar, ...)
 *
 * The database is versioned so future data-shape changes can be migrated
 * without destroying existing user data. If IndexedDB is unavailable
 * (private mode, blocked storage) the app falls back to an in-memory map so the
 * desktop still works for the current session, and a warning can be surfaced.
 */

const DB_NAME = 'nova-linux-web';
const DB_VERSION = 1;
export const SCHEMA_VERSION = 1;
export const FS_STORE = 'fs';
export const KV_STORE = 'kv';
export const META_STORE = 'meta';

let dbPromise: Promise<IDBDatabase | null> | null = null;
let storageUnavailable = false;
const memoryFs = new Map<string, unknown>();
const memoryKv = new Map<string, unknown>();

export function isStorageUnavailable(): boolean {
  return storageUnavailable;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      storageUnavailable = true;
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      storageUnavailable = true;
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FS_STORE)) {
        const store = db.createObjectStore(FS_STORE, { keyPath: 'id' });
        store.createIndex('parentId', 'parentId', { unique: false });
      }
      if (!db.objectStoreNames.contains(KV_STORE)) {
        db.createObjectStore(KV_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
      // Seed the schema version marker on first creation.
      if (!db.objectStoreNames.contains(META_STORE)) return;
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => {
      storageUnavailable = true;
      // eslint-disable-next-line no-console
      console.warn('[NOVA] IndexedDB failed to open, using in-memory storage.', request.error);
      resolve(null);
    };
    request.onblocked = () => {
      storageUnavailable = true;
      resolve(null);
    };
  });
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openDatabase();
  if (!db) throw new Error('storage-unavailable');
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result: T;
    try {
      const maybe = run(store);
      if (maybe instanceof Promise) {
        maybe.then((value) => {
          result = value;
        }).catch(reject);
      } else {
        result = maybe;
      }
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/* ------------------------------------------------------------------ */
/* File system                                                         */
/* ------------------------------------------------------------------ */

export async function fsGetAll<T>(): Promise<T[]> {
  try {
    return await tx<T[]>(FS_STORE, 'readonly', (store) => requestToPromise(store.getAll()));
  } catch {
    return Array.from(memoryFs.values()) as T[];
  }
}

export async function fsPut(node: unknown): Promise<void> {
  const record = node as { id: string };
  memoryFs.set(record.id, node);
  try {
    await tx(FS_STORE, 'readwrite', (store) => {
      store.put(node);
    });
  } catch {
    /* memory fallback already updated */
  }
}

export async function fsPutMany(nodes: unknown[]): Promise<void> {
  nodes.forEach((node) => memoryFs.set((node as { id: string }).id, node));
  try {
    await tx(FS_STORE, 'readwrite', (store) => {
      nodes.forEach((node) => store.put(node));
    });
  } catch {
    /* ignored */
  }
}

export async function fsDelete(id: string): Promise<void> {
  memoryFs.delete(id);
  try {
    await tx(FS_STORE, 'readwrite', (store) => {
      store.delete(id);
    });
  } catch {
    /* ignored */
  }
}

export async function fsClear(): Promise<void> {
  memoryFs.clear();
  try {
    await tx(FS_STORE, 'readwrite', (store) => {
      store.clear();
    });
  } catch {
    /* ignored */
  }
}

/* ------------------------------------------------------------------ */
/* Key / value                                                         */
/* ------------------------------------------------------------------ */

export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    const record = await tx<{ key: string; value: T } | undefined>(KV_STORE, 'readonly', (store) =>
      requestToPromise(store.get(key)),
    );
    if (record) return record.value;
  } catch {
    /* fall through to memory */
  }
  return memoryKv.get(key) as T | undefined;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  memoryKv.set(key, value);
  try {
    await tx(KV_STORE, 'readwrite', (store) => {
      store.put({ key, value });
    });
  } catch {
    /* memory fallback already updated */
  }
}

export async function kvDelete(key: string): Promise<void> {
  memoryKv.delete(key);
  try {
    await tx(KV_STORE, 'readwrite', (store) => {
      store.delete(key);
    });
  } catch {
    /* ignored */
  }
}

export async function kvGetAll(): Promise<Record<string, unknown>> {
  try {
    const records = await tx<Array<{ key: string; value: unknown }>>(KV_STORE, 'readonly', (store) =>
      requestToPromise(store.getAll()),
    );
    return Object.fromEntries(records.map((record) => [record.key, record.value]));
  } catch {
    return Object.fromEntries(memoryKv.entries());
  }
}

export async function kvClear(): Promise<void> {
  memoryKv.clear();
  try {
    await tx(KV_STORE, 'readwrite', (store) => {
      store.clear();
    });
  } catch {
    /* ignored */
  }
}

/* ------------------------------------------------------------------ */
/* Meta / schema                                                       */
/* ------------------------------------------------------------------ */

export async function getSchemaVersion(): Promise<number> {
  try {
    const record = await tx<{ key: string; value: number } | undefined>(META_STORE, 'readonly', (store) =>
      requestToPromise(store.get('schemaVersion')),
    );
    return record?.value ?? 0;
  } catch {
    return 0;
  }
}

export async function setSchemaVersion(version: number): Promise<void> {
  try {
    await tx(META_STORE, 'readwrite', (store) => {
      store.put({ key: 'schemaVersion', value: version });
    });
  } catch {
    /* ignored */
  }
}

export async function estimateUsage(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (navigator.storage?.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usage, quota };
    }
  } catch {
    /* ignored */
  }
  return null;
}
