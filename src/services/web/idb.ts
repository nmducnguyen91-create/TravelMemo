/** Minimal promise wrapper over IndexedDB. One database, fixed stores. */
const DB_NAME = 'travelmemo';
const DB_VERSION = 1;
export const STORES = ['db', 'media', 'rollback_db', 'rollback_media'] as const;
export type StoreName = (typeof STORES)[number];

let opening: Promise<IDBDatabase> | null = null;

export function openIdb(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB không khả dụng'));
    req.onblocked = () => reject(new Error('Hãy đóng các tab TravelMemo khác rồi tải lại.'));
  });
  return opening;
}

export function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Ghi dữ liệu thất bại'));
    tx.onabort = () => reject(tx.error ?? new Error('Ghi dữ liệu bị huỷ'));
  });
}

export function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getValue<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await openIdb();
  return request(db.transaction(store, 'readonly').objectStore(store).get(key) as IDBRequest<T | undefined>);
}

export async function putValue(store: StoreName, key: string, value: unknown): Promise<void> {
  const db = await openIdb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value, key);
  await done(tx);
}
