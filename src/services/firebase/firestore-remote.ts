import { collection, doc, getDocs, query, serverTimestamp, Timestamp, where, writeBatch, type Firestore } from 'firebase/firestore';

import type { OutgoingRow, RemoteRow, RowData, SyncRemote } from '../../core/sync/sync-engine';
import type { SqlValue } from '../../database/types';

/**
 * Firestore layout (enforced by firestore.rules):
 *   users/{uid}/rows/{table~key}  { t: table, k: key[], d: row | null, u: changedAt, dev: deviceId, s: serverTime, v: schema }
 * Only the signed-in owner can read or write their own documents.
 */
interface RowDoc {
  t: string;
  k: SqlValue[];
  d: RowData | null;
  u: string;
  dev: string;
  s: Timestamp | null;
  v: number;
}

const BATCH = 400;

export class FirestoreRemote implements SyncRemote {
  private readonly db: Firestore;
  private readonly uid: string;
  private readonly schemaVersion: number;

  constructor(db: Firestore, uid: string, schemaVersion: number) {
    this.db = db;
    this.uid = uid;
    this.schemaVersion = schemaVersion;
  }

  private rows() {
    return collection(this.db, 'users', this.uid, 'rows');
  }

  async pull(sinceMs: number | null): Promise<RemoteRow[]> {
    const q = sinceMs === null ? query(this.rows()) : query(this.rows(), where('s', '>=', Timestamp.fromMillis(sinceMs)));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const x = d.data() as RowDoc;
      return { id: d.id, table: x.t, key: x.k, data: x.d, changedAt: x.u, deviceId: x.dev, serverTime: x.s?.toMillis() ?? 0 };
    });
  }

  async push(rows: readonly OutgoingRow[]): Promise<void> {
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = writeBatch(this.db);
      for (const r of rows.slice(i, i + BATCH)) {
        batch.set(doc(this.rows(), r.id), {
          t: r.table,
          k: [...r.key],
          d: r.data,
          u: r.changedAt,
          dev: r.deviceId,
          s: serverTimestamp(),
          v: this.schemaVersion,
        });
      }
      await batch.commit();
    }
  }
}
