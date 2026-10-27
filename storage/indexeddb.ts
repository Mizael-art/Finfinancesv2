import { createEmitter } from "./events";
import { DB_NAME, DB_VERSION, INDEXES, STORE_NAMES } from "./schema";
import type { BatchOp, Repository, Storage, StoreMap, StoreName } from "./types";

const wrap = <T,>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const done = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transação abortada"));
  });

/** Passos de migração: mudar o schema = subir DB_VERSION e acrescentar um passo aqui. */
const migrations: Record<number, (db: IDBDatabase, tx: IDBTransaction) => void> = {
  1: (db) => {
    for (const name of STORE_NAMES) {
      const store = db.createObjectStore(name, { keyPath: "id" });
      for (const index of INDEXES[name]) store.createIndex(index, index);
    }
  },
};

export function createIndexedDbStorage(name: string = DB_NAME): Storage {
  const emitter = createEmitter();
  let dbPromise: Promise<IDBDatabase> | null = null;
  let closed = false;

  const open = () => {
    if (!dbPromise) {
      dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB indisponível neste navegador."));
        const req = indexedDB.open(name, DB_VERSION);
        req.onupgradeneeded = (ev) => {
          const db = req.result;
          for (let v = ev.oldVersion + 1; v <= DB_VERSION; v++) migrations[v]?.(db, req.transaction!);
        };
        req.onsuccess = () => {
          req.result.onversionchange = () => req.result.close();
          resolve(req.result);
        };
        req.onerror = () => { dbPromise = null; reject(req.error); };
        req.onblocked = () => { dbPromise = null; reject(new Error("Feche as outras abas do FinFinance e tente de novo.")); };
      });
    }
    return dbPromise;
  };

  function repo<K extends StoreName>(store: K): Repository<StoreMap[K]> {
    type T = StoreMap[K];
    const run = async <R,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => Promise<R>): Promise<R> => {
      const db = await open();
      const tx = db.transaction(store, mode);
      const result = await fn(tx.objectStore(store));
      if (mode === "readwrite") await done(tx);
      return result;
    };
    return {
      get: (id) => run("readonly", (s) => wrap(s.get(id) as IDBRequest<T | undefined>)),
      list: () => run("readonly", (s) => wrap(s.getAll() as IDBRequest<T[]>)),
      listBy: (index, value) => run("readonly", (s) => wrap(s.index(index).getAll(value) as IDBRequest<T[]>)),
      count: () => run("readonly", (s) => wrap(s.count())),
      async put(value) {
        await run("readwrite", async (s) => { s.put(value); });
        emitter.emit({ stores: [store] });
        return value;
      },
      async delete(id) {
        await run("readwrite", async (s) => { s.delete(id); });
        emitter.emit({ stores: [store] });
      },
      async clear() {
        await run("readwrite", async (s) => { s.clear(); });
        emitter.emit({ stores: [store] });
      },
    };
  }

  const repos = new Map<StoreName, Repository<never>>();

  return {
    repo<K extends StoreName>(store: K) {
      let r = repos.get(store);
      if (!r) { r = repo(store) as unknown as Repository<never>; repos.set(store, r); }
      return r as unknown as Repository<StoreMap[K]>;
    },
    async batch(ops: BatchOp[]) {
      if (ops.length === 0) return;
      const db = await open();
      const touched = [...new Set(ops.map((o) => o.store))];
      const tx = db.transaction(touched, "readwrite");
      try {
        for (const op of ops) {
          const s = tx.objectStore(op.store);
          if (op.type === "put") s.put(op.value);
          else s.delete(op.id);
        }
      } catch (err) {
        // Um registro inválido (ex.: não clonável) lança no meio do laço; sem abortar, o que já foi enfileirado seria gravado.
        try { tx.abort(); } catch { /* já finalizada */ }
        await done(tx).catch(() => undefined);
        throw err;
      }
      await done(tx);
      emitter.emit({ stores: touched });
    },
    subscribe: emitter.subscribe,
    async clearAll() {
      const db = await open();
      const tx = db.transaction(STORE_NAMES, "readwrite");
      for (const n of STORE_NAMES) tx.objectStore(n).clear();
      await done(tx);
      emitter.emit({ stores: [...STORE_NAMES] });
    },
    close() {
      if (closed) return;
      closed = true;
      void dbPromise?.then((db) => db.close()).catch(() => undefined);
      dbPromise = null;
    },
  };
}
