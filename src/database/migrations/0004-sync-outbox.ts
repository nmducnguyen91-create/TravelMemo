import type { Migration } from '../types.ts';

/**
 * Local bookkeeping for optional cloud sync (ADR-003). RELEASED MIGRATIONS ARE IMMUTABLE.
 * - sync_outbox: one row per locally changed record waiting to be pushed (filled by triggers that
 *   the sync engine installs only after the owner turns sync on).
 * - sync_meta: device id, pull cursor, and the transient 'applying' flag that mutes triggers while
 *   remote changes are written.
 * - sync_parked: remote records that could not be applied yet (missing parent row); retried on every pull.
 */
export const migration0004: Migration = {
  version: 4,
  name: 'sync-outbox',
  sql: `
CREATE TABLE sync_outbox(tbl TEXT NOT NULL,pk TEXT NOT NULL,changed_at TEXT NOT NULL,PRIMARY KEY(tbl,pk));
CREATE TABLE sync_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE sync_parked(doc_id TEXT PRIMARY KEY,doc_json TEXT NOT NULL,parked_at TEXT NOT NULL);
`,
};
