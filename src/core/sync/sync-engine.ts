import type { SqlDriver, SqlValue } from '../../database/types.ts';

/**
 * Optional multi-device sync (ADR-003). SQLite stays authoritative on every device; the cloud only
 * relays row changes between devices of the same signed-in owner.
 *
 * Model: every synced row becomes one remote document keyed by table + primary key. Conflicts are
 * resolved per row, last writer wins by change time, ties broken by device id. Deletes travel as
 * tombstones (data = null). This engine knows nothing about Firebase: it talks to a SyncRemote.
 */

/** Tables that sync, parents before children. Geography, templates, settings and backup history are device-local. */
export const SYNC_TABLES = [
  { name: 'profiles', pk: ['id'] },
  { name: 'companions', pk: ['id'] },
  { name: 'places', pk: ['id'] },
  { name: 'trips', pk: ['id'] },
  { name: 'trip_companions', pk: ['trip_id', 'companion_id'] },
  { name: 'visits', pk: ['id'] },
  { name: 'visit_regions', pk: ['visit_id', 'region_version_id'] },
  { name: 'passports', pk: ['id'] },
  { name: 'passport_stamps', pk: ['id'] },
  { name: 'media_assets', pk: ['id'] },
  { name: 'journal_entries', pk: ['id'] },
] as const;

export type SyncTableName = (typeof SYNC_TABLES)[number]['name'];
export type RowData = Record<string, SqlValue>;

/** Change time used for rows that existed before sync was turned on: any real edit beats it. */
export const INITIAL_CHANGE_TIME = '1970-01-01T00:00:00.000Z';
/** Bump when the trigger SQL changes so installTriggers() replaces old ones. */
const TRIGGER_VERSION = 1;
/** Re-read this much history on every pull so documents committed slightly out of order are not missed. */
const PULL_OVERLAP_MS = 5 * 60 * 1000;

export interface RemoteRow {
  readonly id: string;
  readonly table: string;
  readonly key: readonly SqlValue[];
  /** Row columns, or null for a deletion. */
  readonly data: RowData | null;
  /** ISO change time on the writing device. */
  readonly changedAt: string;
  readonly deviceId: string;
  /** Server commit time in ms, used only as the pull cursor. */
  readonly serverTime: number;
}

export type OutgoingRow = Omit<RemoteRow, 'serverTime'>;

export interface SyncRemote {
  /** All documents committed at or after `sinceMs` (everything when null), in any order. */
  pull(sinceMs: number | null): Promise<RemoteRow[]>;
  push(rows: readonly OutgoingRow[]): Promise<void>;
}

export interface SyncResult {
  readonly pulled: number;
  readonly applied: number;
  readonly pushed: number;
  readonly parked: number;
}

const tableByName = new Map<string, (typeof SYNC_TABLES)[number]>(SYNC_TABLES.map((t) => [t.name, t]));
const tableOrder = new Map<string, number>(SYNC_TABLES.map((t, i) => [t.name, i]));

export function docId(table: string, key: readonly SqlValue[]): string {
  return [table, ...key.map((v) => encodeURIComponent(String(v)))].join('~');
}

const isNewer = (a: { changedAt: string; deviceId: string }, b: { changedAt: string; deviceId: string }) =>
  a.changedAt > b.changedAt || (a.changedAt === b.changedAt && a.deviceId > b.deviceId);

export class SyncEngine {
  private readonly db: SqlDriver;
  private readonly newId: () => string;
  private running: Promise<SyncResult> | null = null;

  constructor(db: SqlDriver, newId: () => string) {
    this.db = db;
    this.newId = newId;
  }

  async getMeta(key: string): Promise<string | null> {
    const rows = await this.db.getAllAsync<{ value: string }>('SELECT value FROM sync_meta WHERE key = ?', [key]);
    return rows[0]?.value ?? null;
  }

