import { regionVersionId, type GeoDataset } from '../../engines/atlas-engine/dataset.ts';
import { locateRegion } from '../../engines/atlas-engine/geometry.ts';
import { first, NotFoundError, PROFILE_ID, type RepoContext } from '../../database/repositories/base.ts';
import { PASSPORTS, PassportRepository, type StampTarget } from '../../database/repositories/passport-repository.ts';
import { parseOrThrow, ValidationError, visitInputSchema, type ValidVisitInput, type VisitInput } from '../domain/validation.ts';

export interface Geography {
  readonly world: GeoDataset;
  readonly vietnam: GeoDataset;
}

export interface ResolvedRegions {
  readonly countryCode: string | null;
  readonly provinceCode: string | null;
}

/**
 * Visit confirmation, edit and removal. Each is one transaction covering the visit, its
 * region links and its passport stamps, so coverage, stamps and statistics never disagree.
 */
/** The visits.date_precision column only accepts day/month/year; "unknown" is stored as date_unknown = 1. */
function storedPrecision(p: ValidVisitInput['datePrecision']): 'day' | 'month' | 'year' {
  return p === 'unknown' ? 'year' : p;
}

export class VisitService {
  private readonly ctx: RepoContext;
  private readonly geo: Geography;
  private readonly passports: PassportRepository;

  constructor(ctx: RepoContext, geo: Geography) {
    this.ctx = ctx;
    this.geo = geo;
    this.passports = new PassportRepository(ctx);
  }

  /** Suggests regions for a coordinate. The user still confirms before anything is saved. */
  suggestRegions(latitude: number, longitude: number): ResolvedRegions {
    const country = locateRegion(this.geo.world, longitude, latitude);
    const province = country?.code === 'VNM' ? locateRegion(this.geo.vietnam, longitude, latitude, 0.3) : null;
    return { countryCode: country?.code ?? null, provinceCode: province?.code ?? null };
  }

