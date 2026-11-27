import { create } from 'zustand';

import { SyncEngine } from '../core/sync/sync-engine';
import { newId } from '../core/ids';
import type { SqlDriver } from '../database/types';
import { cloud, type CloudAccount } from '../services/firebase/cloud-sync';

/** Transient sync status for the UI. The durable state (outbox, cursor, linked account) lives in SQLite. */
export interface CloudSyncState {
  readonly available: boolean;
  readonly account: CloudAccount | null;
  /** Account this device's data is linked to (sync on), or null. */
  readonly linked: string | null;
  readonly phase: 'off' | 'idle' | 'syncing' | 'offline' | 'error';
  readonly lastSync: string | null;
  readonly pending: number;
  readonly error: string | null;
}

export const useCloudSync = create<CloudSyncState>(() => ({
  available: cloud.available(),
  account: null,
  linked: null,
  phase: 'off',
  lastSync: null,
  pending: 0,
  error: null,
}));

const AUTO_INTERVAL_MS = 2 * 60 * 1000;
const AFTER_WRITE_DELAY_MS = 3000;

export interface CloudSyncController {
  readonly engine: SyncEngine;
  /** Signs in (if needed) and links this device's data to the account. */
  turnOn(): Promise<void>;
  /** Stops syncing on this device and signs out. Local data stays. */
  turnOff(): Promise<void>;
  syncNow(): Promise<void>;
  /** Called after every local write; schedules a sync shortly after. */
  noteLocalWrite(): void;
}

export function startCloudSync(db: SqlDriver, schemaVersion: number, onRemoteApplied: () => void): CloudSyncController {
  const engine = new SyncEngine(db, newId);
  const set = useCloudSync.setState;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const refresh = async () => {
    const linked = await engine.linkedAccount();
    set({ linked, pending: await engine.pendingCount(), lastSync: await engine.getMeta('last_sync') });
    return linked;
  };

  const syncNow = async () => {
    const { account } = useCloudSync.getState();
    const linked = await refresh();
    if (!account || linked !== account.uid) {
      set({ phase: 'off' });
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      set({ phase: 'offline' });
      return;
    }
    set({ phase: 'syncing', error: null });
    try {
      const result = await engine.sync(cloud.remote(account.uid, schemaVersion));
      if (result.applied > 0) onRemoteApplied();
      await refresh();
      set({ phase: 'idle' });
    } catch (error) {
      await refresh();
      set({ phase: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  };

  const schedule = (delay: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), delay);
  };

  // Nothing touches the network until the owner has turned sync on at least once on this device.
  let watching = false;
  const watch = () => {
    if (watching || !cloud.available()) return;
    watching = true;
    cloud.watchAccount((account) => {
      set({ account });
      void syncNow();
    });
    setInterval(() => void syncNow(), AUTO_INTERVAL_MS);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void syncNow());
      window.addEventListener('offline', () => set({ phase: 'offline' }));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void syncNow();
      });
    }
  };
  void refresh().then((linked) => {
    if (linked) watch();
  });

  return {
    engine,
    async turnOn() {
      const account = useCloudSync.getState().account ?? (await cloud.signInWithGoogle());
      await engine.enable(account.uid);
      set({ account });
      watch();
      await syncNow();
    },
    async turnOff() {
      await engine.disable();
      await cloud.signOut();
      set({ account: null, phase: 'off', error: null });
      await refresh();
    },
    syncNow,
    noteLocalWrite() {
      const { account, linked } = useCloudSync.getState();
      if (account && linked === account.uid) {
        set({ pending: useCloudSync.getState().pending + 1 });
        schedule(AFTER_WRITE_DELAY_MS);
      }
    },
  };
}
