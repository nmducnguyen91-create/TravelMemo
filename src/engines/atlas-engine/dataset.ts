/** Ring = [lon, lat][] (implicitly closed). Polygon = [outer, ...holes]. */
export type Ring = readonly (readonly [number, number])[];
export type Polygon = readonly Ring[];

export interface GeoRegion {
  readonly code: string;
  readonly name: string;
  readonly nameVi: string;
  readonly continent?: string;
  readonly bbox: readonly [number, number, number, number];
  readonly polygons: readonly Polygon[];
}

export interface GeoDataset {
  readonly source: string;
  readonly license: string;
  readonly sourceVersion: string;
  readonly datasetVersion: string;
  readonly kind: 'country' | 'vn-province';
  readonly validTo?: string;
  readonly regions: readonly GeoRegion[];
}

export const regionId = (kind: GeoDataset['kind'], code: string) => `${kind}:${code}`;
export const regionVersionId = (kind: GeoDataset['kind'], code: string, datasetVersion: string) =>
  `${regionId(kind, code)}@${datasetVersion}`;