  private async setMeta(key: string, value: string): Promise<void> {
    await this.db.runAsync('INSERT INTO sync_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
  }

  async deviceId(): Promise<string> {
    const existing = await this.getMeta('device_id');
    if (existing) return existing;
    const id = this.newId();
    await this.setMeta('device_id', id);
    return id;
  }

  async isEnabled(): Promise<boolean> {
    return (await this.getMeta('enabled_for')) !== null;
  }

  /** Account the local data is linked to. Signing in with a different account must not mix data. */
  async linkedAccount(): Promise<string | null> {
    return this.getMeta('enabled_for');
  }

  /**
   * Turns change tracking on for `accountId`: installs triggers and queues every existing row once.
   * Idempotent for the same account.
   */
  async enable(accountId: string): Promise<void> {
    const linked = await this.linkedAccount();
    if (linked && linked !== accountId) {
      throw new Error('Dữ liệu trên máy này đang liên kết với một tài khoản khác. Hãy tắt đồng bộ trước khi đổi tài khoản.');
    }
    await this.db.withTransactionAsync(async () => {
      await this.installTriggers();
      if (!linked) {
        for (const t of SYNC_TABLES) {
          const keyExpr = `json_array(${t.pk.join(', ')})`;
          await this.db.runAsync(
            `INSERT INTO sync_outbox(tbl, pk, changed_at) SELECT ?, ${keyExpr}, ? FROM ${t.name} WHERE 1
             ON CONFLICT(tbl, pk) DO NOTHING`,
            [t.name, INITIAL_CHANGE_TIME],
          );
        }
        await this.db.runAsync("DELETE FROM sync_meta WHERE key = 'pull_cursor'", []);
        await this.setMeta('enabled_for', accountId);
      }
    });
    await this.deviceId();
  }

  /** Stops tracking. Local data is untouched; the cloud copy stays until the owner deletes it. */
  async disable(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.dropTriggers();
      await this.db.runAsync('DELETE FROM sync_outbox', []);
      await this.db.runAsync('DELETE FROM sync_parked', []);
      await this.db.runAsync("DELETE FROM sync_meta WHERE key IN ('enabled_for', 'pull_cursor', 'last_sync')", []);
    });
  }

  async pendingCount(): Promise<number> {
    const rows = await this.db.getAllAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_outbox', []);
    return rows[0]?.n ?? 0;
  }

  /** One full round: pull and apply remote changes, then push local ones. Concurrent calls share one run. */
  sync(remote: SyncRemote): Promise<SyncResult> {
    this.running ??= this.syncOnce(remote).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async syncOnce(remote: SyncRemote): Promise<SyncResult> {
    if (!(await this.isEnabled())) throw new Error('Đồng bộ chưa được bật.');
    const deviceId = await this.deviceId();
    const cursorText = await this.getMeta('pull_cursor');
    const cursor = cursorText === null ? null : Number(cursorText);
    const incoming = await remote.pull(cursor === null ? null : Math.max(0, cursor - PULL_OVERLAP_MS));
    const { applied, parked } = await this.apply(incoming);
    const maxServer = incoming.reduce((m, r) => Math.max(m, r.serverTime), cursor ?? 0);
    if (incoming.length > 0) await this.setMeta('pull_cursor', String(maxServer));
    const pushed = await this.pushPending(remote, deviceId);
    await this.setMeta('last_sync', new Date().toISOString());
    return { pulled: incoming.length, applied, pushed, parked };
  }

  /** Applies remote rows in one transaction with triggers muted. Rows whose parent is missing are parked. */
  async apply(incoming: readonly RemoteRow[]): Promise<{ applied: number; parked: number }> {
    const parkedRows = await this.db.getAllAsync<{ doc_json: string }>('SELECT doc_json FROM sync_parked', []);
    const byId = new Map<string, RemoteRow>();
    for (const p of parkedRows) {
      const row = JSON.parse(p.doc_json) as RemoteRow;
      byId.set(row.id, row);
    }
    for (const r of incoming) {
      const prev = byId.get(r.id);
      if (!prev || isNewer(r, prev)) byId.set(r.id, r);
    }
    const rows = [...byId.values()].filter((r) => tableByName.has(r.table));
    // Upserts parents-first, deletions children-first.
    rows.sort((a, b) => {
      const da = a.data === null ? 1 : 0;
      const dbb = b.data === null ? 1 : 0;
      if (da !== dbb) return da - dbb;
      const oa = tableOrder.get(a.table)!;
      const ob = tableOrder.get(b.table)!;
      return da ? ob - oa : oa - ob;
    });
    let applied = 0;
    let parked = 0;
    if (rows.length === 0) return { applied, parked };
    const columns = new Map<string, Set<string>>();
    for (const t of SYNC_TABLES) {
      const info = await this.db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t.name})`, []);
      columns.set(t.name, new Set(info.map((c) => c.name)));
    }
    const deviceId = await this.deviceId();
    await this.db.withTransactionAsync(async () => {
      await this.db.execAsync('PRAGMA defer_foreign_keys = ON');
      await this.setMeta('applying', '1');
      await this.db.runAsync('DELETE FROM sync_parked', []);
      for (const r of rows) {
        const table = tableByName.get(r.table)!;
        const pkJson = JSON.stringify(r.key);
        const pending = await this.db.getAllAsync<{ changed_at: string }>('SELECT changed_at FROM sync_outbox WHERE tbl = ? AND pk = ?', [r.table, pkJson]);
        const local = pending[0];
        if (local && !isNewer(r, { changedAt: local.changed_at, deviceId })) continue; // local edit wins; it will be pushed
        if (r.data === null) {
          await this.db.runAsync(`DELETE FROM ${table.name} WHERE ${table.pk.map((c) => `${c} = ?`).join(' AND ')}`, [...r.key]);
        } else {
          await this.upsert(table, r.data, columns.get(table.name)!);
        }
        if (local) await this.db.runAsync('DELETE FROM sync_outbox WHERE tbl = ? AND pk = ?', [r.table, pkJson]);
        applied++;
      }
      // Rows whose parent has not arrived (or does not exist on this device) are taken out and kept for later.
      const violations = await this.db.getAllAsync<{ table: string; rowid: number }>('PRAGMA foreign_key_check', []);
      for (const v of violations) {
        const table = tableByName.get(v.table);
        if (!table) throw new Error(`Không thể áp dụng dữ liệu đồng bộ: vi phạm khóa ngoại ở bảng ${v.table}.`);
        const keyRows = await this.db.getAllAsync<RowData>(`SELECT ${table.pk.join(', ')} FROM ${table.name} WHERE rowid = ?`, [v.rowid]);
        const keyRow = keyRows[0];
        if (!keyRow) continue;
        const key = table.pk.map((c) => keyRow[c] ?? null);
        const doc = byId.get(docId(table.name, key));
        await this.db.runAsync(`DELETE FROM ${table.name} WHERE rowid = ?`, [v.rowid]);
        if (doc) {
          await this.db.runAsync('INSERT OR REPLACE INTO sync_parked(doc_id, doc_json, parked_at) VALUES (?, ?, ?)', [doc.id, JSON.stringify(doc), new Date().toISOString()]);
          parked++;
          applied--;
        }
      }
      await this.db.runAsync("DELETE FROM sync_meta WHERE key = 'applying'", []);
    });
    return { applied, parked };
  }

  private async upsert(table: (typeof SYNC_TABLES)[number], data: RowData, known: Set<string>): Promise<void> {
    // Columns from a newer app version are ignored; missing ones keep their defaults.
    const cols = Object.keys(data).filter((c) => known.has(c));
    const values = cols.map((c) => data[c] ?? null);
    const placeholders = cols.map(() => '?').join(', ');
    const updates = cols.filter((c) => !(table.pk as readonly string[]).includes(c)).map((c) => `${c} = excluded.${c}`);
    const conflict = updates.length ? `ON CONFLICT(${table.pk.join(', ')}) DO UPDATE SET ${updates.join(', ')}` : 'ON CONFLICT DO NOTHING';
    try {
      await this.db.runAsync(`INSERT INTO ${table.name}(${cols.join(', ')}) VALUES (${placeholders}) ${conflict}`, values);
    } catch (error) {
      // Another unique key (e.g. the same stamp or photo created on two devices) clashes: the synced row replaces it.
      if (!String(error).includes('UNIQUE')) throw error;
      await this.db.runAsync(`INSERT OR REPLACE INTO ${table.name}(${cols.join(', ')}) VALUES (${placeholders})`, values);
    }
  }

  private async pushPending(remote: SyncRemote, deviceId: string): Promise<number> {
    const pending = await this.db.getAllAsync<{ tbl: string; pk: string; changed_at: string }>('SELECT tbl, pk, changed_at FROM sync_outbox ORDER BY changed_at', []);
    if (pending.length === 0) return 0;
    const out: OutgoingRow[] = [];
    for (const p of pending) {
      const table = tableByName.get(p.tbl);
      if (!table) continue;
      const key = JSON.parse(p.pk) as SqlValue[];
      const found = await this.db.getAllAsync<RowData>(`SELECT * FROM ${table.name} WHERE ${table.pk.map((c) => `${c} = ?`).join(' AND ')}`, key);
      out.push({ id: docId(table.name, key), table: table.name, key, data: found[0] ?? null, changedAt: p.changed_at, deviceId });
    }
    await remote.push(out);
    // Only clear entries that did not change again while the push was in flight.
    await this.db.withTransactionAsync(async () => {
      for (const p of pending) {
        await this.db.runAsync('DELETE FROM sync_outbox WHERE tbl = ? AND pk = ? AND changed_at = ?', [p.tbl, p.pk, p.changed_at]);
      }
    });
    return out.length;
  }

  private async installTriggers(): Promise<void> {
    const installed = await this.getMeta('trigger_version');
    if (installed === String(TRIGGER_VERSION)) return;
    await this.dropTriggers();
    const now = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
    const muted = "NOT EXISTS (SELECT 1 FROM sync_meta WHERE key = 'applying')";
    for (const t of SYNC_TABLES) {
      for (const [op, ref] of [
        ['INSERT', 'NEW'],
        ['UPDATE', 'NEW'],
        ['DELETE', 'OLD'],
      ] as const) {
        const key = `json_array(${t.pk.map((c) => `${ref}.${c}`).join(', ')})`;
        await this.db.execAsync(
          `CREATE TRIGGER sync_${t.name}_${op.toLowerCase()} AFTER ${op} ON ${t.name} WHEN ${muted} BEGIN
             INSERT INTO sync_outbox(tbl, pk, changed_at) VALUES ('${t.name}', ${key}, ${now})
             ON CONFLICT(tbl, pk) DO UPDATE SET changed_at = excluded.changed_at;
           END;`,
        );
      }
      // An update that changes the primary key also retires the old key.
      await this.db.execAsync(
        `CREATE TRIGGER sync_${t.name}_rekey AFTER UPDATE ON ${t.name}
           WHEN ${muted} AND json_array(${t.pk.map((c) => `OLD.${c}`).join(', ')}) <> json_array(${t.pk.map((c) => `NEW.${c}`).join(', ')}) BEGIN
             INSERT INTO sync_outbox(tbl, pk, changed_at) VALUES ('${t.name}', json_array(${t.pk.map((c) => `OLD.${c}`).join(', ')}), ${now})
             ON CONFLICT(tbl, pk) DO UPDATE SET changed_at = excluded.changed_at;
           END;`,
      );
    }
    await this.setMeta('trigger_version', String(TRIGGER_VERSION));
  }

  private async dropTriggers(): Promise<void> {
    const triggers = await this.db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync\\_%' ESCAPE '\\'", []);
    for (const t of triggers) await this.db.execAsync(`DROP TRIGGER IF EXISTS ${t.name}`);
    await this.db.runAsync("DELETE FROM sync_meta WHERE key = 'trigger_version'", []);
  }
}
