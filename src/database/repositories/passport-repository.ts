import type { Stamp, StampSnapshot } from '../../core/domain/types.ts';
import { designStamp, placeStamp, STAMP_TEMPLATES } from '../../engines/stamp-engine/index.ts';
import { first, type RepoContext } from './base.ts';

export const PASSPORTS = { world: 'passport-world', vietnam: 'passport-vietnam' } as const;
export type PassportKind = keyof typeof PASSPORTS;

interface StampRow {
  id: string;
  passport_id: string;
  visit_id: string;
  category: 'country' | 'province';
  region_key: string;
  snapshot_json: string;
  page: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  sequence: number;
  is_first_visit: number;
  trip_id: string | null;
}

const toStamp = (r: StampRow): Stamp => ({
  id: r.id,
  passportId: r.passport_id,
  visitId: r.visit_id,
  category: r.category,
  regionKey: r.region_key,
  snapshot: JSON.parse(r.snapshot_json) as StampSnapshot,
  page: r.page,
  x: r.x,
  y: r.y,
  scale: r.scale,
  rotation: r.rotation,
  sequence: r.sequence,
  isFirstVisit: r.is_first_visit === 1,
  tripId: r.trip_id,
});

/** Deterministic stamp id, so a retried generation maps to the same logical stamp (TC05). */
export function stampId(passportId: string, visitId: string, category: string, regionKey: string): string {
  return `stamp:${passportId}:${visitId}:${category}:${regionKey}`;
}

export interface StampKey {
  readonly passportId: string;
  readonly category: string;
  readonly regionKey: string;
}

export interface StampTarget {
  readonly passportId: string;
  readonly category: 'country' | 'province';
  readonly regionKey: string;
  readonly regionName: string;
}

export class PassportRepository {
  private readonly ctx: RepoContext;
  constructor(ctx: RepoContext) {
    this.ctx = ctx;
  }

  async ensureTemplates(): Promise<void> {
    for (const t of STAMP_TEMPLATES) {
      await this.ctx.db.runAsync('INSERT OR IGNORE INTO stamp_templates(id, version, definition_json) VALUES (?, ?, ?)', [
        t.id,
        t.version,
        JSON.stringify(t),
      ]);
    }
  }

