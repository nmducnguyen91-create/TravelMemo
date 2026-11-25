import type { MediaStore } from '../media-store';
import { done, openIdb, request } from './idb';

export class IdbMediaStore implements MediaStore {
  async put(path: string, bytes: Uint8Array): Promise<void> {
    const db = await openIdb();
    const tx = db.transaction('media', 'readwrite');
    tx.objectStore('media').put(bytes, path);
    await done(tx);
  }

  async get(path: string): Promise<Uint8Array | null> {
    const db = await openIdb();
    const v = await request(db.transaction('media', 'readonly').objectStore('media').get(path));
    return v instanceof Uint8Array ? v : null;
  }

  async delete(path: string): Promise<void> {
    const db = await openIdb();
    const tx = db.transaction('media', 'readwrite');
    tx.objectStore('media').delete(path);
    await done(tx);
  }

  async list(): Promise<string[]> {
    const db = await openIdb();
    const keys = await request(db.transaction('media', 'readonly').objectStore('media').getAllKeys());
    return keys.map(String);
  }
}
