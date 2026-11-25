import type { Trip, TripStatus, TripSummary } from '../../core/domain/types.ts';
import { parseOrThrow, tripInputSchema, type TripInput } from '../../core/domain/validation.ts';
import { first, NotFoundError, PROFILE_ID, type RepoContext } from './base.ts';

interface TripRow {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: TripStatus;
  cover_media_id: string | null;
  created_at: string;
  updated_at: string;
  visit_count?: number;
  country_count?: number;
}

const toTrip = (r: TripRow): Trip => ({
  id: r.id,
  title: r.title,
  description: r.description,
  startDate: r.start_date,
  endDate: r.end_date,
  status: r.status,
  coverMediaId: r.cover_media_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const SUMMARY_SQL = `
SELECT t.*,
  (SELECT COUNT(*) FROM visits v WHERE v.trip_id = t.id AND v.deleted_at IS NULL AND v.confirmed = 1) AS visit_count,
  (SELECT COUNT(DISTINCT g.id) FROM visits v
     JOIN visit_regions vr ON vr.visit_id = v.id
     JOIN geo_region_versions gv ON gv.id = vr.region_version_id
     JOIN geo_regions g ON g.id = gv.region_id AND g.kind = 'country'
   WHERE v.trip_id = t.id AND v.deleted_at IS NULL AND v.confirmed = 1 AND v.kind = 'stay') AS country_count
FROM trips t`;

export class TripRepository {
  private readonly ctx: RepoContext;
  constructor(ctx: RepoContext) {
    this.ctx = ctx;
  }

  async list(options: { includeArchived?: boolean } = {}): Promise<TripSummary[]> {
    const rows = await this.ctx.db.getAllAsync<TripRow>(
      `${SUMMARY_SQL} WHERE t.deleted_at IS NULL ${options.includeArchived ? '' : "AND t.status != 'archived'"}
       ORDER BY COALESCE(t.start_date, substr(t.created_at, 1, 10)) DESC, t.created_at DESC`,
      [],
    );
    return rows.map((r) => ({ ...toTrip(r), visitCount: r.visit_count ?? 0, countryCount: r.country_count ?? 0 }));
  }

  async get(id: string): Promise<TripSummary | null> {
    const r = await first<TripRow>(this.ctx.db, `${SUMMARY_SQL} WHERE t.id = ? AND t.deleted_at IS NULL`, [id]);
    return r ? { ...toTrip(r), visitCount: r.visit_count ?? 0, countryCount: r.country_count ?? 0 } : null;
  }

  async create(input: TripInput): Promise<string> {
    const v = parseOrThrow(tripInputSchema, input);
    const id = this.ctx.newId();
    const now = this.ctx.clock.now();
    await this.ctx.db.withTransactionAsync(async () => {
      await this.ctx.db.runAsync(
        `INSERT INTO trips(id, profile_id, title, description, start_date, end_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, PROFILE_ID, v.title, v.description, v.startDate, v.endDate, v.status, now, now],
      );
      await this.setCompanions(id, v.companionIds);
    });
    return id;
  }

  async update(id: string, input: TripInput): Promise<void> {
    const v = parseOrThrow(tripInputSchema, input);
    await this.ctx.db.withTransactionAsync(async () => {
      const res = (await this.ctx.db.runAsync(
        `UPDATE trips SET title = ?, description = ?, start_date = ?, end_date = ?, status = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [v.title, v.description, v.startDate, v.endDate, v.status, this.ctx.clock.now(), id],
      )) as { changes?: number } | undefined;
      if (res && res.changes === 0) throw new NotFoundError('hành trình');
      await this.setCompanions(id, v.companionIds);
    });
  }

  async setStatus(id: string, status: TripStatus): Promise<void> {
    await this.ctx.db.runAsync('UPDATE trips SET status = ?, updated_at = ? WHERE id = ?', [status, this.ctx.clock.now(), id]);
  }

  async setCover(id: string, mediaId: string | null): Promise<void> {
    await this.ctx.db.runAsync('UPDATE trips SET cover_media_id = ?, updated_at = ? WHERE id = ?', [
      mediaId,
      this.ctx.clock.now(),
      id,
    ]);
  }

  async companionIds(tripId: string): Promise<string[]> {
    const rows = await this.ctx.db.getAllAsync<{ companion_id: string }>(
      'SELECT companion_id FROM trip_companions WHERE trip_id = ?',
      [tripId],
    );
    return rows.map((r) => r.companion_id);
  }

  private async setCompanions(tripId: string, ids: readonly string[]): Promise<void> {
    await this.ctx.db.runAsync('DELETE FROM trip_companions WHERE trip_id = ?', [tripId]);
    for (const cid of new Set(ids)) {
      await this.ctx.db.runAsync('INSERT INTO trip_companions(trip_id, companion_id) VALUES (?, ?)', [tripId, cid]);
    }
  }
}