  /**
   * Makes the visit's stamps match `targets`: creates missing ones, restores ones that come back,
   * revokes ones that no longer apply. Must run inside the caller's transaction. Idempotent.
   */
  async syncVisitStamps(
    visit: { id: string; localDate: string; datePrecision: 'day' | 'month' | 'year' },
    targets: readonly StampTarget[],
  ): Promise<void> {
    const db = this.ctx.db;
    const now = this.ctx.clock.now();
    const wanted = new Set(targets.map((t) => stampId(t.passportId, visit.id, t.category, t.regionKey)));
    const existing = await db.getAllAsync<{ id: string; passport_id: string }>(
      'SELECT id, passport_id FROM passport_stamps WHERE visit_id = ?',
      [visit.id],
    );
    for (const e of existing) {
      if (!wanted.has(e.id)) {
        await db.runAsync('UPDATE passport_stamps SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?', [now, e.id]);
      }
    }
    for (const t of targets) {
      const id = stampId(t.passportId, visit.id, t.category, t.regionKey);
      const snapshot = designStamp({
        regionKey: t.regionKey,
        regionName: t.regionName,
        localDate: visit.localDate,
        datePrecision: visit.datePrecision,
        category: t.category,
      });
      const found = await first<{ id: string }>(db, 'SELECT id FROM passport_stamps WHERE id = ?', [id]);
      if (found) {
        // Same logical stamp: keep its page position; refresh the printed date if the visit date was corrected.
        await db.runAsync('UPDATE passport_stamps SET revoked_at = NULL, snapshot_json = ? WHERE id = ?', [
          JSON.stringify(snapshot),
          id,
        ]);
        continue;
      }
      const seqRow = await first<{ n: number | null }>(
        db,
        'SELECT MAX(sequence) AS n FROM passport_stamps WHERE passport_id = ?',
        [t.passportId],
      );
      const sequence = (seqRow?.n ?? 0) + 1;
      const place = placeStamp(sequence, id);
      await db.runAsync(
        `INSERT INTO passport_stamps(id, passport_id, visit_id, category, region_key, template_id, template_version,
           snapshot_json, page, x, y, scale, rotation, z_index, sequence, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          t.passportId,
          visit.id,
          t.category,
          t.regionKey,
          snapshot.templateId,
          snapshot.templateVersion,
          JSON.stringify(snapshot),
          place.page,
          place.x,
          place.y,
          place.scale,
          place.rotation,
          sequence,
          sequence,
          now,
        ],
      );
    }
  }

  /**
   * Recomputes first-visit flags from confirmed chronological history. Run inside the caller's transaction.
   * With `keys`, only those regions are recomputed (normal edits); without, every stamp is (backfill).
   */
  async refreshFirstVisits(keys?: readonly StampKey[]): Promise<void> {
    if (!keys) {
      await this.ctx.db.execAsync(`
UPDATE passport_stamps SET is_first_visit = CASE WHEN id IN (
  SELECT id FROM (
    SELECT s.id, ROW_NUMBER() OVER (PARTITION BY s.passport_id, s.category, s.region_key
                                    ORDER BY v.local_date, v.created_at, s.id) AS rn
    FROM passport_stamps s JOIN visits v ON v.id = s.visit_id WHERE s.revoked_at IS NULL)
  WHERE rn = 1) THEN 1 ELSE 0 END;`);
      return;
    }
    const seen = new Set<string>();
    for (const k of keys) {
      const id = `${k.passportId}|${k.category}|${k.regionKey}`;
      if (seen.has(id)) continue;
      seen.add(id);
      await this.ctx.db.runAsync(
        `UPDATE passport_stamps SET is_first_visit = CASE WHEN revoked_at IS NULL AND id = (
           SELECT s2.id FROM passport_stamps s2 JOIN visits v2 ON v2.id = s2.visit_id
           WHERE s2.passport_id = ? AND s2.category = ? AND s2.region_key = ? AND s2.revoked_at IS NULL
           ORDER BY v2.local_date, v2.created_at, s2.id LIMIT 1) THEN 1 ELSE 0 END
         WHERE passport_id = ? AND category = ? AND region_key = ?`,
        [k.passportId, k.category, k.regionKey, k.passportId, k.category, k.regionKey],
      );
    }
  }

  /** Region keys a visit's stamps touch (current and revoked), for scoped first-visit refresh. */
  async keysForVisit(visitId: string): Promise<StampKey[]> {
    const rows = await this.ctx.db.getAllAsync<{ passport_id: string; category: string; region_key: string }>(
      'SELECT passport_id, category, region_key FROM passport_stamps WHERE visit_id = ?',
      [visitId],
    );
    return rows.map((r) => ({ passportId: r.passport_id, category: r.category, regionKey: r.region_key }));
  }

  async stamps(kind: PassportKind): Promise<Stamp[]> {
    const rows = await this.ctx.db.getAllAsync<StampRow>(
      `SELECT s.*, v.trip_id FROM passport_stamps s JOIN visits v ON v.id = s.visit_id
       WHERE s.passport_id = ? AND s.revoked_at IS NULL ORDER BY s.sequence`,
      [PASSPORTS[kind]],
    );
    return rows.map(toStamp);
  }

  async get(id: string): Promise<Stamp | null> {
    const r = await first<StampRow>(
      this.ctx.db,
      'SELECT s.*, v.trip_id FROM passport_stamps s JOIN visits v ON v.id = s.visit_id WHERE s.id = ?',
      [id],
    );
    return r ? toStamp(r) : null;
  }

  async counts(): Promise<Record<PassportKind, { stamps: number; regions: number; pages: number }>> {
    const rows = await this.ctx.db.getAllAsync<{ passport_id: string; stamps: number; regions: number; pages: number }>(
      `SELECT passport_id, COUNT(*) AS stamps, COUNT(DISTINCT region_key) AS regions, COALESCE(MAX(page), 0) AS pages
       FROM passport_stamps WHERE revoked_at IS NULL GROUP BY passport_id`,
      [],
    );
    const get = (pid: string) => {
      const r = rows.find((x) => x.passport_id === pid);
      return { stamps: r?.stamps ?? 0, regions: r?.regions ?? 0, pages: r?.pages ?? 0 };
    };
    return { world: get(PASSPORTS.world), vietnam: get(PASSPORTS.vietnam) };
  }
}
