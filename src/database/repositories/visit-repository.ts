import type { DatePrecision, Visit, VisitKind, VisitSource } from '../../core/domain/types.ts';
import { first, type RepoContext } from './base.ts';

interface VisitRow {
  id: string;
  trip_id: string | null;
  place_id: string;
  place_name: string;
  local_date: string;
  date_precision: DatePrecision;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  source: VisitSource;
  kind: VisitKind;
  note: string | null;
  country_code: string | null;
  province_code: string | null;
}

const toVisit = (r: VisitRow): Visit => ({
  id: r.id,
  tripId: r.trip_id,
  placeId: r.place_id,
  placeName: r.place_name,
  localDate: r.local_date,
  datePrecision: r.date_precision,
  timezone: r.timezone,
  latitude: r.latitude,
  longitude: r.longitude,
  source: r.source,
  kind: r.kind,
  note: r.note,
  countryCode: r.country_code,
  provinceCode: r.province_code,
});

const SELECT = `
SELECT v.id, v.trip_id, v.place_id, p.name AS place_name, v.local_date, v.date_precision, v.timezone,
  v.latitude, v.longitude, v.source, v.kind, v.note,
  (SELECT gv.geometry_ref FROM visit_regions vr JOIN geo_region_versions gv ON gv.id = vr.region_version_id
     JOIN geo_regions g ON g.id = gv.region_id WHERE vr.visit_id = v.id AND g.kind = 'country' LIMIT 1) AS country_code,
  (SELECT gv.geometry_ref FROM visit_regions vr JOIN geo_region_versions gv ON gv.id = vr.region_version_id
     JOIN geo_regions g ON g.id = gv.region_id WHERE vr.visit_id = v.id AND g.kind = 'vn-province' LIMIT 1) AS province_code
FROM visits v JOIN places p ON p.id = v.place_id`;

export class VisitRepository {
  private readonly ctx: RepoContext;
  constructor(ctx: RepoContext) {
    this.ctx = ctx;
  }

  async forTrip(tripId: string): Promise<Visit[]> {
    const rows = await this.ctx.db.getAllAsync<VisitRow>(
      `${SELECT} WHERE v.trip_id = ? AND v.deleted_at IS NULL AND v.confirmed = 1 ORDER BY v.local_date, v.created_at`,
      [tripId],
    );
    return rows.map(toVisit);
  }

  async recent(limit = 20): Promise<Visit[]> {
    const rows = await this.ctx.db.getAllAsync<VisitRow>(
      `${SELECT} WHERE v.deleted_at IS NULL AND v.confirmed = 1 ORDER BY v.local_date DESC, v.created_at DESC LIMIT ?`,
      [limit],
    );
    return rows.map(toVisit);
  }

  async inRegion(kind: 'country' | 'vn-province', code: string): Promise<Visit[]> {
    const rows = await this.ctx.db.getAllAsync<VisitRow>(
      `${SELECT} WHERE v.deleted_at IS NULL AND v.confirmed = 1 AND EXISTS (
         SELECT 1 FROM visit_regions vr JOIN geo_region_versions gv ON gv.id = vr.region_version_id
         JOIN geo_regions g ON g.id = gv.region_id WHERE vr.visit_id = v.id AND g.kind = ? AND gv.geometry_ref = ?)
       ORDER BY v.local_date DESC`,
      [kind, code],
    );
    return rows.map(toVisit);
  }

  async get(id: string): Promise<Visit | null> {
    const r = await first<VisitRow>(this.ctx.db, `${SELECT} WHERE v.id = ? AND v.deleted_at IS NULL`, [id]);
    return r ? toVisit(r) : null;
  }

  /** Region codes with at least one confirmed stay. Transit never counts. */
  async visitedCodes(kind: 'country' | 'vn-province'): Promise<Map<string, number>> {
    const rows = await this.ctx.db.getAllAsync<{ code: string; n: number }>(
      `SELECT gv.geometry_ref AS code, COUNT(DISTINCT v.id) AS n FROM visits v
       JOIN visit_regions vr ON vr.visit_id = v.id
       JOIN geo_region_versions gv ON gv.id = vr.region_version_id
       JOIN geo_regions g ON g.id = gv.region_id
       WHERE v.deleted_at IS NULL AND v.confirmed = 1 AND v.kind = 'stay' AND g.kind = ?
       GROUP BY gv.geometry_ref`,
      [kind],
    );
    return new Map(rows.map((r) => [r.code, r.n]));
  }
}
