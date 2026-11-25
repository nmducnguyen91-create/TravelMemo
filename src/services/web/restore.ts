import type { StagedArchive } from '../backup/archive';
import { done, openIdb, request } from './idb';

/**
 * Replaces live data with a staged archive in ONE IndexedDB transaction, after copying the current
 * data to rollback stores in that same transaction. If anything fails or the tab closes mid-way,
 * IndexedDB aborts the transaction and the original data is untouched (TC13).
 */
export async function applyRestore(staged: StagedArchive): Promise<void> {
  const db = await openIdb();
  const tx = db.transaction(['db', 'media', 'rollback_db', 'rollback_media'], 'readwrite');
  const live = tx.objectStore('db');
  const media = tx.objectStore('media');
  const rbDb = tx.objectStore('rollback_db');
  const rbMedia = tx.objectStore('rollback_media');
  const current = await request(live.get('main'));
  const keys = await request(media.getAllKeys());
  const values = await request(media.getAll());
  rbDb.clear();
  rbMedia.clear();
  if (current) rbDb.put(current, 'main');
  rbDb.put(new Date().toISOString(), 'savedAt');
  keys.forEach((k, i) => rbMedia.put(values[i], k));
  media.clear();
  for (const [path, bytes] of staged.media) media.put(bytes, path);
  live.put(staged.databaseImage, 'main');
  await done(tx);
}

export async function rollbackInfo(): Promise<string | null> {
  const db = await openIdb();
  const v = await request(db.transaction('rollback_db', 'readonly').objectStore('rollback_db').get('savedAt'));
  return typeof v === 'string' ? v : null;
}

/** Puts back the data that was live before the last restore. Atomic, like applyRestore. */
export async function undoRestore(): Promise<void> {
  const db = await openIdb();
  const tx = db.transaction(['db', 'media', 'rollback_db', 'rollback_media'], 'readwrite');
  const rbDb = tx.objectStore('rollback_db');
  const rbMedia = tx.objectStore('rollback_media');
  const prev = await request(rbDb.get('main'));
  const keys = await request(rbMedia.getAllKeys());
  const values = await request(rbMedia.getAll());
  const live = tx.objectStore('db');
  const media = tx.objectStore('media');
  if (prev) live.put(prev, 'main');
  else live.delete('main');
  media.clear();
  keys.forEach((k, i) => media.put(values[i], k));
  rbDb.clear();
  rbMedia.clear();
  await done(tx);
}
