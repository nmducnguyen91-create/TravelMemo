import initSqlJs, { type SqlJsStatic } from 'sql.js';

import { runMigrations } from '../../database/migration-runner';
import { migrations } from '../../database/migrations';
import { SqlJsDriver } from '../../database/sqljs-driver';
import { getValue, putValue } from './idb';

const KEY = 'main';
let sqlPromise: Promise<SqlJsStatic> | null = null;

export function loadSqlJs(): Promise<SqlJsStatic> {
  const base = process.env.EXPO_BASE_URL ?? '';
  sqlPromise ??= initSqlJs({ locateFile: () => `${base}/sql-wasm-browser.wasm` });
  return sqlPromise;
}

export interface WebDatabase {
  readonly driver: SqlJsDriver;
  readonly persisted: boolean;
  /** Resolves once every committed write so far has reached IndexedDB. */
  flush(): Promise<void>;
  onPersistError(listener: (error: unknown) => void): void;
  /** Stops all further persistence (used right before a restore replaces the stored image). */
  freeze(): void;
}

/**
 * Opens the database image from IndexedDB, migrates it, and persists the full image after every
 * committed write. Writes are coalesced but never dropped; flush() waits for the latest one.
 */
export async function openWebDatabase(): Promise<WebDatabase> {
  const SQL = await loadSqlJs();
  const stored = await getValue<Uint8Array>('db', KEY);
  let dirty = false;
  let writing: Promise<void> = Promise.resolve();
  let scheduled = false;
  let frozen = false;
  const errorListeners: ((e: unknown) => void)[] = [];

  const persistNow = async () => {
    scheduled = false;
    if (!dirty || frozen) return;
    dirty = false;
    try {
      await putValue('db', KEY, driver.exportImage());
    } catch (error) {
      dirty = true;
      errorListeners.forEach((l) => l(error));
      throw error;
    }
  };
  const schedule = () => {
    dirty = true;
    if (scheduled) return;
    scheduled = true;
    writing = writing.then(() => new Promise<void>((r) => setTimeout(r, 30))).then(persistNow).catch(() => {});
  };

  const driver: SqlJsDriver = new SqlJsDriver(new SQL.Database(stored), schedule);
  await runMigrations(driver, migrations);

  let persisted = false;
  try {
    persisted = (await navigator.storage?.persist?.()) ?? false;
  } catch {
    persisted = false;
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => void persistNow());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void persistNow();
    });
  }
  return {
    driver,
    persisted,
    flush: async () => {
      await writing;
      await persistNow();
    },
    onPersistError: (l) => errorListeners.push(l),
    freeze: () => {
      frozen = true;
    },
  };
}
