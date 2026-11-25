import { regionId, regionVersionId, type GeoDataset } from '../../engines/atlas-engine/dataset.ts';
import { first, type RepoContext } from './base.ts';

/** Registers a geography dataset version. Idempotent; existing versions are never rewritten. */
export async function ensureDataset(ctx: RepoContext, dataset: GeoDataset, parentCode?: string): Promise<void> {
  const key = `geo.dataset.${dataset.datasetVersion}`;
  if (await first(ctx.db, 'SELECT key FROM settings WHERE key = ?', [key])) return;
  await ctx.db.withTransactionAsync(async () => {
    for (const r of dataset.regions) {
      const id = regionId(dataset.kind, r.code);
      await ctx.db.runAsync('INSERT OR IGNORE INTO geo_regions(id, parent_id, name, kind) VALUES (?, ?, ?, ?)', [
        id,
        parentCode ? regionId('country', parentCode) : null,
        r.nameVi,
        dataset.kind,
      ]);
      await ctx.db.runAsync(
        'INSERT OR IGNORE INTO geo_region_versions(id, region_id, dataset_version, source, license, geometry_ref, valid_from, valid_to) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)',
        [
          regionVersionId(dataset.kind, r.code, dataset.datasetVersion),
          id,
          dataset.datasetVersion,
          `${dataset.source} ${dataset.sourceVersion}`,
          dataset.license,
          r.code,
          dataset.validTo ?? null,
        ],
      );
    }
    await ctx.db.runAsync('INSERT INTO settings(key, value_json) VALUES (?, ?)', [
      key,
      JSON.stringify({ regions: dataset.regions.length, registeredAt: ctx.clock.now() }),
    ]);
  });
}
