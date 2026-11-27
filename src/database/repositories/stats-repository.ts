import type { LifetimeStats } from '../../core/domain/types.ts';
import type { GeoDataset } from '../../engines/atlas-engine/dataset.ts';
import { first, type RepoContext } from './base.ts';

const CONFIRMED_STAY = "v.deleted_at IS NULL AND v.confirmed = 1 AND v.kind = 'stay'";

/** Lifetime statistics derived from confirmed stays only. Transit and imported photos never count. */
export async function lifetimeStats(ctx: RepoContext, world: GeoDataset, vietnam: GeoDataset): Promise<LifetimeStats> {
  const db = ctx.db;
  const regionCount = async (kind: string) =>
    (
      await first<{ n: number }>(
        db,
        `SELECT COUNT(DISTINCT gv.geometry_ref) AS n FROM visits v JOIN visit_regions vr ON vr.visit_id = v.id
         JOIN geo_region_versions gv ON gv.id = vr.region_version_id JOIN geo_regions g ON g.id = gv.region_id
         WHERE ${CONFIRMED_STAY} AND g.kind = ?`,
        [kind],
      )
    )?.n ?? 0;
  const countryCodes = await db.getAllAsync<{ code: string }>(
    `SELECT DISTINCT gv.geometry_ref AS code FROM visits v JOIN visit_regions vr ON vr.visit_id = v.id
     JOIN geo_region_versions gv ON gv.id = vr.region_version_id JOIN geo_regions g ON g.id = gv.region_id
     WHERE ${CONFIRMED_STAY} AND g.kind = 'country'`,
    [],
  );
  const continents = new Set(
    countryCodes.map((c) => world.regions.find((r) => r.code === c.code)?.continent).filter((x): x is string => !!x),
  );
  const totals = await first<{ visits: number; places: number; first_date: string | null; last_date: string | null }>(
    db,
    `SELECT COUNT(*) AS visits, COUNT(DISTINCT v.place_id) AS places, MIN(CASE WHEN v.date_unknown = 0 THEN v.local_date END) AS first_date,
       MAX(CASE WHEN v.date_unknown = 0 THEN v.local_date END) AS last_date
     FROM visits v WHERE ${CONFIRMED_STAY}`,
  );
  const scalar = async (sql: string) => (await first<{ n: number }>(db, sql))?.n ?? 0;
  const byYear = await db.getAllAsync<{ year: string; visits: number; countries: number }>(
    `SELECT substr(v.local_date, 1, 4) AS year, COUNT(DISTINCT v.id) AS visits,
       COUNT(DISTINCT CASE WHEN g.kind = 'country' THEN gv.geometry_ref END) AS countries
     FROM visits v LEFT JOIN visit_regions vr ON vr.visit_id = v.id
     LEFT JOIN geo_region_versions gv ON gv.id = vr.region_version_id LEFT JOIN geo_regions g ON g.id = gv.region_id
     WHERE ${CONFIRMED_STAY} AND v.date_unknown = 0 GROUP BY year ORDER BY year`,
    [],
  );
  return {
    trips: await scalar('SELECT COUNT(*) AS n FROM trips WHERE deleted_at IS NULL'),
    places: totals?.places ?? 0,
    countries: await regionCount('country'),
    countriesTotal: world.regions.length,
    provinces: await regionCount('vn-province'),
    provincesTotal: vietnam.regions.length,
    continents: continents.size,
    visits: totals?.visits ?? 0,
    transitVisits: await scalar("SELECT COUNT(*) AS n FROM visits WHERE deleted_at IS NULL AND confirmed = 1 AND kind = 'transit'"),
    photos: await scalar('SELECT COUNT(*) AS n FROM media_assets WHERE deleted_at IS NULL'),
    journalEntries: await scalar('SELECT COUNT(*) AS n FROM journal_entries WHERE deleted_at IS NULL'),
    firstVisitDate: totals?.first_date ?? null,
    lastVisitDate: totals?.last_date ?? null,
    byYear,
  };
}
