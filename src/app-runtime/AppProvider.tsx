import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';

import { createAppServices, type AppServices } from '../core/application/app-services';
import { migrations } from '../database/migrations';
import { IdbMediaStore } from '../services/web/idb-media-store';
import { acquireSingleTabLock } from '../services/web/single-tab';
import { openWebDatabase, type WebDatabase } from '../services/web/web-database';
import { geography } from './geography';

/** Transient UI state only: a revision counter that tells screens to re-read SQLite after a write. */
const useRevision = create<{ revision: number; bump: () => void }>((set) => ({
  revision: 0,
  bump: () => set((s) => ({ revision: s.revision + 1 })),
}));

export interface AppRuntime {
  readonly app: AppServices;
  readonly web: WebDatabase;
  readonly schemaVersion: number;
  /** Runs a write, then refreshes every screen. */
  mutate<T>(fn: (app: AppServices) => Promise<T>): Promise<T>;
}

const Ctx = createContext<AppRuntime | null>(null);

type Boot = { kind: 'loading' } | { kind: 'ready'; runtime: AppRuntime } | { kind: 'error'; message: string } | { kind: 'locked' };

export function useBoot(): Boot {
  const [state, setState] = useState<Boot>({ kind: 'loading' });
  const bump = useRevision((s) => s.bump);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      if (!(await acquireSingleTabLock())) {
        setState({ kind: 'locked' });
        return;
      }
      const web = await openWebDatabase();
      const app = createAppServices(web.driver, new IdbMediaStore(), geography);
      await app.initialize();
      const runtime: AppRuntime = {
        app,
        web,
        schemaVersion: migrations.length,
        mutate: async (fn) => {
          try {
            return await fn(app);
          } finally {
            bump();
          }
        },
      };
      setState({ kind: 'ready', runtime });
    })().catch((error: unknown) => setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) }));
  }, [bump]);
  return state;
}

export function AppRuntimeProvider({ runtime, children }: { readonly runtime: AppRuntime; readonly children: ReactNode }) {
  return <Ctx.Provider value={runtime}>{children}</Ctx.Provider>;
}

export function useApp(): AppRuntime {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppRuntimeProvider');
  return v;
}

export type Loadable<T> =
  | { readonly status: 'loading'; readonly data: undefined; readonly reload: () => void }
  | { readonly status: 'ready'; readonly data: T; readonly reload: () => void }
  | { readonly status: 'error'; readonly data: undefined; readonly error: string; readonly reload: () => void };

/** Reads from repositories; re-runs after any mutation and when deps change. */
export function useData<T>(loader: (app: AppServices) => Promise<T>, deps: readonly unknown[] = []): Loadable<T> {
  const { app } = useApp();
  const revision = useRevision((s) => s.revision);
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; data?: T; error?: string }>({ status: 'loading' });
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  useEffect(() => {
    let alive = true;
    loader(app).then(
      (data) => alive && setState({ status: 'ready', data }),
      (e: unknown) => alive && setState({ status: 'error', error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, revision, nonce, ...deps]);
  return useMemo(() => {
    if (state.status === 'ready') return { status: 'ready', data: state.data as T, reload };
    if (state.status === 'error') return { status: 'error', data: undefined, error: state.error ?? '', reload };
    return { status: 'loading', data: undefined, reload };
  }, [state, reload]);
}