  async confirmVisit(input: VisitInput): Promise<string> {
    const v = this.resolve(parseOrThrow(visitInputSchema, input));
    const id = this.ctx.newId();
    const placeId = this.ctx.newId();
    const now = this.ctx.clock.now();
    await this.ctx.db.withTransactionAsync(async () => {
      if (v.tripId) await this.assertTrip(v.tripId);
      await this.ctx.db.runAsync(
        'INSERT INTO places(id, name, latitude, longitude, country_code, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [placeId, v.placeName, v.latitude, v.longitude, v.countryCode, now],
      );
      await this.ctx.db.runAsync(
        `INSERT INTO visits(id, profile_id, trip_id, place_id, occurred_at, local_date, timezone, latitude, longitude,
           source, confirmed, kind, note, date_precision, date_unknown, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
        [id, PROFILE_ID, v.tripId, placeId, v.localDate, v.timezone, v.latitude, v.longitude, v.source, v.kind, v.note,
          storedPrecision(v.datePrecision), v.datePrecision === 'unknown' ? 1 : 0, now],
      );
      await this.linkRegionsAndStamps(id, v);
    });
    return id;
  }

  async updateVisit(id: string, input: VisitInput): Promise<void> {
    const v = this.resolve(parseOrThrow(visitInputSchema, input));
    await this.ctx.db.withTransactionAsync(async () => {
      const row = await first<{ place_id: string }>(this.ctx.db, 'SELECT place_id FROM visits WHERE id = ? AND deleted_at IS NULL', [id]);
      if (!row) throw new NotFoundError('điểm đến');
      if (v.tripId) await this.assertTrip(v.tripId);
      // Original coordinates are preserved unless the user supplies new ones.
      await this.ctx.db.runAsync(
        'UPDATE places SET name = ?, latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude), country_code = ? WHERE id = ?',
        [v.placeName, v.latitude, v.longitude, v.countryCode, row.place_id],
      );
      await this.ctx.db.runAsync(
        `UPDATE visits SET trip_id = ?, local_date = ?, date_precision = ?, date_unknown = ?, timezone = ?, kind = ?, note = ?,
           latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude) WHERE id = ?`,
        [v.tripId, v.localDate, storedPrecision(v.datePrecision), v.datePrecision === 'unknown' ? 1 : 0, v.timezone, v.kind, v.note,
          v.latitude, v.longitude, id],
      );
      await this.ctx.db.runAsync('DELETE FROM visit_regions WHERE visit_id = ?', [id]);
      await this.linkRegionsAndStamps(id, v);
    });
  }

  /** Soft delete: the visit stops counting and its stamps are revoked, all in one transaction (TC06). */
  async removeVisit(id: string): Promise<void> {
    await this.ctx.db.withTransactionAsync(async () => {
      const now = this.ctx.clock.now();
      await this.ctx.db.runAsync('UPDATE visits SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL', [now, id]);
      await this.ctx.db.runAsync('UPDATE passport_stamps SET revoked_at = COALESCE(revoked_at, ?) WHERE visit_id = ?', [now, id]);
      await this.passports.refreshFirstVisits(await this.passports.keysForVisit(id));
    });
  }

  /** Soft-deletes a journey and every visit in it. */
  async removeTrip(tripId: string): Promise<void> {
    await this.ctx.db.withTransactionAsync(async () => {
      const now = this.ctx.clock.now();
      await this.ctx.db.runAsync('UPDATE trips SET deleted_at = ? WHERE id = ?', [now, tripId]);
      await this.ctx.db.runAsync(
        `UPDATE passport_stamps SET revoked_at = COALESCE(revoked_at, ?)
         WHERE visit_id IN (SELECT id FROM visits WHERE trip_id = ? AND deleted_at IS NULL)`,
        [now, tripId],
      );
      await this.ctx.db.runAsync('UPDATE visits SET deleted_at = ? WHERE trip_id = ? AND deleted_at IS NULL', [now, tripId]);
      await this.passports.refreshFirstVisits();
    });
  }

  /** Regenerates stamps for every confirmed visit (S04-03 backfill). Safe to run repeatedly. */
  async backfillStamps(): Promise<number> {
    const visits = await this.ctx.db.getAllAsync<{ id: string }>(
      'SELECT id FROM visits WHERE deleted_at IS NULL AND confirmed = 1',
      [],
    );
    await this.ctx.db.withTransactionAsync(async () => {
      for (const { id } of visits) {
        const v = await first<{ local_date: string; date_precision: 'day' | 'month' | 'year'; date_unknown: number; kind: string }>(
          this.ctx.db,
          'SELECT local_date, date_precision, date_unknown, kind FROM visits WHERE id = ?',
          [id],
        );
        const codes = await this.ctx.db.getAllAsync<{ kind: string; code: string }>(
          `SELECT g.kind, gv.geometry_ref AS code FROM visit_regions vr JOIN geo_region_versions gv ON gv.id = vr.region_version_id
           JOIN geo_regions g ON g.id = gv.region_id WHERE vr.visit_id = ?`,
          [id],
        );
        if (!v) continue;
        const country = codes.find((c) => c.kind === 'country')?.code ?? null;
        const province = codes.find((c) => c.kind === 'vn-province')?.code ?? null;
        await this.passports.syncVisitStamps(
          { id, localDate: v.local_date, datePrecision: v.date_unknown ? 'unknown' : v.date_precision },
          v.kind === 'stay' ? this.targets(country, province) : [],
        );
      }
      await this.passports.refreshFirstVisits();
    });
    return visits.length;
  }

  private resolve(v: ValidVisitInput): ValidVisitInput {
    let { countryCode, provinceCode } = v;
    if (!countryCode && v.latitude !== null && v.longitude !== null) {
      ({ countryCode, provinceCode } = this.suggestRegions(v.latitude, v.longitude));
      if (!countryCode) throw new ValidationError({ countryCode: 'Không xác định được quốc gia từ vị trí. Hãy chọn thủ công.' });
    }
    if (countryCode && !this.geo.world.regions.some((r) => r.code === countryCode)) {
      throw new ValidationError({ countryCode: 'Quốc gia không có trong dữ liệu bản đồ' });
    }
    if (provinceCode) {
      if (countryCode !== 'VNM') provinceCode = null;
      else if (!this.geo.vietnam.regions.some((r) => r.code === provinceCode)) {
        throw new ValidationError({ provinceCode: 'Tỉnh/thành không hợp lệ' });
      }
    }
    return { ...v, countryCode, provinceCode };
  }

  private targets(countryCode: string | null, provinceCode: string | null): StampTarget[] {
    const out: StampTarget[] = [];
    const country = countryCode ? this.geo.world.regions.find((r) => r.code === countryCode) : undefined;
    if (country) {
      out.push({ passportId: PASSPORTS.world, category: 'country', regionKey: country.code, regionName: country.nameVi });
    }
    const province = provinceCode ? this.geo.vietnam.regions.find((r) => r.code === provinceCode) : undefined;
    if (province) {
      out.push({ passportId: PASSPORTS.vietnam, category: 'province', regionKey: province.code, regionName: province.nameVi });
    }
    return out;
  }

  private async linkRegionsAndStamps(visitId: string, v: ValidVisitInput): Promise<void> {
    if (v.countryCode) {
      await this.ctx.db.runAsync('INSERT INTO visit_regions(visit_id, region_version_id) VALUES (?, ?)', [
        visitId,
        regionVersionId('country', v.countryCode, this.geo.world.datasetVersion),
      ]);
    }
    if (v.provinceCode) {
      await this.ctx.db.runAsync('INSERT INTO visit_regions(visit_id, region_version_id) VALUES (?, ?)', [
        visitId,
        regionVersionId('vn-province', v.provinceCode, this.geo.vietnam.datasetVersion),
      ]);
    }
    const before = await this.passports.keysForVisit(visitId);
    const targets = v.kind === 'stay' ? this.targets(v.countryCode, v.provinceCode) : []; // transit earns no stamp
    await this.passports.syncVisitStamps({ id: visitId, localDate: v.localDate, datePrecision: v.datePrecision }, targets);
    await this.passports.refreshFirstVisits([...before, ...targets]);
  }

  private async assertTrip(tripId: string): Promise<void> {
    if (!(await first(this.ctx.db, 'SELECT id FROM trips WHERE id = ? AND deleted_at IS NULL', [tripId]))) {
      throw new NotFoundError('hành trình');
    }
  }
}
